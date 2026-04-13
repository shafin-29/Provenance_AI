import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.db import prisma

logger = logging.getLogger("provenance.quarantine")

router = APIRouter(tags=["quarantine"])

class QuarantineReq(BaseModel):
    sourceId: str
    reason: str = "manual"

@router.post("/quarantine")
async def add_quarantine(req: QuarantineReq):
    # Verify sourcerecord exists
    record = await prisma.sourcerecord.find_first(where={"sourceId": req.sourceId})
    if not record:
        raise HTTPException(status_code=404, detail="SourceRecord not found")

    # Update source record
    await prisma.sourcerecord.update(
        where={"id": record.id},
        data={
            "isQuarantined": True,
            "isStale": True
        }
    )
    
    # Create quarantine record
    await prisma.quarantinerecord.create(
        data={
            "sourceRecordId": record.id,
            "reason": req.reason,
            "quarantinedBy": "sdk/api"
        }
    )
    
    return {"quarantined": True, "sourceId": req.sourceId}

@router.delete("/quarantine/{source_id}")
async def remove_quarantine(source_id: str):
    record = await prisma.sourcerecord.find_first(where={"sourceId": source_id})
    if not record:
        raise HTTPException(status_code=404, detail="SourceRecord not found")

    await prisma.sourcerecord.update(
        where={"id": record.id},
        data={
            "isQuarantined": False
        }
    )
    
    # Close active quarantine records
    await prisma.quarantinerecord.update_many(
        where={
            "sourceRecordId": record.id,
            "restoredAt": None
        },
        data={
            "restoredAt": datetime.now(timezone.utc)
        }
    )
    
    return {"restored": True, "sourceId": source_id}

@router.get("/quarantine")
async def list_quarantine():
    records = await prisma.quarantinerecord.find_many(
        where={
            "restoredAt": None
        },
        include={
            "sourceRecord": True
        }
    )
    
    return [
        {
            "sourceId": r.sourceRecord.sourceId if r.sourceRecord else "unknown",
            "reason": r.reason,
            "quarantinedAt": r.quarantinedAt,
            "quarantinedBy": r.quarantinedBy
        }
        for r in records
    ]
