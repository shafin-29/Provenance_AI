from fastapi import APIRouter, HTTPException, Response
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

@router.post("/traces/{session_id}/export")
async def export_trace(session_id: str):
    trace_data = await get_trace(session_id)
    # Convert prisma model to pure json string
    trace_json = trace_data.model_dump_json() if hasattr(trace_data, 'model_dump_json') else trace_data.json()
    return Response(
        content=trace_json,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="trace_{session_id}.json"'}
    )
