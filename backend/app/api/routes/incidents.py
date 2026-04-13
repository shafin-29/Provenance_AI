"""Incidents API routes — CRUD for the Incident model.

Provides endpoints for listing, viewing, resolving, acknowledging incidents,
and fetching aggregate stats for the dashboard.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.core.db import prisma

logger = logging.getLogger("provenance.incidents")

router = APIRouter(tags=["incidents"])


class ResolveRequest(BaseModel):
    resolvedBy: str = "manual"
    notes: Optional[str] = None


# ── GET /api/incidents/stats ──────────────────────────────────────────────────
# Must be defined BEFORE /{incident_id} to avoid "stats" being treated as an ID.
@router.get("/incidents/stats")
async def get_incident_stats():
    """Returns aggregate stats for the dashboard."""
    try:
        # All active incidents
        active_incidents = await prisma.incident.find_many(
            where={"status": {"not": "resolved"}}
        )

        critical_count = sum(1 for i in active_incidents if i.severity == "critical")
        high_count = sum(1 for i in active_incidents if i.severity == "high")
        medium_count = sum(1 for i in active_incidents if i.severity == "medium")
        low_count = sum(1 for i in active_incidents if i.severity == "low")
        total_blast_radius = sum(i.blastRadius for i in active_incidents)

        # Resolved this week
        one_week_ago = datetime.now(timezone.utc) - timedelta(weeks=1)
        resolved_this_week_list = await prisma.incident.find_many(
            where={
                "status": "resolved",
                "resolvedAt": {"gte": one_week_ago}
            }
        )
        resolved_this_week = len(resolved_this_week_list)

        # Average resolution time (hours) for all resolved incidents
        all_resolved = await prisma.incident.find_many(
            where={
                "status": "resolved",
                "resolvedAt": {"not": None}
            }
        )
        if all_resolved:
            total_hours = 0.0
            counted = 0
            for inc in all_resolved:
                if inc.resolvedAt and inc.createdAt:
                    resolved_at = inc.resolvedAt
                    created_at = inc.createdAt
                    # Ensure timezone-aware
                    if resolved_at.tzinfo is None:
                        resolved_at = resolved_at.replace(tzinfo=timezone.utc)
                    if created_at.tzinfo is None:
                        created_at = created_at.replace(tzinfo=timezone.utc)
                    delta = resolved_at - created_at
                    total_hours += delta.total_seconds() / 3600
                    counted += 1
            avg_resolution_hours = round(total_hours / counted, 2) if counted > 0 else 0
        else:
            avg_resolution_hours = 0

        return {
            "activeIncidents": len(active_incidents),
            "criticalCount": critical_count,
            "highCount": high_count,
            "mediumCount": medium_count,
            "lowCount": low_count,
            "resolvedThisWeek": resolved_this_week,
            "avgResolutionHours": avg_resolution_hours,
            "totalBlastRadius": total_blast_radius,
        }
    except Exception as e:
        logger.error("Failed to fetch incident stats: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch incident stats")


# ── GET /api/incidents ────────────────────────────────────────────────────────
@router.get("/incidents")
async def list_incidents(
    status: Optional[str] = Query(None, description="Filter by status: active|resolved|acknowledged"),
    severity: Optional[str] = Query(None, description="Filter by severity: low|medium|high|critical"),
    limit: int = Query(50, ge=1, le=200),
):
    """Returns all incidents ordered by createdAt desc."""
    where = {}
    if status:
        where["status"] = status
    if severity:
        where["severity"] = severity

    incidents = await prisma.incident.find_many(
        where=where,
        order={"createdAt": "desc"},
        take=limit,
        include={"sourceRecord": True}
    )

    return [
        {
            "id": inc.id,
            "sourceId": inc.sourceRecord.sourceId if inc.sourceRecord else None,
            "status": inc.status,
            "severity": inc.severity,
            "changeType": inc.changeType,
            "semanticDiffScore": inc.semanticDiffScore,
            "action": inc.action,
            "embeddingsAffected": inc.embeddingsAffected,
            "blastRadius": inc.blastRadius,
            "alertSent": inc.alertSent,
            "resolvedAt": inc.resolvedAt,
            "createdAt": inc.createdAt,
            "pendingReingest": inc.sourceRecord.pendingReingest if inc.sourceRecord else False,
        }
        for inc in incidents
    ]


# ── GET /api/incidents/{incident_id} ──────────────────────────────────────────
@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str):
    """Returns full incident detail including source record and shield events."""
    incident = await prisma.incident.find_unique(
        where={"id": incident_id},
        include={
            "sourceRecord": True,
            "shieldEvents": {
                "order_by": {"createdAt": "asc"}
            }
        }
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Build timeline from shield events
    timeline = []
    if incident.shieldEvents:
        for event in incident.shieldEvents:
            timeline.append({
                "id": event.id,
                "eventType": event.eventType,
                "sourceId": event.sourceId,
                "createdAt": event.createdAt,
                "payload": event.payload,
            })

    # Add incident creation event to timeline
    timeline.insert(0, {
        "id": incident.id,
        "eventType": "incident.created",
        "sourceId": incident.sourceRecord.sourceId if incident.sourceRecord else None,
        "createdAt": incident.createdAt,
        "payload": {
            "severity": incident.severity,
            "changeType": incident.changeType,
            "action": incident.action,
        },
    })

    # Add resolution event if resolved
    if incident.resolvedAt:
        timeline.append({
            "id": f"{incident.id}_resolved",
            "eventType": "incident.resolved",
            "sourceId": incident.sourceRecord.sourceId if incident.sourceRecord else None,
            "createdAt": incident.resolvedAt,
            "payload": {
                "resolvedBy": incident.resolvedBy,
                "notes": incident.notes,
            },
        })

    source_dict = None
    if incident.sourceRecord:
        sr = incident.sourceRecord
        source_dict = {
            "id": sr.id,
            "sourceId": sr.sourceId,
            "contentHash": sr.contentHash,
            "pipelineId": sr.pipelineId,
            "isStale": sr.isStale,
            "isQuarantined": sr.isQuarantined,
            "pendingReingest": sr.pendingReingest,
            "createdAt": sr.createdAt,
            "updatedAt": sr.updatedAt,
        }

    return {
        "id": incident.id,
        "sourceRecordId": incident.sourceRecordId,
        "sourceRecord": source_dict,
        "status": incident.status,
        "severity": incident.severity,
        "changeType": incident.changeType,
        "semanticDiffScore": incident.semanticDiffScore,
        "action": incident.action,
        "embeddingsAffected": incident.embeddingsAffected,
        "blastRadius": incident.blastRadius,
        "alertSent": incident.alertSent,
        "alertSentAt": incident.alertSentAt,
        "resolvedAt": incident.resolvedAt,
        "resolvedBy": incident.resolvedBy,
        "notes": incident.notes,
        "createdAt": incident.createdAt,
        "updatedAt": incident.updatedAt,
        "timeline": timeline,
    }


# ── POST /api/incidents/{incident_id}/resolve ─────────────────────────────────
@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str, req: ResolveRequest):
    """Resolve an incident — sets status=resolved, resolvedAt=now()."""
    incident = await prisma.incident.find_unique(where={"id": incident_id})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    await prisma.incident.update(
        where={"id": incident_id},
        data={
            "status": "resolved",
            "resolvedAt": datetime.now(timezone.utc),
            "resolvedBy": req.resolvedBy,
            "notes": req.notes,
        }
    )
    return {"resolved": True}


# ── POST /api/incidents/{incident_id}/acknowledge ─────────────────────────────
@router.post("/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(incident_id: str):
    """Acknowledge an incident — sets status=acknowledged."""
    incident = await prisma.incident.find_unique(where={"id": incident_id})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    await prisma.incident.update(
        where={"id": incident_id},
        data={"status": "acknowledged"}
    )
    return {"acknowledged": True}
