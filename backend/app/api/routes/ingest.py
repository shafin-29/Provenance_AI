from fastapi import APIRouter
from app.core.db import prisma
from app.models.schemas import IngestRequest

router = APIRouter(tags=["ingest"])

@router.post("/ingest")
async def ingest_source(request: IngestRequest):
    record = await prisma.sourcerecord.create(
        data={
            "sourceId": request.sourceId,
            "contentHash": request.contentHash,
            "versionTs": request.versionTs,
            "pipelineId": request.pipelineId,
        }
    )
    return record
