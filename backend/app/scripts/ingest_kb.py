"""Chunk the approved knowledge base and store it in PostgreSQL with pgvector.

Rebuilds the table on every run so edits to the markdown always take effect.
The KB is small, so a full rebuild is cheap.
"""
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy import delete

from app.db import Base, SessionLocal, engine
from app.models import KBChunk
from app.services.embeddings import embed_documents

KB_DIR = Path(__file__).resolve().parent.parent / "seed" / "knowledge"

CHUNK_SIZE = 700
CHUNK_OVERLAP = 120


def extract_title(text: str, fallback: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return fallback


def main():
    Base.metadata.create_all(bind=engine)

    files = sorted(KB_DIR.glob("*.md"))
    if not files:
        print("[kb] no documents found")
        return

    # Skip re-embedding if chunks already exist — avoids blocking startup
    # when the OpenAI key is unavailable. Run with FORCE_INGEST=1 to rebuild.
    import os
    with SessionLocal() as db:
        existing = db.query(KBChunk).count()
    if existing > 0 and not os.getenv("FORCE_INGEST"):
        print(f"[kb] {existing} chunks already present, skipping (set FORCE_INGEST=1 to rebuild)")
        return

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n## ", "\n### ", "\n\n", "\n", " ", ""],
    )

    records = []
    for f in files:
        text = f.read_text()
        title = extract_title(text, f.stem)
        for i, chunk in enumerate(splitter.split_text(text)):
            records.append({
                "doc_id": f"{f.stem}#{i}",
                "title": title,
                "source_file": f.name,
                "content": chunk,
            })

    print(f"[kb] {len(files)} documents produced {len(records)} chunks")

    print("[kb] requesting embeddings from OpenAI...")
    vectors = embed_documents([r["content"] for r in records])
    print(f"[kb] received {len(vectors)} vectors of {len(vectors[0])} dimensions")

    with SessionLocal() as db:
        db.execute(delete(KBChunk))
        for rec, vec in zip(records, vectors):
            db.add(KBChunk(**rec, embedding=vec, approved=True))
        db.commit()

    print(f"[kb] stored {len(records)} chunks")
    print("[kb] done")


if __name__ == "__main__":
    main()