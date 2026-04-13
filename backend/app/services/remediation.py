"""Remediation Engine — the brain of ProvenanceAI's automated response system.

Receives a sourceRecordId, performs semantic diff analysis, classifies
the change, decides on quarantine/alert actions, creates incidents,
and dispatches notifications — all automatically with zero human input.
"""

import hashlib
import logging
import os
from datetime import datetime, timezone
from difflib import SequenceMatcher

from app.core.db import prisma

logger = logging.getLogger("provenance.remediation")

# ── Configurable thresholds from env vars ─────────────────────────────────────
# Higher threshold = more similar required to NOT quarantine = more aggressive
THRESHOLD_FORMATTING = float(os.environ.get("SEMANTIC_DIFF_THRESHOLD_FORMATTING", "0.95"))
THRESHOLD_ADDITIVE = float(os.environ.get("SEMANTIC_DIFF_THRESHOLD_ADDITIVE", "0.70"))
THRESHOLD_MODIFIED = float(os.environ.get("SEMANTIC_DIFF_THRESHOLD_MODIFIED", "0.40"))


def _read_file_content(path: str) -> str | None:
    """Read the first 200 chars of a file for semantic diff. Returns None if inaccessible."""
    try:
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                return f.read(200)
    except Exception:
        pass
    return None


def _hash_file(path: str) -> str | None:
    """Compute SHA-256 of a file. Returns None if file not found."""
    if not os.path.isfile(path):
        return None
    sha = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha.update(chunk)
    return sha.hexdigest()


def _classify_change(ratio: float) -> tuple[str, str, str]:
    """Classify the semantic diff ratio into change type, action, and severity.

    Returns: (change_type, action, severity)
    """
    if ratio > THRESHOLD_FORMATTING:
        return "FORMATTING", "LOW_PRIORITY_ALERT", "low"
    elif ratio > THRESHOLD_ADDITIVE:
        return "ADDITIVE", "MONITOR", "medium"
    elif ratio > THRESHOLD_MODIFIED:
        return "MODIFIED", "QUARANTINE_AND_REINGEST", "high"
    else:
        return "CONTRADICTORY", "EMERGENCY_QUARANTINE", "critical"


class RemediationEngine:
    """Automated remediation engine for ProvenanceAI.

    Receives a sourceRecordId and executes a 6-step remediation flow:
    1. Load context (source record + embeddings)
    2. Semantic diff (difflib SequenceMatcher)
    3. Classify change (FORMATTING/ADDITIVE/MODIFIED/CONTRADICTORY)
    4. Execute action (quarantine, mark stale, etc.)
    5. Compute blast radius (how many LLM responses affected)
    6. Create incident + dispatch alerts
    """

    @staticmethod
    async def handle_staleness(source_record_id: str):
        """Main entry point — handle a staleness event for a source record.

        Args:
            source_record_id: The Prisma ID of the SourceRecord.

        Returns:
            The created Incident record, or None if the source was not found.
        """
        try:
            return await RemediationEngine._execute_remediation(source_record_id)
        except Exception as e:
            logger.error(
                "RemediationEngine.handle_staleness failed for %s: %s",
                source_record_id, e, exc_info=True
            )
            return None

    @staticmethod
    async def _execute_remediation(source_record_id: str):
        """Internal: Execute the full 6-step remediation flow."""

        # ── STEP 1: Load context ──────────────────────────────────────────────
        record = await prisma.sourcerecord.find_unique(
            where={"id": source_record_id},
            include={"embeddings": True}
        )
        if not record:
            logger.warning("RemediationEngine: SourceRecord %s not found", source_record_id)
            return None

        embeddings = record.embeddings or []
        total_embeddings = len(embeddings)
        stale_embeddings = sum(1 for e in embeddings if e.isStale)
        logger.info(
            "Remediation step 1: Loaded %s — %d embeddings (%d stale)",
            record.sourceId, total_embeddings, stale_embeddings
        )

        # ── STEP 2: Semantic diff ─────────────────────────────────────────────
        # Try to read current file content for comparison
        new_preview = _read_file_content(record.sourceId)
        old_preview = record.contentPreview or ""

        if new_preview is not None:
            ratio = SequenceMatcher(None, old_preview, new_preview).ratio()
        else:
            # File not accessible — use hash comparison only
            # If we're here, staleness was detected by hash mismatch,
            # so treat as MODIFIED by default
            current_hash = _hash_file(record.sourceId)
            if current_hash and current_hash != record.contentHash:
                ratio = 0.5  # Assume moderate change
            else:
                ratio = 0.3  # File gone or significantly different
            logger.info(
                "File not accessible for %s — using hash-based estimate, ratio=%.2f",
                record.sourceId, ratio
            )

        logger.info(
            "Remediation step 2: Semantic diff for %s — ratio=%.4f",
            record.sourceId, ratio
        )

        # ── STEP 3: Classify change ───────────────────────────────────────────
        change_type, action, severity = _classify_change(ratio)
        logger.info(
            "Remediation step 3: %s classified as %s (ratio=%.4f) — action: %s, severity: %s",
            record.sourceId, change_type, ratio, action, severity
        )

        # ── STEP 4: Execute action ────────────────────────────────────────────
        if action == "LOW_PRIORITY_ALERT":
            # Formatting change — mark stale but don't quarantine
            await prisma.embedding.update_many(
                where={"parentSourceRecordId": source_record_id},
                data={"isStale": True}
            )
            logger.info(
                "Formatting change detected in %s — no quarantine needed",
                record.sourceId
            )

        elif action == "MONITOR":
            # Additive — mark stale, don't quarantine
            await prisma.embedding.update_many(
                where={"parentSourceRecordId": source_record_id},
                data={"isStale": True}
            )
            logger.info(
                "Additive change in %s — monitoring, no quarantine",
                record.sourceId
            )

        elif action == "QUARANTINE_AND_REINGEST":
            # Modified — quarantine + trigger reingest
            await prisma.embedding.update_many(
                where={"parentSourceRecordId": source_record_id},
                data={"isStale": True}
            )
            await prisma.sourcerecord.update(
                where={"id": source_record_id},
                data={"isQuarantined": True, "pendingReingest": True}
            )
            # Create quarantine record
            await prisma.quarantinerecord.create(
                data={
                    "sourceRecordId": source_record_id,
                    "reason": f"Auto-quarantine: {change_type} change (diff={ratio:.4f})",
                    "quarantinedBy": "remediation_engine"
                }
            )
            logger.info(
                "Significant change in %s — quarantined %d embeddings, re-ingestion triggered",
                record.sourceId, total_embeddings
            )

        elif action == "EMERGENCY_QUARANTINE":
            # Contradictory — immediate quarantine
            await prisma.embedding.update_many(
                where={"parentSourceRecordId": source_record_id},
                data={"isStale": True}
            )
            await prisma.sourcerecord.update(
                where={"id": source_record_id},
                data={"isQuarantined": True, "pendingReingest": True}
            )
            await prisma.quarantinerecord.create(
                data={
                    "sourceRecordId": source_record_id,
                    "reason": f"EMERGENCY: {change_type} change (diff={ratio:.4f})",
                    "quarantinedBy": "remediation_engine"
                }
            )
            logger.warning(
                "CRITICAL: Contradictory change in %s — emergency quarantine",
                record.sourceId
            )

        # ── STEP 5: Compute blast radius ──────────────────────────────────────
        # Count distinct LLMResponse records that used any embedding from this source.
        # Join: SourceRecord → Embedding → RetrievalEventEmbedding →
        #        RetrievalEvent → PromptContext → LLMResponse
        blast_radius = 0
        try:
            embedding_ids = [e.id for e in embeddings]
            if embedding_ids:
                # Query RetrievalEventEmbeddings linked to our embeddings
                rev_embeddings = await prisma.retrievaleventembedding.find_many(
                    where={"embeddingId": {"in": embedding_ids}},
                    include={
                        "retrievalEvent": {
                            "include": {
                                "promptContexts": {
                                    "include": {
                                        "llmResponses": True
                                    }
                                }
                            }
                        }
                    }
                )
                # Count unique LLMResponse IDs
                response_ids = set()
                for rev_emb in rev_embeddings:
                    if rev_emb.retrievalEvent and rev_emb.retrievalEvent.promptContexts:
                        for pc in rev_emb.retrievalEvent.promptContexts:
                            if pc.llmResponses:
                                for resp in pc.llmResponses:
                                    response_ids.add(resp.id)
                blast_radius = len(response_ids)
        except Exception as e:
            logger.warning("Failed to compute blast radius for %s: %s", record.sourceId, e)

        if blast_radius > 0:
            logger.warning(
                "Blast radius for %s: %d past LLM responses used stale data",
                record.sourceId, blast_radius
            )

        # ── STEP 6: Create incident ───────────────────────────────────────────
        incident = await prisma.incident.create(
            data={
                "sourceRecordId": source_record_id,
                "status": "active",
                "severity": severity,
                "changeType": change_type,
                "semanticDiffScore": ratio,
                "action": action,
                "embeddingsAffected": total_embeddings,
                "blastRadius": blast_radius,
            }
        )
        logger.info(
            "Incident created: id=%s source=%s severity=%s action=%s blast_radius=%d",
            incident.id, record.sourceId, severity, action, blast_radius
        )

        # Dispatch alert
        try:
            from app.services.alert_dispatcher import AlertDispatcher
            immediate = severity in ("high", "critical")
            await AlertDispatcher.fire(incident.id, immediate=immediate)
        except Exception as e:
            logger.error("Failed to dispatch alert for incident %s: %s", incident.id, e)

        return incident
