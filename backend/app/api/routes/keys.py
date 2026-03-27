import secrets
import logging
import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import datetime
from app.core.db import prisma
from app.core.auth import get_auth

logger = logging.getLogger("provenance.keys")

router = APIRouter()

# ── Simple In-Memory Rate Limiter ─────────────────────────────────────────────
_rate_store: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(key: str, max_requests: int, window_seconds: int = 60) -> None:
    """Raises HTTPException(429) if the request rate exceeds limits."""
    now = time.time()
    timestamps = _rate_store[key]
    # Remove timestamps outside of window
    _rate_store[key] = [t for t in timestamps if now - t < window_seconds]
    if len(_rate_store[key]) >= max_requests:
        retry_after = int(window_seconds - (now - _rate_store[key][0]))
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "code": "RATE_LIMITED",
                "retryAfter": max(retry_after, 1),
            },
        )
    _rate_store[key].append(now)


class CreateKeyRequest(BaseModel):
    name: str
    pipelineId: str

    @validator("name")
    def name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("name must not be empty")
        return v.strip()

    @validator("pipelineId")
    def pipeline_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("pipelineId must not be empty")
        return v.strip()


class ValidateKeyRequest(BaseModel):
    key: str


@router.post("")
async def create_api_key(req: CreateKeyRequest, request: Request, auth: dict = Depends(get_auth)):
    # Rate limit: 10 per minute per IP
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"create_key:{client_ip}", max_requests=10)

    # Only Clerk users can create keys
    if auth.get("type") != "user":
        raise HTTPException(status_code=403, detail="Only users can create API keys")

    clerk_user_id = auth["clerkUserId"]

    # Generate key
    raw_key = "prov_live_" + secrets.token_urlsafe(24)

    try:
        api_key = await prisma.apikey.create(
            data={
                "key": raw_key,
                "name": req.name,
                "pipelineId": req.pipelineId,
                "clerkUserId": clerk_user_id
            }
        )
    except Exception as e:
        logger.error("Failed to create API key: %s", e)
        raise HTTPException(status_code=503, detail={"error": "Database error", "code": "DATABASE_ERROR", "detail": None})

    logger.info("API key created: name=%s pipeline=%s user=%s", req.name, req.pipelineId, clerk_user_id)

    return {
        "id": api_key.id,
        "key": raw_key,
        "name": api_key.name,
        "pipelineId": api_key.pipelineId,
        "createdAt": api_key.createdAt
    }


@router.get("")
async def list_api_keys(auth: dict = Depends(get_auth)):
    if auth.get("type") != "user":
        raise HTTPException(status_code=403, detail="Only users can list API keys")

    clerk_user_id = auth["clerkUserId"]

    keys = await prisma.apikey.find_many(
        where={"clerkUserId": clerk_user_id},
        order={"createdAt": "desc"}
    )

    result = []
    for k in keys:
        if k.key.startswith("prov_live_"):
            preview = k.key[:16] + "..."
        else:
            preview = "..."

        result.append({
            "id": k.id,
            "keyPreview": preview,
            "name": k.name,
            "pipelineId": k.pipelineId,
            "createdAt": k.createdAt,
            "lastUsedAt": k.lastUsedAt,
            "isActive": k.isActive
        })

    return result


@router.delete("/{key_id}")
async def revoke_api_key(key_id: str, auth: dict = Depends(get_auth)):
    if auth.get("type") != "user":
        raise HTTPException(status_code=403, detail="Only users can revoke API keys")

    clerk_user_id = auth["clerkUserId"]

    key = await prisma.apikey.find_unique(where={"id": key_id})
    if not key or key.clerkUserId != clerk_user_id:
        raise HTTPException(status_code=404, detail="Key not found or access denied")

    await prisma.apikey.update(
        where={"id": key_id},
        data={"isActive": False}
    )

    logger.info("API key revoked: id=%s user=%s", key_id, clerk_user_id)
    return {"revoked": True}


@router.post("/validate")
async def validate_api_key(req: ValidateKeyRequest, request: Request):
    # Rate limit: 60 per minute per IP
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"validate_key:{client_ip}", max_requests=60)

    # Never log the full key — only a short preview
    key_preview = req.key[:16] + "..." if len(req.key) > 16 else "***"

    key_record = await prisma.apikey.find_unique(where={"key": req.key})

    if key_record and key_record.isActive:
        await prisma.apikey.update(
            where={"id": key_record.id},
            data={"lastUsedAt": datetime.utcnow()}
        )
        logger.info("API key validation: %s → valid", key_preview)
        return {"valid": True, "pipelineId": key_record.pipelineId}

    logger.warning("API key validation: %s → invalid", key_preview)
    return {"valid": False}
