from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class IngestRequest(BaseModel):
    sourceId: str
    contentHash: str
    versionTs: datetime
    pipelineId: str

class LLMResponseCreate(BaseModel):
    sessionId: str
    queryText: str
    retrievedEmbeddingIds: List[str]
    promptHash: str
    responseText: str
    responseHash: str
    modelVersion: str
