"""Run:  docker compose exec backend python -m app.scripts.test_tools"""
from app.services import tools as t

print("\n--- dermatologists in Colombo ---")
print(t.search_consultants(specialty="Dermatology", city="Colombo"))

print("\n--- availability for Dr. Anura Perera ---")
print(t.get_availability(consultant_name="Anura Perera", days_ahead=7))

print("\n--- policy lookup ---")
print(t.search_knowledge_base("no show refund"))

print("\n--- trace ---")
for c in t.TRACE:
    print(f"  {c['name']}({c['input']}) -> {c['output_summary']}")