"""Appointment reminder loop — pure asyncio, no extra packages."""
import asyncio
import logging
from datetime import date, timedelta

_log = logging.getLogger(__name__)


def _run_reminders() -> None:
    tomorrow = date.today() + timedelta(days=1)
    _log.info("[scheduler] Checking reminders for %s", tomorrow)

    from sqlalchemy import select
    from sqlalchemy.orm import joinedload

    from app.db import SessionLocal
    from app.models import Booking, Session as SessionModel
    from app.services.email_svc import send_appointment_reminder

    with SessionLocal() as db:
        bookings = db.execute(
            select(Booking)
            .join(SessionModel, Booking.session_id == SessionModel.id)
            .options(
                joinedload(Booking.session).joinedload(SessionModel.consultant)
            )
            .where(
                SessionModel.session_date == tomorrow,
                Booking.status == "CONFIRMED",
                Booking.reminder_sent == False,   # noqa: E712
                Booking.patient_email.isnot(None),
            )
        ).unique().scalars().all()

        if not bookings:
            _log.info("[scheduler] No reminders to send for %s", tomorrow)
            return

        _log.info("[scheduler] Sending %d reminder(s)", len(bookings))
        for b in bookings:
            s = b.session
            try:
                send_appointment_reminder(
                    to_email=b.patient_email,
                    ref=b.reference,
                    doctor=s.consultant.name,
                    date=s.session_date.strftime("%A, %d %B %Y"),
                    time=s.start_time.strftime("%I:%M %p"),
                    appt_num=b.appointment_number,
                    patient_name=b.patient_name,
                )
                b.reminder_sent = True
                db.commit()
                _log.info("[scheduler] ✓ Reminder → %s (%s)", b.patient_email, b.reference)
            except Exception as exc:
                _log.error("[scheduler] Failed for %s: %s", b.reference, exc)


async def reminder_loop() -> None:
    _log.info("[scheduler] Reminder loop started — runs every 24 h")
    while True:
        try:
            await asyncio.to_thread(_run_reminders)
        except Exception as exc:
            _log.error("[scheduler] Uncaught error: %s", exc)
        await asyncio.sleep(86400)
