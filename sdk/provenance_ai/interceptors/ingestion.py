import os
import datetime
import logging
import httpx
from provenance_ai.utils.hashing import compute_file_hash, compute_text_hash
from provenance_ai.utils.tokens import LineageToken

logger = logging.getLogger(__name__)

class ProvenanceIngestionInterceptor:
    def __init__(self, api_url: str, api_key: str, pipeline_id: str):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.pipeline_id = pipeline_id
        self._http = httpx.Client(
            timeout=15.0,
            headers={"X-Provenance-API-Key": api_key}
        )

    def intercept(self, file_path: str) -> list:
        try:
            from langchain_community.document_loaders import PyPDFLoader, TextLoader
            from langchain_text_splitters import RecursiveCharacterTextSplitter
        except ImportError:
            logger.warning("Langchain is not installed. Ingestion requires langchain.")
            return []

        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            loader = PyPDFLoader(file_path)
        elif ext in [".txt", ".md"]:
            loader = TextLoader(file_path)
        else:
            logger.warning(f"Unsupported file type: {ext}")
            return []

        try:
            docs = loader.load()
        except Exception as e:
            logger.warning(f"Error loading document {file_path}: {e}")
            return []

        file_hash = compute_file_hash(file_path)
        
        try:
            mtime = os.path.getmtime(file_path)
            version_ts = datetime.datetime.fromtimestamp(mtime, tz=datetime.timezone.utc).isoformat()
        except Exception as e:
            logger.warning(f"Error getting mod time for {file_path}: {e}")
            version_ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
        full_text = "".join(doc.page_content for doc in docs)
        first_200_chars = full_text[:200]
        source_id = os.path.basename(file_path)

        token = LineageToken(
            source_id=source_id,
            content_hash=file_hash,
            version_ts=version_ts,
            pipeline_id=self.pipeline_id
        )

        try:
            res = self._http.post(
                f"{self.api_url}/api/ingest",
                json={
                    "sourceId": token.source_id,
                    "contentHash": token.content_hash,
                    "versionTs": token.version_ts,
                    "pipelineId": token.pipeline_id,
                    "contentPreview": first_200_chars
                }
            )
            res.raise_for_status()
        except Exception as e:
            logger.warning(f"Failed to post source record to backend: {e}")

        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_documents(docs)

        result = []
        for i, chunk in enumerate(chunks):
            child_token = LineageToken(
                source_id=f"{token.source_id}::chunk_{i}",
                content_hash=compute_text_hash(chunk.page_content),
                version_ts=token.version_ts,
                pipeline_id=self.pipeline_id,
                chunk_index=i,
                parent_source_id=token.source_id
            )
            # Inject lineage metadata into the chunk's metadata dict
            chunk.metadata.update(child_token.to_metadata())
            result.append((chunk, child_token))

        return result
