"""Score every chunk against one query. Shows the full ranking, not just the top k."""
import sys

from sqlalchemy import select

from app.db import SessionLocal
from app.models import KBChunk
from app.services.embeddings import embed_query

query = " ".join(sys.argv[1:]) or "what happens if I miss my appointment?"
vec = embed_query(query)

with SessionLocal() as db:
    dist = KBChunk.embedding.cosine_distance(vec).label("d")
    rows = db.execute(select(KBChunk, dist).order_by(dist)).all()

print(f"\nQUERY: {query}")
print(f"{len(rows)} chunks in table\n")
for chunk, d in rows:
    print(f"  {1 - float(d):.4f}  {chunk.doc_id:28s} {chunk.title}")
    print(f"          {chunk.content[:80].replace(chr(10), ' ')}...")