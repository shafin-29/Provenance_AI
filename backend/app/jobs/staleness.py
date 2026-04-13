"""Staleness detection background job.

Checks source files on disk and compares their SHA-256 hash against
the stored contentHash — marking stale records if changed.
"""

import hashlib
import logging
import os
from datetime import datetime

from app.core.db import prisma

logger = logging.getLogger("provenance.staleness")


def _hash_file(path: str) -> str | None:
    """Compute SHA-256 of a file. Returns None if file not found."""
    if not os.path.isfile(path):
        return None
    sha = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha.update(chunk)
    return sha.hexdigest()


async def run_staleness_check() -> dict:
    """Core staleness check logic — used by both scheduler and manual trigger."""
    logger.info("Starting staleness check...")

    # Fetch all non-stale records
    records = await prisma.sourcerecord.find_many(
        where={"isStale": False},
        include={
            "embeddings": {
                "include": {
                    "retrievalEvents": {
                        "include": {
                            "retrievalEvent": True
                        }
                    }
                }
            }
        }
    )

    checked = 0
    marked_stale = 0
    alerts_created = []

    for record in records:
        checked += 1
        current_hash = _hash_file(record.sourceId)

        # Skip if file doesn't exist (can't verify)
        if current_hash is None:
            continue
            
        pipeline_id = record.pipelineId
        
        affected_sessions = set()
        for emb in (record.embeddings or []):
            for rev_emb in (emb.retrievalEvents or []):
                re = rev_emb.retrievalEvent
                if re and re.sessionId:
                    affected_sessions.add(re.sessionId)
        
        affected_sessions_count = len(affected_sessions)

        if current_hash != record.contentHash:
            # Mark SourceRecord stale
            await prisma.sourcerecord.update(
                where={"id": record.id},
                data={"isStale": True}
            )

            # Mark all linked Embeddings stale
            result = await prisma.embedding.update_many(
                where={"parentSourceRecordId": record.id},
                data={"isStale": True}
            )
            emb_count = result if isinstance(result, int) else getattr(result, "count", 0)

            # Create StalenessAlert record
            alert = await prisma.stalenessalert.create(
                data={
                    "sourceRecordId": record.id,
                    "previousHash": record.contentHash,
                    "currentHash": current_hash,
                    "embeddingsMarked": emb_count,
                }
            )
            alerts_created.append({
                "id": alert.id,
                "sourceRecordId": record.id,
                "sourceId": record.sourceId,
                "pipelineId": pipeline_id,
                "detectedAt": alert.detectedAt.isoformat(),
                "previousHash": alert.previousHash,
                "currentHash": alert.currentHash,
                "embeddingsMarked": alert.embeddingsMarked,
                "affectedSessions": affected_sessions_count,
                "resolvedAt": None,
            })
            marked_stale += 1
            logger.warning(
                "STALE: %s — hash mismatch (stored=%s, current=%s)",
                record.sourceId,
                record.contentHash[:12],
                current_hash[:12],
            )

    logger.info(
        "Staleness check complete. %d checked, %d marked stale.",
        checked,
        marked_stale,
    )

    # Delegate to Remediation Engine for semantic diff, classification,
    # quarantine decisions, incident creation, and alerting.
    # This replaces the old direct email dispatch.
    if marked_stale > 0:
        try:
            from app.services.remediation import RemediationEngine
            for alert_info in alerts_created:
                source_record_id = alert_info.get("sourceRecordId")
                if source_record_id:
                    try:
                        incident = await RemediationEngine.handle_staleness(source_record_id)
                        if incident:
                            logger.info(
                                "Remediation completed for %s — incident=%s severity=%s",
                                alert_info.get("sourceId"), incident.id, incident.severity
                            )
                    except Exception as e:
                        logger.error(
                            "Remediation failed for %s: %s",
                            alert_info.get("sourceId"), e
                        )
        except Exception as e:
            logger.error("Failed to import RemediationEngine: %s", e)

    return {
        "checked": checked,
        "markedStale": marked_stale,
        "alerts": alerts_created,
    }

