"""Direct tool-level duplicate-guard test. No LLM, no HTTP.

Run with: docker compose exec backend python -m app.scripts.test_duplicates
"""
import json
import sys
import threading

from sqlalchemy import select

from app.context import session_key_var
from app.db import SessionLocal
from app.models import Booking, Session
from app.services.tools import create_booking, normalise_phone, prepare_booking

TEST_SESSION_KEY = "test-dup-guard"
session_key_var.set(TEST_SESSION_KEY)

results: list[bool] = []


def check(case: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    line = f"  [{status}] {case}"
    if detail:
        line += f" — {detail}"
    print(line)
    results.append(ok)


# ── Find 3 sessions with available slots ──────────────────────────────────────
with SessionLocal() as _db:
    _sessions = _db.execute(
        select(Session).where(Session.total_slots - Session.booked_slots > 0).limit(3)
    ).scalars().all()
    if len(_sessions) < 3:
        print("ABORT: fewer than 3 sessions with available slots in the DB.")
        sys.exit(1)
    s1_id = _sessions[0].id
    s2_id = _sessions[1].id
    s3_id = _sessions[2].id
    s3_orig_booked = _sessions[2].booked_slots

print(f"\nSessions: s1={s1_id}, s2={s2_id}, s3={s3_id}  (s3 booked_slots={s3_orig_booked})\n")

# ── Test 1: prepare + create succeeds ─────────────────────────────────────────
r = prepare_booking(s1_id, "Test Patient", "0770000001")
try:
    p = json.loads(r)
    token1 = p["confirmation_token"]
    ref1 = None
    r2 = create_booking(token1, s1_id, "Test Patient", "0770000001")
    c = json.loads(r2)
    ref1 = c.get("reference", "")
    check("Test 1: first booking succeeds", bool(ref1), f"ref={ref1}")
except Exception as e:
    check("Test 1: first booking succeeds", False, str(e))
    print("Cannot continue without ref1 — aborting.")
    sys.exit(1)

# ── Test 2: exact phone → DUPLICATE_BOOKING at prepare ────────────────────────
r = prepare_booking(s1_id, "Test Patient", "0770000001")
check("Test 2: exact phone blocked at prepare",
      "DUPLICATE_BOOKING" in r and ref1 in r, r[:160])

# ── Test 3: spaced phone → DUPLICATE_BOOKING ──────────────────────────────────
r = prepare_booking(s1_id, "Test Patient", "077 000 0001")
check("Test 3: spaced phone normalised and blocked",
      "DUPLICATE_BOOKING" in r and ref1 in r, r[:160])

# ── Test 4: +94 prefix → DUPLICATE_BOOKING ────────────────────────────────────
r = prepare_booking(s1_id, "Test Patient", "+94770000001")
check("Test 4: +94 prefix blocked",
      "DUPLICATE_BOOKING" in r and ref1 in r, r[:160])

# ── Test 5: dashed international → DUPLICATE_BOOKING ─────────────────────────
r = prepare_booking(s1_id, "Test Patient", "94-77-000-0001")
check("Test 5: dashed international phone blocked",
      "DUPLICATE_BOOKING" in r and ref1 in r, r[:160])

# ── Test 6: different session, same phone → succeeds ─────────────────────────
r = prepare_booking(s2_id, "Test Patient", "0770000001")
check("Test 6: same phone, different session allowed",
      "READY_TO_CONFIRM" in r, r[:80])

# ── Test 7: invalid phone → INVALID_PHONE ────────────────────────────────────
r = prepare_booking(s1_id, "Test Patient", "12345")
check("Test 7: invalid phone rejected", "INVALID_PHONE" in r, r[:120])

# ── Test 8: race — two tokens, concurrent create ──────────────────────────────
rA = prepare_booking(s3_id, "Race Patient", "0770000002")
rB = prepare_booking(s3_id, "Race Patient", "0770000002")

if "confirmation_token" not in rA or "confirmation_token" not in rB:
    check("Test 8: race — both prepares succeed", False,
          f"A={rA[:80]} B={rB[:80]}")
else:
    tokenA = json.loads(rA)["confirmation_token"]
    tokenB = json.loads(rB)["confirmation_token"]

    race_results: list[tuple[str, str]] = []

    def _book(token: str, label: str) -> None:
        session_key_var.set(TEST_SESSION_KEY)
        r = create_booking(token, s3_id, "Race Patient", "0770000002")
        race_results.append((label, r))

    t1 = threading.Thread(target=_book, args=(tokenA, "A"))
    t2 = threading.Thread(target=_book, args=(tokenB, "B"))
    t1.start(); t2.start()
    t1.join(); t2.join()

    for label, r in race_results:
        print(f"    race result {label}: {r[:140]}")

    n_success = sum(1 for _, r in race_results if "reference" in r and "ECH" in r)
    n_dup = sum(1 for _, r in race_results if "DUPLICATE_BOOKING" in r)

    with SessionLocal() as _db:
        s3_now = _db.execute(
            select(Session).where(Session.id == s3_id)
        ).scalar_one_or_none()
        new_booked = s3_now.booked_slots if s3_now else -1

    check("Test 8a: exactly one succeeds, one DUPLICATE_BOOKING",
          n_success == 1 and n_dup == 1,
          f"successes={n_success}, duplicates={n_dup}")
    check("Test 8b: booked_slots incremented exactly once",
          new_booked == s3_orig_booked + 1,
          f"was {s3_orig_booked}, now {new_booked}")

# ── Cleanup ───────────────────────────────────────────────────────────────────
print("\n--- Cleanup ---")
with SessionLocal() as _db:
    test_phones = ["0770000001", "0770000002"]
    rows = _db.execute(
        select(Booking).where(Booking.patient_phone.in_(test_phones))
    ).scalars().all()
    deleted = 0
    for b in rows:
        s = _db.get(Session, b.session_id)
        if s:
            s.booked_slots = max(0, s.booked_slots - 1)
        _db.delete(b)
        deleted += 1
    _db.commit()
    print(f"  Deleted {deleted} test booking(s), restored booked_slots")

# ── Summary ───────────────────────────────────────────────────────────────────
passed = sum(results)
total = len(results)
print(f"\n=== {passed}/{total} PASS ===\n")
sys.exit(0 if passed == total else 1)
