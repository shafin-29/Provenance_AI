"""Test-only helper routes for E2E testing. Only active in development."""

import logging
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.db import prisma

logger = logging.getLogger("provenance.test")

router = APIRouter(tags=["test"])


class CreateEmbeddingRequest(BaseModel):
    parentSourceRecordId: str
    chunkIndex: Optional[int] = 0
    vectorDbId: Optional[str] = "test-vector-id"
    embeddingModel: Optional[str] = "text-embedding-ada-002"


@router.post("/test/embedding")
async def create_test_embedding(req: CreateEmbeddingRequest):
    """E2E test helper: Create an embedding record directly."""
    # Verify source record exists
    record = await prisma.sourcerecord.find_unique(where={"id": req.parentSourceRecordId})
    if not record:
        raise HTTPException(status_code=404, detail="SourceRecord not found")

    embedding = await prisma.embedding.create(
        data={
            "parentSourceRecordId": req.parentSourceRecordId,
            "chunkIndex": req.chunkIndex or 0,
            "vectorDbId": req.vectorDbId or "test-vector-id",
            "embeddingModel": req.embeddingModel or "text-embedding-ada-002",
        }
    )
    logger.info("Test embedding created: id=%s parentSource=%s", embedding.id, req.parentSourceRecordId)
    return {"id": embedding.id, "parentSourceRecordId": embedding.parentSourceRecordId}
