from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"

    database_url: str = "postgresql+psycopg://echuser:echpass@localhost:5433/echannelling"

    # text-embedding-3-small produces 1536-dimension vectors.
    embedding_dimensions: int = 1536

    # Retrieval tuning
    retrieval_k: int = 4
    retrieval_min_score: float = 0.30
    # Discard hits scoring more than this below the top hit.
    retrieval_relative_gap: float = 0.12

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Google OAuth + JWT auth
    google_client_id: str = ""
    jwt_secret: str = "dev-secret-change-in-production"
    admin_emails: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def admin_email_list(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()