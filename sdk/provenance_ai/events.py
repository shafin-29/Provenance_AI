import datetime
import json
import logging
from concurrent.futures import ThreadPoolExecutor
import httpx
from typing import Dict, Any

logger = logging.getLogger(__name__)

class EventEmitter:
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        # max_workers=2 is plenty since events should be small and fast
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ProvAI_Events")
        self._http = httpx.Client(
            timeout=3.0,
            headers={"X-Provenance-API-Key": self.api_key}
        )

    def _send_event(self, event_type: str, payload: Dict[str, Any]):
        try:
            url = f"{self.api_url}/api/events"
            
            # Common payload elements to ensure consistency
            from provenance_ai.client import SDK_VERSION
            full_payload = {
                "eventType": event_type,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "sdk_version": SDK_VERSION,
                **payload
            }

            resp = self._http.post(url, json=full_payload)
            resp.raise_for_status()
            
        except Exception as e:
            # Fire and forget — fail silently to not disrupt the app
            logger.debug("ProvenanceAI: Failed to emit event '%s'. %s", event_type, e)

    def emit(self, event_type: str, payload: Dict[str, Any]) -> None:
        """
        Emits an event to the ProvenanceAI backend asynchronously.
        Does not block the main thread.
        """
        self.executor.submit(self._send_event, event_type, payload)

    def shutdown(self):
        self.executor.shutdown(wait=False)
