"""Load mock hospitals, consultants and sessions into PostgreSQL.

Idempotent — safe to run on every container start.
"""
import json
import random
from datetime import date, time, timedelta
from pathlib import Path

from sqlalchemy import func, select, text

from app.db import Base, SessionLocal, engine
from app.models import Consultant, Hospital, Session

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"

MORNING_SLOTS = [time(8, 0), time(9, 0), time(10, 0)]
EVENING_SLOTS = [time(16, 0), time(17, 0), time(18, 0), time(19, 0)]


def main():
    Base.metadata.create_all(bind=engine)
    # Idempotent schema patches for columns added after initial creation
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rescheduled BOOLEAN DEFAULT FALSE"
        ))
        conn.commit()
    random.seed(42)

    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Consultant)):
            print("[seed] consultants already present, skipping")
            return

        # --- hospitals ---
        hospitals = json.loads((SEED_DIR / "hospitals.json").read_text())
        by_name = {}
        for h in hospitals:
            obj = Hospital(**h)
            db.add(obj)
            by_name[h["name"]] = obj
        db.flush()
        print(f"[seed] {len(hospitals)} hospitals")

        # --- consultants ---
        consultants = json.loads((SEED_DIR / "consultants.json").read_text())
        objs = []
        for c in consultants:
            data = dict(c)
            hospital_name = data.pop("hospital")
            obj = Consultant(**data, hospital_id=by_name[hospital_name].id)
            db.add(obj)
            objs.append(obj)
        db.flush()
        print(f"[seed] {len(objs)} consultants")

        # --- sessions: 30 days forward, each doctor on duty some days ---
        today = date.today()
        count = 0
        for c in objs:
            for offset in range(30):
                d = today + timedelta(days=offset)
                if d.weekday() == 6:            # no Sunday sessions
                    continue
                if random.random() > 0.45:      # doctor not on duty that day
                    continue

                start = random.choice(
                    MORNING_SLOTS if random.random() < 0.4 else EVENING_SLOTS
                )
                total = random.choice([15, 20, 25, 30])
                booked = random.randint(0, int(total * 0.7))

                db.add(Session(
                    consultant_id=c.id,
                    session_date=d,
                    start_time=start,
                    end_time=time((start.hour + 3) % 24, 0),
                    total_slots=total,
                    booked_slots=booked,
                ))
                count += 1

        db.commit()
        print(f"[seed] {count} sessions over 30 days")
        print("[seed] done")


if __name__ == "__main__":
    main()