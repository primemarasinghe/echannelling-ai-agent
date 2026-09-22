"""OpenAI embedding client.

Isolated in one module so the provider can be swapped without touching
retrieval or ingestion.
"""
from functools import lru_cache

from langchain_openai import OpenAIEmbeddings

from app.config import get_settings

settings = get_settings()


@lru_cache
def get_embedder() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        api_key=settings.openai_api_key,
    )


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed many texts in one API call. Used at ingestion time."""
    return get_embedder().embed_documents(texts)


def embed_query(text: str) -> list[float]:
    """Embed a single search query. Used at retrieval time."""
    return get_embedder().embed_query(text)