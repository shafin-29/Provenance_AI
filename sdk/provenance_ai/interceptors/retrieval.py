import asyncio
import logging
import httpx
from provenance_ai.utils.tokens import LineageToken
from provenance_ai.shield import ProvenanceShield, ShieldBlockedError, SafeMode
from provenance_ai.cache import ProvenanceCache

logger = logging.getLogger(__name__)

class ProvenanceRetriever:
    def __init__(self, 
                 base_retriever, 
                 shield: ProvenanceShield,
                 cache: ProvenanceCache,
                 session_id: str,
                 safe_mode: SafeMode):
        self.base_retriever = base_retriever
        self.shield = shield
        self.cache = cache
        self.session_id = session_id
        self.safe_mode = safe_mode
        self._events = getattr(shield.client, "_events", None)

    def _get_relevant_documents(self, query: str, *, run_manager=None) -> list:
        try:
            # Prefer _get_relevant_documents if available, else get_relevant_documents
            if hasattr(self.base_retriever, "_get_relevant_documents"):
                raw_docs = self.base_retriever._get_relevant_documents(query, run_manager=run_manager)
            else:
                raw_docs = self.base_retriever.get_relevant_documents(query)
        except Exception as e:
            logger.warning(f"ProvenanceAI: Error retrieving documents from base retriever: {e}")
            return []

        if not raw_docs:
            return []

        # 2. Inspect with shield
        try:
            shield_result = self.shield.inspect(raw_docs, session_id=self.session_id)
        except ShieldBlockedError as e:
            # 3. If ShieldBlockedError raised (BLOCK mode): re-raise it
            raise e
        except Exception as e:
            logger.warning(f"ProvenanceAI: Shield check failed, passing chunks through. Error: {e}")
            # Fail open
            from provenance_ai.shield import ShieldResult
            shield_result = ShieldResult(chunks=raw_docs, was_protected=False)
            shield_result.decisions = []

        # 3. Handle shield result
        filtered_docs = shield_result.chunks

        # 4. Attach provenance metadata
        for i, doc in enumerate(filtered_docs):
            if not hasattr(doc, "metadata"):
                continue
            
            # Find the decision string if available
            decision_str = "UNKNOWN"
            # It's not guaranteed that chunks ordering is exactly 1:1 if some were substituted,
            # but decisions correspond to the original chunks.
            # actually we can map original doc id if present, but for now we look up original hash or just use decision list
            
            doc.metadata["_provenance"] = {
                "session_id": self.session_id,
                "shield_decision": "UNKNOWN", # Default, ideally match mapped decision
                "was_protected": shield_result.was_protected,
                "incident_id": shield_result.incident_id
            }
            
            # Simple mapping by matching providence metadata
            source_id = doc.metadata.get("provenance_source_id", "unknown")
            content_hash = doc.metadata.get("provenance_content_hash", "")
            
            for d in shield_result.decisions:
                if d.source_id == source_id and d.original_hash == content_hash:
                    doc.metadata["_provenance"]["shield_decision"] = d.decision
                    break

        # 5. Log retrieval event asynchronously to backend
        try:
            if self._events:
                provenance_source_ids = []
                for doc in raw_docs:
                    if hasattr(doc, "metadata"):
                        src_id = doc.metadata.get("provenance_source_id")
                        if src_id:
                            provenance_source_ids.append(src_id)
                self._events.emit("retrieval.event", {
                    "sessionId": self.session_id,
                    "queryText": query,
                    "retrievedEmbeddingIds": provenance_source_ids,
                    "promptHash": "",
                    "responseText": "",
                    "modelVersion": "",
                    "was_protected": shield_result.was_protected,
                    "shield_latency_ms": shield_result.shield_latency_ms
                })
        except Exception as e:
            logger.warning(f"ProvenanceAI: Failed to emit retrieval event: {e}")

        # 6. Return filtered chunks
        return filtered_docs

    def get_relevant_documents(self, query: str, **kwargs) -> list:
        return self._get_relevant_documents(query, **kwargs)

    async def _aget_relevant_documents(self, query: str, *, run_manager=None) -> list:
        try:
            return await asyncio.to_thread(self._get_relevant_documents, query, run_manager=run_manager)
        except Exception as e:
            logger.warning(f"ProvenanceAI: Error in aget_relevant_documents: {e}")
            return []

    async def ainvoke(self, input, config=None):
        return await self._aget_relevant_documents(input)

