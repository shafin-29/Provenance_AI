import threading
import httpx
import logging
import time
from dataclasses import dataclass
from typing import Optional, Dict, Set

logger = logging.getLogger(__name__)

@dataclass
class SourceRecordCacheEntry:
    source_id: str
    content_hash: str
    is_stale: bool
    is_quarantined: bool
    last_refreshed: float

class ProvenanceCache:
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        
        self.lock = threading.Lock()
        self.source_record_cache: Dict[str, SourceRecordCacheEntry] = {}
        self.quarantine_cache: Set[str] = set()
        
        self._http = httpx.Client(
            timeout=2.0,
            headers={"X-Provenance-API-Key": self.api_key}
        )
        self._refresh_thread = None
        self._stop_event = threading.Event()

    def refresh(self) -> None:
        try:
            url = f"{self.api_url}/api/sources?limit=1000"
            resp = self._http.get(url)
            resp.raise_for_status()
            
            data = resp.json()
            new_record_cache = {}
            new_quarantine_cache = set()
            now = time.time()
            
            for item in data:
                src_id = item.get("sourceId")
                is_stale = item.get("isStale", False)
                is_quarantined = item.get("isQuarantined", False)
                content_hash = item.get("contentHash", "")
                
                if src_id:
                    new_record_cache[src_id] = SourceRecordCacheEntry(
                        source_id=src_id,
                        content_hash=content_hash,
                        is_stale=is_stale,
                        is_quarantined=is_quarantined,
                        last_refreshed=now
                    )
                    if is_quarantined:
                        new_quarantine_cache.add(src_id)
            
            with self.lock:
                self.source_record_cache = new_record_cache
                self.quarantine_cache = new_quarantine_cache
                
            logger.info("ProvenanceAI cache refreshed: %d source records loaded", len(new_record_cache))
            
        except Exception as e:
            logger.warning("ProvenanceAI: Failed to refresh cache. Keeping existing data. %s", e)

    def _refresh_loop(self, interval_seconds: int):
        while not self._stop_event.is_set():
            # We wait using the event so it can be interrupted if needed
            self._stop_event.wait(timeout=interval_seconds)
            if not self._stop_event.is_set():
                self.refresh()

    def start_background_refresh(self, interval_seconds: int = 60) -> None:
        if self._refresh_thread and self._refresh_thread.is_alive():
            return
            
        self._stop_event.clear()
        self._refresh_thread = threading.Thread(
            target=self._refresh_loop,
            args=(interval_seconds,),
            daemon=True
        )
        self._refresh_thread.start()

    def stop_background_refresh(self) -> None:
        if self._refresh_thread:
            self._stop_event.set()
            self._refresh_thread.join(timeout=1.0)

    def is_stale(self, source_id: str) -> bool:
        with self.lock:
            entry = self.source_record_cache.get(source_id)
            return entry.is_stale if entry else False

    def is_quarantined(self, source_id: str) -> bool:
        with self.lock:
            return source_id in self.quarantine_cache

    def get_hash(self, source_id: str) -> Optional[str]:
        with self.lock:
            entry = self.source_record_cache.get(source_id)
            return entry.content_hash if entry else None

    def __len__(self):
        with self.lock:
            return len(self.source_record_cache)
