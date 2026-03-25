from dataclasses import dataclass
from typing import Optional

@dataclass
class LineageToken:
    source_id: str
    content_hash: str
    version_ts: str
    pipeline_id: str
    chunk_index: Optional[int] = None
    parent_source_id: Optional[str] = None

    def to_metadata(self) -> dict:
        return {
            "provenance_source_id": self.source_id,
            "provenance_content_hash": self.content_hash,
            "provenance_version_ts": self.version_ts,
            "provenance_pipeline_id": self.pipeline_id,
            "provenance_chunk_index": self.chunk_index or 0,
            "provenance_parent_source_id": self.parent_source_id or ""
        }

    @classmethod
    def from_metadata(cls, metadata: dict) -> Optional['LineageToken']:
        source_id = metadata.get("provenance_source_id")
        if not source_id:
            return None
        return cls(
            source_id=source_id,
            content_hash=metadata.get("provenance_content_hash", ""),
            version_ts=metadata.get("provenance_version_ts", ""),
            pipeline_id=metadata.get("provenance_pipeline_id", ""),
            chunk_index=metadata.get("provenance_chunk_index"),
            parent_source_id=metadata.get("provenance_parent_source_id")
        )
