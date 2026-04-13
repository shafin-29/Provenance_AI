import copy
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Any

# We need the LineageToken to extract the token from document metadata
from provenance_ai.utils.tokens import LineageToken

logger = logging.getLogger(__name__)

class SafeMode(Enum):
    PASS = "pass"
    WARN = "warn"
    SUBSTITUTE = "substitute"
    BLOCK = "block"

@dataclass
class ChunkDecision:
    chunk_index: int
    source_id: str
    decision: str
    original_hash: str
    reason: Optional[str] = None

@dataclass
class ShieldResult:
    chunks: list
    decisions: List[ChunkDecision] = field(default_factory=list)
    was_protected: bool = False
    quarantine_count: int = 0
    substitute_count: int = 0
    stale_passthrough_count: int = 0
    unknown_count: int = 0
    shield_latency_ms: float = 0.0
    incident_id: Optional[str] = None

class ShieldBlockedError(Exception):
    def __init__(self, message: str, incident_id: str, stale_count: int, total_count: int, stale_sources: List[str]):
        super().__init__(message)
        self.message = message
        self.incident_id = incident_id
        self.stale_count = stale_count
        self.total_count = total_count
        self.stale_sources = stale_sources

class ProvenanceShield:
    def __init__(self, client: Any):
        self.client = client
        self.safe_mode = getattr(client, "_safe_mode", SafeMode.SUBSTITUTE)
        self.block_threshold = getattr(client, "_block_threshold", 0.5)
        self.alert_on_quarantine = getattr(client, "_alert_on_quarantine", True)
        self.shield_timeout_ms = getattr(client, "_shield_timeout_ms", 20)
        self.cache = getattr(client, "_cache", None)
        self.events = getattr(client, "_events", None)

    def inspect(self, chunks: list, session_id: str = "") -> ShieldResult:
        start_time = time.perf_counter()
        
        result = ShieldResult(chunks=[])
        decisions = []
        filtered_chunks = []
        stale_quarantine_sources = set()
        
        timeout_seconds = self.shield_timeout_ms / 1000.0

        for i, chunk in enumerate(chunks):
            # Check timeout
            elapsed = time.perf_counter() - start_time
            if elapsed > timeout_seconds:
                logger.warning("ProvenanceAI: Shield timeout exceeded, passing remaining chunks through.")
                # Pass remainder as UNKNOWN
                for j in range(i, len(chunks)):
                    remaining_chunk = chunks[j]
                    src_id = remaining_chunk.metadata.get("provenance_source_id", "unknown") if hasattr(remaining_chunk, "metadata") else "unknown"
                    orig_hash = remaining_chunk.metadata.get("provenance_content_hash", "") if hasattr(remaining_chunk, "metadata") else ""
                    decisions.append(ChunkDecision(
                        chunk_index=j,
                        source_id=src_id,
                        decision="UNKNOWN",
                        original_hash=orig_hash,
                        reason="shield_timeout"
                    ))
                    result.unknown_count += 1
                    filtered_chunks.append(remaining_chunk)
                break

            # 1. Extract lineage token
            has_metadata = hasattr(chunk, "metadata")
            token = LineageToken.from_metadata(chunk.metadata) if has_metadata else None
            
            if not token or not has_metadata:
                decisions.append(ChunkDecision(
                    chunk_index=i,
                    source_id="unknown",
                    decision="UNKNOWN",
                    original_hash="",
                    reason="no_lineage_token"
                ))
                result.unknown_count += 1
                filtered_chunks.append(chunk)
                continue

            source_id = chunk.metadata.get("provenance_source_id", "unknown")
            chunk_hash = chunk.metadata.get("provenance_content_hash", "")
            
            # Use cache if available
            if not self.cache:
                decisions.append(ChunkDecision(
                    chunk_index=i,
                    source_id=source_id,
                    decision="UNKNOWN",
                    original_hash=chunk_hash,
                    reason="cache_unavailable"
                ))
                result.unknown_count += 1
                filtered_chunks.append(chunk)
                continue
                
            # 2. Check quarantine
            is_quarantined = self.cache.is_quarantined(source_id)
            if is_quarantined:
                # Fire async event
                if self.alert_on_quarantine and self.events:
                    self.events.emit("shield.chunk.quarantined", {
                        "pipeline_id": self.client._pipeline_id,
                        "session_id": session_id,
                        "source_id": source_id,
                        "hash": chunk_hash
                    })

                decisions.append(ChunkDecision(
                    chunk_index=i,
                    source_id=source_id,
                    decision="QUARANTINE",
                    original_hash=chunk_hash,
                    reason="source_quarantined"
                ))
                result.quarantine_count += 1
                result.was_protected = True
                stale_quarantine_sources.add(source_id)
                
                # In BLOCK mode we count and filter, in PASS mode we pass through
                if self.safe_mode in [SafeMode.BLOCK, SafeMode.SUBSTITUTE, SafeMode.WARN]:
                    # Substitution for quarantined docs? Usually block or substitute
                    if self.safe_mode == SafeMode.SUBSTITUTE:
                        # Quarantine means we drop it and dont have a substitute (it's manually quarantined)
                        stale_quarantine_sources.add(source_id)
                        # We just drop it from filtered_chunks
                    elif self.safe_mode == SafeMode.BLOCK:
                        pass # count it towards threshold, dropping it
                    elif self.safe_mode == SafeMode.WARN:
                        filtered_chunks.append(chunk) 
                else:
                    filtered_chunks.append(chunk) # PASS

                continue

            # 3. Check staleness
            known_hash = self.cache.get_hash(source_id)
            is_stale = False
            
            if known_hash and chunk_hash:
                if known_hash != chunk_hash:
                    is_stale = True
            elif self.cache.is_stale(source_id):
                is_stale = True

            if not known_hash and not self.cache.is_stale(source_id):
                # We don't have this in cache, default to UNKNOWN
                decisions.append(ChunkDecision(
                    chunk_index=i,
                    source_id=source_id,
                    decision="UNKNOWN",
                    original_hash=chunk_hash,
                    reason="not_in_cache"
                ))
                result.unknown_count += 1
                filtered_chunks.append(chunk)
                continue

            if not is_stale:
                decisions.append(ChunkDecision(
                    chunk_index=i,
                    source_id=source_id,
                    decision="CLEAN",
                    original_hash=chunk_hash,
                    reason="hash_match"
                ))
                if self.events:
                    self.events.emit("shield.chunk.clean", {
                        "pipeline_id": self.client._pipeline_id,
                        "session_id": session_id,
                        "source_id": source_id,
                        "hash": chunk_hash
                    })
                filtered_chunks.append(chunk)
                continue

            # 4. Handle Stale chunk
            stale_quarantine_sources.add(source_id)
            
            if self.events:
                self.events.emit("shield.chunk.stale", {
                    "pipeline_id": self.client._pipeline_id,
                    "session_id": session_id,
                    "source_id": source_id,
                    "hash": chunk_hash
                })

            if self.safe_mode == SafeMode.SUBSTITUTE:
                # Currently we don't have a reliable way to get a substitute chunk synchronously 
                # without an explicit API for it. We will log it as STALE_PASSTHROUGH. 
                # (A true substitute would fetch from cache if we stored substitute contents).
                # The user prompt dictates: "Attempt substitution — look for another chunk from the same source that is not stale in the local cache. If no substitute: decision = STALE_PASSTHROUGH"
                # But since the chunks are strings, the cache doesn't store chunks, only source records (source_id, hash, is_stale).
                
                decision = "STALE_PASSTHROUGH"
                decisions.append(ChunkDecision(
                    chunk_index=i,
                    source_id=source_id,
                    decision=decision,
                    original_hash=chunk_hash,
                    reason="no_substitute_available"
                ))
                result.stale_passthrough_count += 1
                result.was_protected = True
                filtered_chunks.append(chunk)
                
            elif self.safe_mode == SafeMode.BLOCK:
                result.stale_passthrough_count += 1
                decisions.append(ChunkDecision(
                    chunk_index=i,
                    source_id=source_id,
                    decision="STALE",
                    original_hash=chunk_hash,
                    reason="block_mode"
                ))
                # don't add to filtered_chunks
            elif self.safe_mode == SafeMode.WARN:
                decisions.append(ChunkDecision(
                    chunk_index=i,
                    source_id=source_id,
                    decision="STALE_WARN",
                    original_hash=chunk_hash,
                    reason="warn_mode"
                ))
                result.stale_passthrough_count += 1
                filtered_chunks.append(chunk)
            else: # PASS
                decisions.append(ChunkDecision(
                    chunk_index=i,
                    source_id=source_id,
                    decision="STALE",
                    original_hash=chunk_hash,
                    reason="pass_mode"
                ))
                result.stale_passthrough_count += 1
                filtered_chunks.append(chunk)

        # 5. Check Block Threshold
        if self.safe_mode == SafeMode.BLOCK and len(chunks) > 0:
            stale_count = result.quarantine_count + result.stale_passthrough_count
            fraction = stale_count / len(chunks)
            if fraction > self.block_threshold:
                import uuid
                incident_id = f"inc_{uuid.uuid4().hex[:12]}"
                if self.events:
                    self.events.emit("shield.response.blocked", {
                        "pipeline_id": self.client._pipeline_id,
                        "session_id": session_id,
                        "incident_id": incident_id,
                        "stale_count": stale_count,
                        "total_count": len(chunks)
                    })
                raise ShieldBlockedError(
                    message=f"ProvenanceAI Shield blocked retrieval. {stale_count}/{len(chunks)} chunks are stale or quarantined.",
                    incident_id=incident_id,
                    stale_count=stale_count,
                    total_count=len(chunks),
                    stale_sources=list(stale_quarantine_sources)
                )

        if result.was_protected and self.events and self.safe_mode != SafeMode.BLOCK:
             self.events.emit("shield.response.protected", {
                "pipeline_id": self.client._pipeline_id,
                "session_id": session_id,
                "quarantine_count": result.quarantine_count,
                "stale_passthrough_count": result.stale_passthrough_count
            })

        result.chunks = filtered_chunks
        result.decisions = decisions
        result.shield_latency_ms = (time.perf_counter() - start_time) * 1000.0
        return result
