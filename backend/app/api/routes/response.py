import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import List, Optional
from app.core.db import prisma
from app.core.auth import get_auth
from fastapi import Depends

logger = logging.getLogger("provenance.response")

router = APIRouter(tags=["response"])


class LLMResponseCreate(BaseModel):
    sessionId: str
    queryText: str
    retrievedEmbeddingIds: List[str]
    promptHash: str
    responseText: str
    responseHash: Optional[str] = None
    modelVersion: str

    @validator("sessionId")
    def session_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("sessionId must not be empty")
        return v.strip()

    @validator("modelVersion")
    def model_version_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("modelVersion must not be empty")
        return v.strip()


@router.post("/response")
async def create_response(request: LLMResponseCreate):
    # Build response hash if not provided
    from app.core.db import prisma as db
    import hashlib
    response_hash = request.responseHash or hashlib.sha256(request.responseText.encode()).hexdigest()

    try:
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
                                        "responseHash": response_hash,
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
    except Exception as e:
        logger.error("Failed to create response chain: %s", e)
        raise HTTPException(status_code=503, detail={"error": "Database error", "code": "DATABASE_ERROR", "detail": None})

    llm_response_id = retrieval_event.promptContexts[0].llmResponses[0].id
    logger.info("Response chain created: session=%s responseId=%s", request.sessionId, llm_response_id)
    return {"id": llm_response_id}
