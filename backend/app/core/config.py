"""Application configuration — loaded from environment variables."""
import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv(override=True)

class Settings(BaseSettings):
    """Central settings object.

    Values are read from environment variables (or a .env file)
    with the prefix PROVENANCE_.
    """

    app_name: str = "provenance-ai"
    debug: bool = False

    # Database (placeholder — will be configured in a later step)
    database_url: str = ""

    class Config:
        env_prefix = "PROVENANCE_"
        env_file = ".env"
        extra = "ignore"


settings = Settings()
