from fastapi import APIRouter
from app.core.db import prisma
from app.models.schemas import LLMResponseCreate

router = APIRouter(tags=["response"])

@router.post("/response")
async def create_response(request: LLMResponseCreate):
    # Creates the full chain in one transaction:
    # RetrievalEvent -> RetrievalEventEmbedding entries -> PromptContext -> LLMResponse
    retrieval_event = await prisma.retrievalevent.create(
        data={
            "sessionId": request.sessionId,
            "queryText": request.queryText,
            "embeddings": {
                "create": [
                    {"embeddingId": emb_id} for emb_id in request.retrievedEmbeddingIds
                ]
            },
            "promptContexts": {
                "create": [
                    {
                        "promptHash": request.promptHash,
                        "llmResponses": {
                            "create": [
                                {
                                    "responseText": request.responseText,
                                    "responseHash": request.responseHash,
                                    "modelVersion": request.modelVersion
                                }
                            ]
                        }
                    }
                ]
            }
        },
        include={
            "promptContexts": {
                "include": {
                    "llmResponses": True
                }
            }
        }
    )
    
    # Extract the LLMResponse ID that was just created deep in the chain
    llm_response_id = retrieval_event.promptContexts[0].llmResponses[0].id
    return {"id": llm_response_id}
