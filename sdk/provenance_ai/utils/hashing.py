import hashlib
import logging

logger = logging.getLogger(__name__)

def compute_file_hash(file_path: str) -> str:
    try:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(8192), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except Exception as e:
        logger.warning(f"Error computing file hash for {file_path}: {e}")
        return ""

def compute_text_hash(text: str) -> str:
    try:
        sha256_hash = hashlib.sha256()
        sha256_hash.update(text.encode("utf-8"))
        return sha256_hash.hexdigest()
    except Exception as e:
        logger.warning(f"Error computing text hash: {e}")
        return ""
