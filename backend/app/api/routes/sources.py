from fastapi import APIRouter, HTTPException
from typing import Optional
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from app.core.db import prisma

router = APIRouter(tags=["sources"])

class UpdateSourceReq(BaseModel):
    contentPreview: Optional[str] = None

@router.get("/sources")
async def get_sources(stale: Optional[bool] = None):
    # Use raw query to fetch basic fields + embedding count safely across versions
    query = """
    SELECT s.*, 
           (SELECT COUNT(*) FROM "Embedding" e WHERE e."parentSourceRecordId" = s.id) as "embeddingCount"
    FROM "SourceRecord" s
    """
    if stale is not None:
        query += f" WHERE s.\"isStale\" = {'true' if stale else 'false'}"
    query += " ORDER BY s.\"createdAt\" DESC"
    
    records = await prisma.query_raw(query)
    # Ensure camelCase for NextJS
    mapped = []
    for r in records:
        mapped.append({
            "id": r.get("id"),
            "sourceId": r.get("sourceId"),
            "contentHash": r.get("contentHash"),
            "versionTs": r.get("versionTs"),
            "pipelineId": r.get("pipelineId"),
            "createdAt": r.get("createdAt"),
            "updatedAt": r.get("updatedAt"),
            "isStale": bool(r.get("isStale", False)),
            "isQuarantined": bool(r.get("isQuarantined", False)),
            "contentPreview": r.get("contentPreview"),
            "embeddingCount": int(r.get("embeddingCount", 0))
        })
    return mapped

@router.get("/sources/{source_id}")
async def get_source(source_id: str):
    # query_raw to guarantee contentPreview inclusion bypassing missing generator strict models
    q = 'SELECT * FROM "SourceRecord" WHERE id = $1'
    rec = await prisma.query_raw(q, source_id)
    if not rec:
        raise HTTPException(status_code=404, detail="SourceRecord not found")
    
    source_record = dict(rec[0])
    # Fetch relations
    source_record["transformationSteps"] = await prisma.transformationstep.find_many(where={"sourceRecordId": source_id})
    source_record["embeddings"] = await prisma.embedding.find_many(where={"parentSourceRecordId": source_id})
    
    return source_record

@router.patch("/sources/{source_id}")
async def update_source(source_id: str, req: UpdateSourceReq):
    query = 'UPDATE "SourceRecord" SET "contentPreview" = $1 WHERE id = $2 RETURNING *;'
    res = await prisma.query_raw(query, req.contentPreview, source_id)
    if not res:
        raise HTTPException(status_code=404, detail="SourceRecord not found")
    return res[0]

@router.get("/sources/{source_id}/responses")
async def get_source_responses(source_id: str):
    query = """
    SELECT DISTINCT r.id, e."sessionId", r."responseText", r."modelVersion", r."respondedAt"
    FROM "LLMResponse" r
    JOIN "PromptContext" p ON r."promptContextId" = p.id
    JOIN "RetrievalEvent" e ON p."retrievalEventId" = e.id
    JOIN "RetrievalEventEmbedding" re ON e.id = re."retrievalEventId"
    JOIN "Embedding" emb ON re."embeddingId" = emb.id
    WHERE emb."parentSourceRecordId" = $1
    ORDER BY r."respondedAt" DESC
    LIMIT 50
    """
    res = await prisma.query_raw(query, source_id)
    mapped = []
    for row in res:
        text = str(row.get('responseText', ''))
        mapped.append({
            "id": row.get('id'),
            "sessionId": row.get('sessionId'),
            "responseText": text[:120] + ('...' if len(text)>120 else ''),
            "modelVersion": row.get('modelVersion'),
            "respondedAt": row.get('respondedAt')
        })
    return mapped

@router.get("/sources/{source_id}/impact")
async def get_source_impact(source_id: str):
    chunks = await prisma.query_raw('SELECT count(*) as total, sum(CASE WHEN "isStale" THEN 1 ELSE 0 END) as stale FROM "Embedding" WHERE "parentSourceRecordId" = $1', source_id)
    
    impact_query = """
    SELECT 
      COUNT(DISTINCT e.id) as events,
      COUNT(DISTINCT r.id) as responses,
      MIN(e."retrievedAt") as first_retrieved
    FROM "RetrievalEvent" e
    JOIN "RetrievalEventEmbedding" re ON e.id = re."retrievalEventId"
    JOIN "Embedding" emb ON re."embeddingId" = emb.id
    LEFT JOIN "PromptContext" p ON p."retrievalEventId" = e.id
    LEFT JOIN "LLMResponse" r ON r."promptContextId" = p.id
    WHERE emb."parentSourceRecordId" = $1
    """
    res2 = await prisma.query_raw(impact_query, source_id)
    
    total = int(chunks[0].get('total', 0)) if chunks else 0
    stale = int(chunks[0].get('stale', 0) or 0) if chunks else 0
    
    evs = int(res2[0].get('events', 0)) if res2 else 0
    resps = int(res2[0].get('responses', 0)) if res2 else 0
    first = res2[0].get('first_retrieved') if res2 else None
    
    return {
        "totalChunks": total,
        "staleChunks": stale,
        "totalRetrievalEvents": evs,
        "totalLLMResponses": resps,
        "firstRetrieved": first
    }

@router.post("/sources/{source_id}/reingest")
async def reingest_source(source_id: str):
    record = await prisma.sourcerecord.find_unique(where={"id": source_id})
    if not record:
        raise HTTPException(status_code=404, detail="SourceRecord not found")
        
    new_hash = str(uuid.uuid4())
    
    await prisma.sourcerecord.update(
        where={"id": source_id},
        data={
            "isStale": False,
            "contentHash": new_hash
        }
    )
    
    upd_embs = await prisma.embedding.update_many(
        where={"parentSourceRecordId": source_id},
        data={"isStale": False}
    )
    
    await prisma.stalenessalert.update_many(
        where={
            "sourceRecordId": source_id,
            "resolvedAt": None
        },
        data={"resolvedAt": datetime.now(timezone.utc)}
    )
    
    count = upd_embs if isinstance(upd_embs, int) else getattr(upd_embs, "count", 0)
    return {"reingested": True, "embeddingsCleared": count}
