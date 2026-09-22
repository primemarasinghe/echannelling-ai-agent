"""Similarity search over the approved knowledge base.

The rule the whole project rests on: the assistant may only state policy that
came back from here. If nothing clears the relevance floor, the correct answer
is a refusal, not a guess.
"""
from dataclasses import dataclass

from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.models import KBChunk
from app.services.embeddings import embed_query

settings = get_settings()


@dataclass
class RetrievedChunk:
    doc_id: str
    title: str
    content: str
    score: float          # 1.0 = identical meaning, 0.0 = unrelated


def retrieve(query: str, k: int | None = None) -> list[RetrievedChunk]:
    k = k or settings.retrieval_k
    query_vector = embed_query(query)

    with SessionLocal() as db:
        distance = KBChunk.embedding.cosine_distance(query_vector).label("distance")

        rows = db.execute(
            select(KBChunk, distance)
            .where(KBChunk.approved.is_(True))
            .order_by(distance)
            .limit(k)
        ).all()

    results = []
    top_score = None
    for chunk, dist in rows:
        score = 1.0 - float(dist)
        if score < settings.retrieval_min_score:
            continue
        if top_score is None:
            top_score = score
        elif top_score - score > settings.retrieval_relative_gap:
            break
        results.append(RetrievedChunk(
            doc_id=chunk.doc_id,
            title=chunk.title,
            content=chunk.content,
            score=round(score, 4),
        ))
    return results


def format_context(chunks: list[RetrievedChunk]) -> str:
    """Render retrieved chunks for insertion into a prompt."""
    if not chunks:
        return "NO_RELEVANT_KNOWLEDGE_FOUND"
    return "\n\n".join(
        f"[{i}] Source: {c.title}\n{c.content}"
        for i, c in enumerate(chunks, 1)
    )