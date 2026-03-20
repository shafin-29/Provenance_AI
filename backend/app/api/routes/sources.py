from fastapi import APIRouter, HTTPException
from typing import Optional
from app.core.db import prisma

router = APIRouter(tags=["sources"])

@router.get("/sources")
async def get_sources(stale: Optional[bool] = None):
    where_clause = {}
    if stale is not None:
        where_clause["isStale"] = stale
        
    records = await prisma.sourcerecord.find_many(where=where_clause)
    return records

@router.get("/sources/{source_id}")
async def get_source(source_id: str):
    record = await prisma.sourcerecord.find_unique(
        where={"id": source_id},
        include={
            "transformationSteps": True,
            "embeddings": True
        }
    )
    if not record:
        raise HTTPException(status_code=404, detail="SourceRecord not found")
    return record
