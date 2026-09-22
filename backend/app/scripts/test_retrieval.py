"""Manual retrieval check. Run:  docker compose exec backend python -m app.scripts.test_retrieval"""
from app.services.retrieval import retrieve

QUERIES = [
    "what happens if I miss my appointment?",
    "how much is the service charge?",
    "can I change my appointment to another day?",
    "what card types can I pay with?",
    "do you offer home visits by doctors?",
    "what is the capital of France?",
]


def main():
    for q in QUERIES:
        print(f"\n{'=' * 70}\nQUERY: {q}")
        hits = retrieve(q)
        if not hits:
            print("  -> nothing above the relevance floor. The assistant must refuse.")
            continue
        for h in hits:
            preview = h.content.replace("\n", " ")[:95]
            print(f"  {h.score:.3f}  {h.title}")
            print(f"         {preview}...")


if __name__ == "__main__":
    main()