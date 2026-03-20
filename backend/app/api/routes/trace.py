from fastapi import APIRouter, HTTPException
from app.core.db import prisma

router = APIRouter(tags=["trace"])

@router.get("/trace/{session_id}")
async def get_trace(session_id: str):
    retrieval_event = await prisma.retrievalevent.find_first(
        where={"sessionId": session_id},
        include={
            "promptContexts": {
                "include": {
                    "llmResponses": True
                }
            },
            "embeddings": {
                "include": {
                    "embedding": {
                        "include": {
                            "parentSourceRecord": True
                        }
                    }
                }
            }
        }
    )
    
    if not retrieval_event:
        raise HTTPException(status_code=404, detail="Trace not found for this session ID")
        
    return retrieval_event
