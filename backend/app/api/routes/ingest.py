import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.db import prisma

logger = logging.getLogger("provenance.ingest")

router = APIRouter(tags=["ingest"])


class IngestRequest(BaseModel):
    sourceId: str
    contentHash: str
    versionTs: datetime
    pipelineId: str
    contentPreview: Optional[str] = None
    chunkIndex: Optional[int] = None
    parentSourceId: Optional[str] = None


@router.post("/ingest")
async def ingest_source(request: IngestRequest):
    try:
        # Build data dict
        data = {
            "sourceId": request.sourceId,
            "contentHash": request.contentHash,
            "versionTs": request.versionTs,
            "pipelineId": request.pipelineId,
        }
        if request.contentPreview is not None:
            data["contentPreview"] = request.contentPreview[:200]

        record = await prisma.sourcerecord.create(data=data)
        logger.info("Ingested source record id=%s sourceId=%s", record.id, request.sourceId)
        return record
    except Exception as e:
        logger.error("Failed to ingest source record: %s", e)
        raise HTTPException(
            status_code=503,
            detail={"error": "Database error during ingestion", "code": "DATABASE_ERROR", "detail": str(e)}
        )
