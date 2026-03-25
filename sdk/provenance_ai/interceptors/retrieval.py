import logging
import httpx
from provenance_ai.utils.tokens import LineageToken

logger = logging.getLogger(__name__)

class ProvenanceRetriever:
    def __init__(self, base_retriever, api_url: str, api_key: str, session_id: str):
        self.base_retriever = base_retriever
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.session_id = session_id
        self._http = httpx.Client(
            timeout=15.0,
            headers={"X-Provenance-API-Key": self.api_key}
        )
        
    def get_relevant_documents(self, query: str) -> list:
        try:
            docs = self.base_retriever.get_relevant_documents(query)
        except Exception as e:
            logger.warning(f"Error retrieving documents: {e}")
            return []
            
        provenance_source_ids = []
        for doc in docs:
            token = LineageToken.from_metadata(doc.metadata)
            if token is None:
                continue
            src_id = doc.metadata.get("provenance_source_id", "")
            if src_id:
                provenance_source_ids.append(src_id)
                
        try:
            self._http.post(
                f"{self.api_url}/api/response",
                json={
                    "sessionId": self.session_id,
                    "queryText": query,
                    "retrievedEmbeddingIds": provenance_source_ids,
                    "promptHash": "",
                    "responseText": "",
                    "modelVersion": ""
                }
            )
        except Exception as e:
            logger.warning(f"Failed to record retrieval event: {e}")
            
        return docs
        
    async def ainvoke(self, input, config=None):
        try:
            import asyncio
            return await asyncio.to_thread(self.get_relevant_documents, input)
        except Exception as e:
            logger.warning(f"Error in ainvoke: {e}")
            return []
