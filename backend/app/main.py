from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.routers import catalog, chat
from app.config import get_settings
from app.db import Base, engine
from app import models          # noqa: F401 — registers the tables

settings = get_settings()

app = FastAPI(
    title="e-Channelling AI Agent — RAG Prototype",
    description="Retrieval-grounded assistant over mock data. No live systems.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
app.include_router(chat.router)
app.include_router(catalog.router)

@app.get("/")
def root():
    return {"service": "e-Channelling AI Agent", "docs": "/docs"}


@app.get("/health")
def health():
    postgres_ok = False
    pgvector_ok = False

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            postgres_ok = True

            row = conn.execute(text(
                "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
            )).first()
            pgvector_ok = row is not None
    except Exception as e:
        print(f"[health] database check failed: {e}")

    return {
        "status": "ok" if (postgres_ok and pgvector_ok) else "degraded",
        "postgres": postgres_ok,
        "pgvector": pgvector_ok,
        "chat_model": settings.openai_chat_model,
        "embedding_model": settings.openai_embedding_model,
        "openai_key_present": bool(settings.openai_api_key),
    }