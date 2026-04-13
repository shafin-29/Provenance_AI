"""Shield Events API — receives async events from the ProvenanceAI Shield SDK.

POST /api/events stores the event and triggers async processing via
EventProcessor in a BackgroundTask. The HTTP response is returned immediately
— all processing happens asynchronously.
"""

import logging
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from app.core.db import prisma

logger = logging.getLogger("provenance.events")

router = APIRouter(tags=["events"])


class ShieldEventReq(BaseModel):
    eventType: str
    pipeline_id: str = ""
    session_id: str = ""
    source_id: str = ""
    # Support arbitrary extra payload fields
    model_config = {"extra": "allow"}


async def _process_event_background(event_type: str, payload: dict) -> None:
    """Background task wrapper for EventProcessor.process.

    This runs AFTER the HTTP response has been returned to the SDK.
    Wrapped in try/except to never crash the FastAPI app.
    """
    try:
        from app.services.event_processor import EventProcessor
        await EventProcessor.process(event_type, payload)
    except Exception as e:
        logger.error("Background event processing failed for %s: %s", event_type, e, exc_info=True)


@router.post("/events")
async def create_event(req: ShieldEventReq, background_tasks: BackgroundTasks):
    """Receives async events from the ProvenanceAI Shield SDK.

    Stores the event in ShieldEvent table and triggers EventProcessor
    as a background task. Returns immediately — processing is async.
    """
    # Build the full payload dict from the request
    raw_payload = req.model_dump()
    event_type = raw_payload.get("eventType", "unknown")
    pipeline_id = raw_payload.get("pipeline_id", "")
    session_id = raw_payload.get("session_id", raw_payload.get("sessionId", ""))
    source_id = raw_payload.get("source_id", raw_payload.get("sourceId", ""))

    # Store directly in ShieldEvent table
    try:
        from prisma import Json
        await prisma.shieldevent.create(
            data={
                "eventType": event_type,
                "pipelineId": pipeline_id,
                "sessionId": session_id,
                "sourceId": source_id,
                "payload": Json(raw_payload),
            }
        )
    except Exception as e:
        logger.warning("Failed to record shield event: %s", e)

    # Trigger async processing via BackgroundTasks
    background_tasks.add_task(_process_event_background, event_type, raw_payload)

    return {"received": True}
