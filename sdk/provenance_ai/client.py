"""SDK client with retry logic, version header, and better error messages."""
import logging
import time
import httpx
from typing import Optional

from provenance_ai.interceptors.ingestion import ProvenanceIngestionInterceptor
from provenance_ai.interceptors.prompt import ProvenancePromptTracer
from provenance_ai.interceptors.retrieval import ProvenanceRetriever
from provenance_ai.utils.hashing import compute_text_hash

logger = logging.getLogger(__name__)

SDK_VERSION = "0.1.0"
_SDK_HEADERS = {
    "X-SDK-Version": SDK_VERSION,
}


def _retry_request(func, retries: int = 2, delay: float = 1.0):
    """
    Execute func() with up to `retries` retries on 5xx or connection errors.
    Returns the response on success; logs warning and returns None on all retries exhausted.
    """
    last_exc = None
    for attempt in range(retries + 1):
        try:
            resp = func()
            # Retry on 5xx — not on 4xx (those are client errors)
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
            # Non-retriable error
            raise exc
    if last_exc:
        logger.warning("ProvenanceAI: All retries exhausted. %s", last_exc)
    return None


class ProvenanceAIClient:
    def __init__(self, api_url: str, api_key: str, pipeline_id: str):
        # Input validation
        if not api_url or not (api_url.startswith("http://") or api_url.startswith("https://")):
            logger.warning(
                "ProvenanceAI: api_url must be a valid URL starting with http:// or https://. Got: %r",
                api_url,
            )
        if not api_key.startswith("prov_live_"):
            logger.warning(
                "ProvenanceAI: API key should start with 'prov_live_'. "
                "Generate a new key at %s/sdk",
                api_url.rstrip("/") if api_url else "<unknown>",
            )
        import re
        if pipeline_id and not re.match(r'^[a-zA-Z0-9\-]{1,64}$', pipeline_id):
            logger.warning(
                "ProvenanceAI: pipeline_id '%s' should be alphanumeric with hyphens only, max 64 chars.",
                pipeline_id[:32],
            )

        self._api_url = api_url.rstrip("/") if api_url else ""
        self._api_key = api_key
        self._pipeline_id = pipeline_id

        self._ingestion = ProvenanceIngestionInterceptor(self._api_url, self._api_key, self._pipeline_id)
        self._prompt = ProvenancePromptTracer(self._api_url, self._api_key)

        self._http = httpx.Client(
            timeout=10.0,
            headers={
                "X-Provenance-API-Key": self._api_key,
                **_SDK_HEADERS,
            }
        )
        logger.info("ProvenanceAI SDK v%s initialized. Pipeline: %s. Backend: %s", SDK_VERSION, pipeline_id, api_url)

    def ingest(self, file_path: str) -> list:
        return self._ingestion.intercept(file_path)

    def get_retriever(self, base_retriever, session_id: str) -> ProvenanceRetriever:
        return ProvenanceRetriever(
            base_retriever=base_retriever,
            api_url=self._api_url,
            api_key=self._api_key,
            session_id=session_id
        )

    def trace_prompt(self, session_id: str, prompt_text: str, retrieved_docs: list = None) -> str:
        return self._prompt.trace_prompt(session_id, prompt_text, retrieved_docs)

    def record_response(self, session_id: str, response_text: str, model_version: str = "unknown") -> None:
        response_hash = compute_text_hash(response_text)
        url = f"{self._api_url}/api/response"
        try:
            resp = _retry_request(lambda: self._http.post(
                url,
                json={
                    "sessionId": session_id,
                    "queryText": "",
                    "retrievedEmbeddingIds": [],
                    "promptHash": "unknown_prompt",
                    "responseText": response_text,
                    "responseHash": response_hash,
                    "modelVersion": model_version
                }
            ))
            if resp is not None and resp.status_code == 401:
                logger.warning(
                    "ProvenanceAI: API key rejected. Generate a new key at %s/sdk", self._api_url
                )
            elif resp is not None and resp.status_code == 404:
                logger.warning(
                    "ProvenanceAI: Resource not found at %s. Check your api_url is correct.", url
                )
            elif resp is not None and resp.status_code >= 500:
                logger.warning("ProvenanceAI: Backend error. Check the backend logs.")
        except httpx.TimeoutException:
            logger.warning("ProvenanceAI: Request timed out after 10s. Backend may be overloaded.")
        except httpx.ConnectError:
            logger.warning("ProvenanceAI: Cannot reach backend at %s. Is it running?", self._api_url)
        except Exception as exc:
            logger.warning("ProvenanceAI: Failed to record response: %s", exc)

    def verify_connection(self) -> bool:
        try:
            resp = _retry_request(lambda: self._http.get(f"{self._api_url}/health"))
            if resp is not None and resp.status_code == 200:
                logger.info("ProvenanceAI: Backend connection verified.")
                return True
            else:
                status = resp.status_code if resp is not None else "no response"
                logger.warning("ProvenanceAI: Backend returned status code %s", status)
                return False
        except httpx.TimeoutException:
            logger.warning("ProvenanceAI: Request timed out after 10s. Backend may be overloaded.")
            return False
        except httpx.ConnectError:
            logger.warning("ProvenanceAI: Cannot reach backend at %s. Is it running?", self._api_url)
            return False
        except Exception as exc:
            logger.warning("ProvenanceAI: Failed to verify connection: %s", exc)
            return False
