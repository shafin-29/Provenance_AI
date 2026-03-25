import logging
import httpx
from provenance_ai.utils.hashing import compute_text_hash

logger = logging.getLogger(__name__)

class ProvenancePromptTracer:
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self._http = httpx.Client(
            timeout=15.0,
            headers={"X-Provenance-API-Key": api_key}
        )
        
    def trace_prompt(self, session_id: str, prompt_text: str, retrieved_docs: list = None) -> str:
        # 1. Compute prompt hash
        prompt_hash = compute_text_hash(prompt_text)
        # 2. Log the prompt context - no-op for MVP as per instructions
        # 3. Return prompt_text unchanged
        return prompt_text
