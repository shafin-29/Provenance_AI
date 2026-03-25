import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.core.db import prisma
from app.core.auth import get_auth

router = APIRouter()

class CreateKeyRequest(BaseModel):
    name: str
    pipelineId: str

class ValidateKeyRequest(BaseModel):
    key: str

@router.post("")
async def create_api_key(req: CreateKeyRequest, auth: dict = Depends(get_auth)):
    # Only Clerk users can create keys
    if auth.get("type") != "user":
        raise HTTPException(status_code=403, detail="Only users can create API keys")
        
    clerk_user_id = auth["clerkUserId"]
    
    # Generate key
    raw_key = "prov_live_" + secrets.token_urlsafe(24)
    
    # Save to db
    api_key = await prisma.apikey.create(
        data={
            "key": raw_key,
            "name": req.name,
            "pipelineId": req.pipelineId,
            "clerkUserId": clerk_user_id
        }
    )
    
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
        where={
            "clerkUserId": clerk_user_id
        },
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
    
    return {"revoked": True}

@router.post("/validate")
async def validate_api_key(req: ValidateKeyRequest):
    # Public route
    key_record = await prisma.apikey.find_unique(where={"key": req.key})
    
    if key_record and key_record.isActive:
        # Update lastUsedAt
        await prisma.apikey.update(
            where={"id": key_record.id},
            data={"lastUsedAt": datetime.utcnow()} # We can use prisma generated fields but this works
        )
        return {"valid": True, "pipelineId": key_record.pipelineId}
        
    return {"valid": False}
