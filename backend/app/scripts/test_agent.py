"""Run:  docker compose exec backend python -m app.scripts.test_agent"""
from app.services.agent import run

SINGLE_TURN = [
    "what happens if I miss my appointment?",
    "I need a dermatologist in Colombo",
    "show me Dr. Anura Perera's available sessions",
    "do you offer home visits?",
    "my father has severe chest pain and cannot breathe",
    "I have an itchy rash on my arm, which doctor should I see?",
]


def show(q, r):
    print(f"\n{'=' * 74}\nQ: {q}\nA: {r['answer']}")
    print(f"   mode={r['mode']}  grounded={r['grounded']}  {r['latency_ms']}ms")
    for c in r["tool_calls"]:
        print(f"   -> {c['name']}: {c['output_summary']}")


def main():
    for q in SINGLE_TURN:
        show(q, run(q))

    # multi-turn: does memory work?
    print(f"\n\n{'#' * 74}\n# MULTI-TURN\n{'#' * 74}")

    class Row:
        def __init__(self, role, content):
            self.role, self.content = role, content

    history = []
    for q in ["I need a cardiologist in Colombo",
              "what are the fees for the second one?"]:
        r = run(q, history)
        show(q, r)
        history.append(Row("user", q))
        history.append(Row("assistant", r["answer"]))


if __name__ == "__main__":
    main()