import logging
import httpx
from typing import Optional

from provenance_ai.interceptors.ingestion import ProvenanceIngestionInterceptor
from provenance_ai.interceptors.prompt import ProvenancePromptTracer
from provenance_ai.interceptors.retrieval import ProvenanceRetriever
from provenance_ai.utils.hashing import compute_text_hash

logger = logging.getLogger(__name__)

class ProvenanceAIClient:
    def __init__(self, api_url: str, api_key: str, pipeline_id: str):
        if not api_url:
            logger.warning("ProvenanceAI: api_url must not be empty.")
        if not api_key.startswith("prov_live_"):
            logger.warning(f"ProvenanceAI: API key should start with 'prov_live_'. Generate a key at {api_url.rstrip('/')}/sdk")
        if not pipeline_id:
            logger.warning("ProvenanceAI: pipeline_id must not be empty.")
            
        self._api_url = api_url.rstrip("/")
        self._api_key = api_key
        self._pipeline_id = pipeline_id
        
        self._ingestion = ProvenanceIngestionInterceptor(self._api_url, self._api_key, self._pipeline_id)
        self._prompt = ProvenancePromptTracer(self._api_url, self._api_key)
        
        self._http = httpx.Client(
            timeout=15.0,
            headers={"X-Provenance-API-Key": self._api_key}
        )
        logger.info(f"ProvenanceAI SDK initialized. Pipeline: {pipeline_id}. Backend: {api_url}")
        
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
        try:
            self._http.post(
                f"{self._api_url}/api/response",
                json={
                    "sessionId": session_id,
                    "queryText": "",
                    "retrievedEmbeddingIds": [],
                    "promptHash": "unknown_prompt",
                    "responseText": response_text,
                    "responseHash": response_hash,
                    "modelVersion": model_version
                }
            )
        except Exception as e:
            logger.warning(f"Failed to record response: {e}")
            return None
            
    def verify_connection(self) -> bool:
        try:
            res = self._http.get(f"{self._api_url}/health")
            if res.status_code == 200:
                logger.info("ProvenanceAI: Backend connection verified.")
                return True
            else:
                logger.warning(f"ProvenanceAI: Backend returned status code {res.status_code}")
                return False
        except Exception as e:
            logger.warning(f"ProvenanceAI: Failed to verify connection: {e}")
            return False
