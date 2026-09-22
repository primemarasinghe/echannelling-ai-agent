"""Run:  docker compose exec backend python -m app.scripts.test_rag"""
from app.services.rag_chain import answer

QUESTIONS = [
    "what happens if I miss my appointment?",
    "how much is the channelling service charge?",
    "can I change my appointment to another day?",
    "what payment methods do you accept?",
    "how long does a refund take?",
    "do you offer home visits by doctors?",
    "does e-Channelling cover my insurance claim?",
    "what is the capital of France?",
]


def main():
    for q in QUESTIONS:
        r = answer(q)
        print(f"\n{'=' * 72}")
        print(f"Q: {q}")
        print(f"A: {r['answer']}")
        srcs = ", ".join(f"{s['title']} ({s['score']})" for s in r["sources"]) or "none"
        print(f"   sources: {srcs}")
        print(f"   {r['latency_ms']}ms")


if __name__ == "__main__":
    main()