"""SDK client with retry logic, version header, and better error messages."""
import logging
import time
import httpx
import uuid
from typing import Optional

from provenance_ai.interceptors.ingestion import ProvenanceIngestionInterceptor
from provenance_ai.interceptors.prompt import ProvenancePromptTracer
from provenance_ai.interceptors.retrieval import ProvenanceRetriever
from provenance_ai.utils.hashing import compute_text_hash
from provenance_ai.shield import SafeMode, ProvenanceShield
from provenance_ai.cache import ProvenanceCache
from provenance_ai.events import EventEmitter

logger = logging.getLogger(__name__)

SDK_VERSION = "0.1.0"
_SDK_HEADERS = {
    "X-SDK-Version": SDK_VERSION,
}

def _retry_request(func, retries: int = 2, delay: float = 1.0):
    last_exc = None
    for attempt in range(retries + 1):
        try:
            resp = func()
            if resp.status_code >= 500 and attempt < retries:
                logger.warning(
                    "ProvenanceAI: Backend returned %d, retrying (%d/%d)...",
                    resp.status_code,
                    attempt + 1,
                    retries,
                )
                time.sleep(delay)
                continue
            return resp
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            last_exc = exc
            if attempt < retries:
                logger.warning(
                    "ProvenanceAI: Connection error, retrying (%d/%d)...",
                    attempt + 1,
                    retries,
                )
                time.sleep(delay)
            else:
                break
        except Exception as exc:
            raise exc
    if last_exc:
        logger.warning("ProvenanceAI: All retries exhausted. %s", last_exc)
    return None

class ProvenanceAIClient:
    def __init__(
        self, 
        api_url: str, 
        api_key: str, 
        pipeline_id: str,
        safe_mode: SafeMode = SafeMode.SUBSTITUTE,
        block_threshold: float = 0.5,
        alert_on_quarantine: bool = True,
        shield_timeout_ms: int = 20,
    ):
        if not api_url or not (api_url.startswith("http://") or api_url.startswith("https://")):
            logger.warning("ProvenanceAI: api_url must be a valid URL starting with http:// or https://. Got: %r", api_url)
        if not api_key.startswith("prov_live_"):
            logger.warning("ProvenanceAI: API key should start with 'prov_live_'. Generate a new key at %s/sdk", api_url.rstrip("/") if api_url else "<unknown>")
        import re
        if pipeline_id and not re.match(r'^[a-zA-Z0-9\-]{1,64}$', pipeline_id):
            logger.warning("ProvenanceAI: pipeline_id '%s' should be alphanumeric with hyphens only, max 64 chars.", pipeline_id[:32])

        self._api_url = api_url.rstrip("/") if api_url else ""
        self._api_key = api_key
        self._pipeline_id = pipeline_id
        
        self._safe_mode = safe_mode
        self._block_threshold = block_threshold
        self._alert_on_quarantine = alert_on_quarantine
        self._shield_timeout_ms = shield_timeout_ms

        self._http = httpx.Client(
            timeout=10.0,
            headers={
                "X-Provenance-API-Key": self._api_key,
                **_SDK_HEADERS,
            }
        )

        self._ingestion = ProvenanceIngestionInterceptor(self._api_url, self._api_key, self._pipeline_id)
        self._prompt = ProvenancePromptTracer(self._api_url, self._api_key)
        
        self._events = EventEmitter(self._api_url, self._api_key)
        self._cache = ProvenanceCache(self._api_url, self._api_key)
        
        # Initial synchronous load
        try:
            self._cache.refresh()
        except Exception as e:
            logger.warning("ProvenanceAI: Cache load failed — shield will run in UNKNOWN mode until cache is available. %s", e)
            
        self._cache.start_background_refresh(60)
        self._shield = ProvenanceShield(self)
        
        logger.info(
            "ProvenanceAI Shield active\n"
            "Pipeline: %s\n"
            "Mode: %s\n"
            "Sources loaded: %d records\n"
            "Backend: %s",
            self._pipeline_id, self._safe_mode.value, len(self._cache), self._api_url
        )

    def ingest(self, file_path: str) -> list:
        return self._ingestion.intercept(file_path)

    def wrap(self, base_retriever, session_id: str = None) -> ProvenanceRetriever:
        if session_id is None:
            session_id = "sess_" + uuid.uuid4().hex[:12]
        return ProvenanceRetriever(
            base_retriever=base_retriever,
            shield=self._shield,
            cache=self._cache,
            session_id=session_id,
            safe_mode=self._safe_mode
        )
        
    def get_retriever(self, base_retriever, session_id: str) -> ProvenanceRetriever:
        # Deprecated alias
        return self.wrap(base_retriever, session_id)

    def trace_prompt(self, session_id: str, prompt_text: str, retrieved_docs: list = None) -> str:
        return self._prompt.trace_prompt(session_id, prompt_text, retrieved_docs)

    def record_response(self, session_id: str, response_text: str, model_version: str = "unknown", provenance_metadata: dict = None) -> None:
        response_hash = compute_text_hash(response_text)
        url = f"{self._api_url}/api/response"
        try:
            payload = {
                "sessionId": session_id,
                "queryText": "",
                "retrievedEmbeddingIds": [],
                "promptHash": "unknown_prompt",
                "responseText": response_text,
                "responseHash": response_hash,
                "modelVersion": model_version
            }
            if provenance_metadata:
                payload["provenanceMetadata"] = provenance_metadata
                
            resp = _retry_request(lambda: self._http.post(url, json=payload))
            if resp is not None and resp.status_code == 401:
                logger.warning("ProvenanceAI: API key rejected. Generate a new key at %s/sdk", self._api_url)
            elif resp is not None and resp.status_code == 404:
                logger.warning("ProvenanceAI: Resource not found at %s. Check your api_url is correct.", url)
            elif resp is not None and resp.status_code >= 500:
                logger.warning("ProvenanceAI: Backend error. Check the backend logs.")
        except Exception as exc:
            logger.warning("ProvenanceAI: Failed to record response: %s", exc)

    def quarantine(self, source_id: str, reason: str = "manual") -> bool:
        url = f"{self._api_url}/api/quarantine"
        try:
            resp = self._http.post(url, json={"sourceId": source_id, "reason": reason})
            if resp.status_code == 200:
                # Update local cache immediately
                with self._cache.lock:
                    self._cache.quarantine_cache.add(source_id)
                self._events.emit("quarantine.added", {
                    "source_id": source_id, "reason": reason, "pipeline_id": self._pipeline_id
                })
                return True
        except Exception as e:
            logger.warning("ProvenanceAI: Failed to quarantine source %s. %s", source_id, e)
        return False

    def restore(self, source_id: str) -> bool:
        url = f"{self._api_url}/api/quarantine/{source_id}"
        try:
            resp = self._http.delete(url)
            if resp.status_code == 200:
                # Update local cache immediately
                with self._cache.lock:
                    self._cache.quarantine_cache.discard(source_id)
                self._events.emit("quarantine.removed", {
                    "source_id": source_id, "pipeline_id": self._pipeline_id
                })
                return True
        except Exception as e:
            logger.warning("ProvenanceAI: Failed to restore source %s. %s", source_id, e)
        return False

    def shield_status(self) -> dict:
        return {
            "active": True,
            "mode": self._safe_mode.value,
            "sources_loaded": len(self._cache),
            "quarantined_sources": len(self._cache.quarantine_cache) if self._cache else 0,
            "backend_reachable": self.verify_connection()
        }

    def verify_connection(self) -> bool:
        try:
            resp = _retry_request(lambda: self._http.get(f"{self._api_url}/health"))
            if resp is not None and resp.status_code == 200:
                return True
            return False
        except Exception:
            return False

    def shutdown(self) -> None:
        """Explicitly shut down all background resources."""
        try:
            if self._events:
                self._events.shutdown()
        except Exception:
            pass
        try:
            if self._cache:
                self._cache.stop_background_refresh()
        except Exception:
            pass
        try:
            self._http.close()
        except Exception:
            pass

    def __del__(self):
        """Clean up background threads and HTTP client on garbage collection."""
        self.shutdown()

