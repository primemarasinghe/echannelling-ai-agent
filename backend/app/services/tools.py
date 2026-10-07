"""LangChain tools. Every tool is a query against mock e-Channelling data.

The model can only affect or read the world through this list.
"""
import json
import random
import re
import string
from contextvars import ContextVar
from datetime import date, timedelta

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from app.db import SessionLocal
from app.models import Booking, Consultant, Hospital, Session
from app.services.retrieval import retrieve

# Per-request trace — ContextVar so concurrent requests never share entries.
_TRACE: ContextVar[list[dict] | None] = ContextVar("trace", default=None)


def reset_trace() -> None:
    _TRACE.set([])


def get_trace() -> list[dict]:
    return _TRACE.get() or []


def _trace(name: str, args: dict, summary: str, result_json: dict | None = None) -> None:
    entry: dict = {"name": name, "input": args, "output_summary": summary}
    if result_json is not None:
        entry["result_json"] = result_json
    current = _TRACE.get()
    if current is None:
        current = []
        _TRACE.set(current)
    current.append(entry)


# ---------------------------------------------------------------- knowledge
class KBInput(BaseModel):
    query: str = Field(description="The policy or general question to look up.")


def _log_knowledge_gap(query: str) -> None:
    """Persist a knowledge-gap record. Never raises — logging must not break flow."""
    try:
        from app.context import session_key_var
        from app.models import KnowledgeGap
        sk = session_key_var.get("unknown")
        with SessionLocal() as db:
            db.add(KnowledgeGap(query=query, session_key=sk))
            db.commit()
    except Exception:
        pass


def search_knowledge_base(query: str) -> str:
    chunks = retrieve(query)
    if not chunks:
        _trace("search_knowledge_base", {"query": query}, "no relevant policy found")
        _log_knowledge_gap(query)
        return ("NO_RELEVANT_KNOWLEDGE_FOUND. Tell the customer this is not in the "
                "approved knowledge base and offer a human officer.")
    _trace("search_knowledge_base", {"query": query},
           f"{len(chunks)} chunks, top score {chunks[0].score:.3f}")
    return "\n\n".join(f"[Source: {c.title}]\n{c.content}" for c in chunks)


# --------------------------------------------------------------- consultants
class ConsultantInput(BaseModel):
    specialty: str | None = Field(default=None, description="e.g. Dermatology, Cardiology")
    name: str | None = Field(default=None, description="Full or partial doctor name")
    city: str | None = Field(default=None, description="e.g. Colombo, Kandy, Negombo")
    hospital: str | None = Field(default=None, description="Hospital name")


def search_consultants(specialty=None, name=None, city=None, hospital=None) -> str:
    args = {"specialty": specialty, "name": name, "city": city, "hospital": hospital}
    with SessionLocal() as db:
        q = select(Consultant).options(joinedload(Consultant.hospital))
        if specialty:
            q = q.where(Consultant.specialty.ilike(f"%{specialty}%"))
        if name:
            q = q.where(Consultant.name.ilike(f"%{name}%"))
        if hospital:
            q = q.join(Hospital).where(Hospital.name.ilike(f"%{hospital}%"))
        if city:
            q = q.join(Hospital).where(Hospital.city.ilike(f"%{city}%"))

        rows = db.execute(q.limit(10)).unique().scalars().all()
        if not rows:
            _trace("search_consultants", args, "0 results")
            return "NO_CONSULTANTS_FOUND for those criteria."

        result = [{
            "consultant_id": c.id,
            "name": c.name,
            "specialty": c.specialty,
            "qualifications": c.qualifications,
            "years_experience": c.years_experience,
            "consultation_fee_lkr": c.consultation_fee,
            "languages": c.languages,
            "hospital": c.hospital.name,
            "city": c.hospital.city,
        } for c in rows]
        _trace("search_consultants", args, f"{len(result)} consultants",
               result_json={"doctors": result})
        return json.dumps(result, indent=2)


# -------------------------------------------------------------- availability
class AvailabilityInput(BaseModel):
    consultant_id: int | None = Field(default=None, description="Preferred: exact id")
    consultant_name: str | None = Field(default=None, description="Used if id unknown")
    from_date: str | None = Field(default=None, description="YYYY-MM-DD, defaults today")
    days_ahead: int = Field(default=14, description="Days forward to search")


def get_availability(consultant_id=None, consultant_name=None,
                     from_date=None, days_ahead=14) -> str:
    args = {"consultant_id": consultant_id, "consultant_name": consultant_name,
            "from_date": from_date, "days_ahead": days_ahead}
    start = date.fromisoformat(from_date) if from_date else date.today()
    end = start + timedelta(days=days_ahead)

    with SessionLocal() as db:
        q = (select(Session)
             .options(joinedload(Session.consultant).joinedload(Consultant.hospital))
             .where(Session.session_date >= start, Session.session_date <= end))
        if consultant_id:
            q = q.where(Session.consultant_id == consultant_id)
        elif consultant_name:
            q = q.join(Consultant).where(Consultant.name.ilike(f"%{consultant_name}%"))
        else:
            _trace("get_availability", args, "rejected: no consultant given")
            return "ERROR: specify consultant_id or consultant_name."

        rows = db.execute(
            q.order_by(Session.session_date, Session.start_time).limit(20)
        ).unique().scalars().all()

        result = [{
            "session_id": s.id,
            "doctor": s.consultant.name,
            "hospital": s.consultant.hospital.name,
            "date": s.session_date.isoformat(),
            "day": s.session_date.strftime("%A"),
            "start_time": s.start_time.strftime("%I:%M %p"),
            "available_slots": s.available_slots,
            "fee_lkr": s.consultant.consultation_fee,
        } for s in rows if s.available_slots > 0]

        if not result:
            _trace("get_availability", args, "0 sessions with open slots")
            return "NO_SESSIONS_FOUND in that date range."
        _trace("get_availability", args, f"{len(result)} sessions with open slots",
               result_json={"sessions": result})
        return json.dumps(result, indent=2)


# ------------------------------------------------------------------ booking
# Confirmation token store.
# Maps token → {session_id, patient_name, patient_phone, expires_at}.
# Single-use: deleted after a successful create_booking call.
# NOTE: in-memory — tokens are lost on process restart and are not safe for
# multi-worker deployment. Use Redis or a DB table in production.
import time as _time

_PENDING_TOKENS: dict[str, dict] = {}
_TOKEN_TTL = 600  # seconds


def _make_token() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=16))


def _purge_expired_tokens() -> None:
    now = _time.monotonic()
    expired = [k for k, v in _PENDING_TOKENS.items() if v["expires_at"] < now]
    for k in expired:
        del _PENDING_TOKENS[k]


def normalise_phone(raw: str) -> str:
    """Strip formatting and normalise to domestic 0XXXXXXXXX (10 digits).

    Accepts: "077 123 4567", "+94771234567", "94-77-000-0001", "0771234567".
    Raises ValueError with INVALID_PHONE message if the result is not valid.
    """
    cleaned = re.sub(r"[\s\-\.\(\)]", "", raw)
    if cleaned.startswith("+94"):
        cleaned = "0" + cleaned[3:]
    elif cleaned.startswith("94") and len(cleaned) == 11:
        cleaned = "0" + cleaned[2:]
    if len(cleaned) == 10 and cleaned.startswith("0"):
        return cleaned
    raise ValueError(
        "INVALID_PHONE: please provide a 10-digit Sri Lankan mobile number"
    )


class PrepareBookingInput(BaseModel):
    session_id: int = Field(description="Session ID from get_availability")
    patient_name: str = Field(description="Full name of the patient")
    patient_phone: str = Field(description="Contact mobile number")


def prepare_booking(session_id: int, patient_name: str, patient_phone: str) -> str:
    """Validate and preview a booking without committing it to the database."""
    try:
        patient_phone = normalise_phone(patient_phone)
    except ValueError as e:
        _trace("prepare_booking",
               {"session_id": session_id, "patient_name": patient_name,
                "patient_phone": patient_phone},
               "rejected: invalid phone")
        return str(e)

    args = {"session_id": session_id, "patient_name": patient_name,
            "patient_phone": patient_phone}
    with SessionLocal() as db:
        s = db.get(Session, session_id)
        if not s:
            _trace("prepare_booking", args, "session not found")
            return "ERROR: session not found."
        if s.available_slots <= 0:
            _trace("prepare_booking", args, "session full")
            return "SESSION_FULL: that session has no available slots. Offer another session."

        dupe = db.execute(select(Booking).where(
            Booking.session_id == session_id,
            Booking.patient_phone == patient_phone,
            Booking.status == "CONFIRMED")).scalar_one_or_none()
        if dupe:
            _trace("prepare_booking", args, f"duplicate detected ({dupe.reference})")
            return (f"DUPLICATE_BOOKING: this number already has booking "
                    f"{dupe.reference} for this session on "
                    f"{s.session_date.isoformat()} at "
                    f"{s.start_time.strftime('%I:%M %p')}.")

        consultation_fee = s.consultant.consultation_fee
        service_charge = 200.0
        total = consultation_fee + service_charge
        estimated_appt = s.booked_slots + 1

        _purge_expired_tokens()
        from app.context import session_key_var
        token = _make_token()
        _PENDING_TOKENS[token] = {
            "session_id": session_id,
            "patient_name": patient_name,
            "patient_phone": patient_phone,
            "session_key": session_key_var.get("unknown"),
            "expires_at": _time.monotonic() + _TOKEN_TTL,
        }

        preview = {
            "status": "READY_TO_CONFIRM",
            "confirmation_token": token,
            "session_id": session_id,
            "doctor": s.consultant.name,
            "hospital": s.consultant.hospital.name,
            "date": s.session_date.isoformat(),
            "day": s.session_date.strftime("%A"),
            "time": s.start_time.strftime("%I:%M %p"),
            "estimated_appointment_number": estimated_appt,
            "consultation_fee_lkr": consultation_fee,
            "service_charge_lkr": service_charge,
            "total_lkr": total,
            "patient_name": patient_name,
            "patient_phone": patient_phone,
        }
        _trace("prepare_booking", args,
               f"preview ready: {s.consultant.name} on {s.session_date}",
               result_json=preview)
        return json.dumps(preview, indent=2)


class BookingInput(BaseModel):
    confirmation_token: str = Field(
        description="The confirmation_token from the prepare_booking result. Required.")
    session_id: int = Field(description="Must match the session_id in the prepare_booking result")
    patient_name: str = Field(description="Must match the patient_name in the prepare_booking result")
    patient_phone: str = Field(description="Must match the patient_phone in the prepare_booking result")


def create_booking(confirmation_token: str, session_id: int,
                   patient_name: str, patient_phone: str) -> str:
    try:
        patient_phone = normalise_phone(patient_phone)
    except ValueError as e:
        _trace("create_booking",
               {"confirmation_token": confirmation_token, "session_id": session_id,
                "patient_name": patient_name, "patient_phone": patient_phone},
               "rejected: invalid phone")
        return str(e)

    args = {"confirmation_token": confirmation_token, "session_id": session_id,
            "patient_name": patient_name, "patient_phone": patient_phone}

    _purge_expired_tokens()
    from app.context import session_key_var
    pending = _PENDING_TOKENS.get(confirmation_token)
    if pending is None:
        _trace("create_booking", args, "rejected: token missing or expired")
        return ("TOKEN_REQUIRED: you must call prepare_booking first and pass its "
                "confirmation_token here. The token may have expired (10 min TTL).")
    if (pending["session_id"] != session_id
            or pending["patient_name"] != patient_name
            or pending["patient_phone"] != patient_phone):
        _trace("create_booking", args, "rejected: token/args mismatch")
        return ("TOKEN_MISMATCH: the session_id, patient_name, or patient_phone do not "
                "match the values from prepare_booking. Call prepare_booking again.")
    if pending["session_key"] != session_key_var.get("unknown"):
        _trace("create_booking", args, "rejected: session_key mismatch")
        return ("SESSION_MISMATCH: this confirmation token was issued to a different "
                "session. Call prepare_booking again in the current session.")

    # Token is valid — consume it immediately (single-use)
    del _PENDING_TOKENS[confirmation_token]

    with SessionLocal() as db:
        # SELECT FOR UPDATE serialises concurrent bookings for the same session.
        s = db.execute(
            select(Session).where(Session.id == session_id).with_for_update()
        ).scalar_one_or_none()
        if not s:
            _trace("create_booking", args, "session not found")
            return "ERROR: session not found."
        if s.available_slots <= 0:
            _trace("create_booking", args, "session full")
            return "ERROR: that session is full. Offer another session."

        # Application-level duplicate check (runs inside the row lock).
        dupe = db.execute(select(Booking).where(
            Booking.session_id == session_id,
            Booking.patient_phone == patient_phone,
            Booking.status == "CONFIRMED")).scalar_one_or_none()
        if dupe:
            _trace("create_booking", args, f"duplicate blocked ({dupe.reference})")
            return (f"DUPLICATE_BOOKING: this number already has booking "
                    f"{dupe.reference} for this session on "
                    f"{s.session_date.isoformat()} at "
                    f"{s.start_time.strftime('%I:%M %p')}. Do not book again.")

        # Save for error messages after potential rollback.
        session_date_str = s.session_date.isoformat()
        session_time_str = s.start_time.strftime("%I:%M %p")
        consultant_id    = s.consultant_id

        s.booked_slots += 1
        ref = "ECH" + "".join(random.choices(string.digits, k=8))
        fee = s.consultant.consultation_fee + 200      # + channelling service charge
        b = Booking(reference=ref, session_id=s.id, patient_name=patient_name,
                    patient_phone=patient_phone, appointment_number=s.booked_slots,
                    amount=fee, status="CONFIRMED")
        db.add(b)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            dupe2 = db.execute(select(Booking).where(
                Booking.session_id == session_id,
                Booking.patient_phone == patient_phone,
                Booking.status == "CONFIRMED")).scalar_one_or_none()
            if dupe2:
                _trace("create_booking", args,
                       f"duplicate blocked by unique index ({dupe2.reference})")
                return (f"DUPLICATE_BOOKING: this number already has booking "
                        f"{dupe2.reference} for this session on "
                        f"{session_date_str} at {session_time_str}. Do not book again.")
            raise

        # Best-effort notification — never breaks the booking flow
        try:
            from app.models import DoctorNotification
            db.add(DoctorNotification(
                consultant_id=consultant_id,
                booking_id=b.id,
                message=(
                    f"{patient_name} booked appointment "
                    f"#{b.appointment_number} on {session_date_str} at {session_time_str}"
                ),
            ))
            db.commit()
        except Exception:
            pass

        out = {"reference": ref, "doctor": s.consultant.name,
               "hospital": s.consultant.hospital.name,
               "date": session_date_str,
               "time": session_time_str,
               "appointment_number": b.appointment_number,
               "total_amount_lkr": fee,
               "note": "Total includes Rs. 200 channelling service charge."}
        _trace("create_booking", args, f"booked {ref}", result_json={
            "reference": ref,
            "session_id": session_id,
            "doctor": s.consultant.name,
            "date": session_date_str,
            "time": session_time_str,
            "patient_phone": patient_phone,
        })
        return json.dumps(out, indent=2)


class RescheduleInput(BaseModel):
    reference: str = Field(description="Booking reference, e.g. ECH12345678")
    new_date: str = Field(description="New session date as YYYY-MM-DD, e.g. 2026-09-29")
    new_time: str = Field(description="New session start time as HH:MM (24-hour), e.g. 10:00")


def reschedule_booking(reference: str, new_date: str, new_time: str) -> str:
    from datetime import datetime, time as dt_time
    args = {"reference": reference, "new_date": new_date, "new_time": new_time}

    with SessionLocal() as db:
        # ── Load booking ──────────────────────────────────────────────────────
        b = db.execute(
            select(Booking)
            .options(
                joinedload(Booking.session)
                .joinedload(Session.consultant)
                .joinedload(Consultant.hospital)
            )
            .where(Booking.reference == reference.upper(), Booking.status == "CONFIRMED")
        ).unique().scalar_one_or_none()

        if not b:
            _trace("reschedule_booking", args, "booking not found or not CONFIRMED")
            return "BOOKING_NOT_FOUND: no confirmed booking with that reference."

        if b.rescheduled:
            _trace("reschedule_booking", args, "already rescheduled once — blocked")
            return ("ALREADY_RESCHEDULED: booking {} has already been rescheduled once. "
                    "Only one reschedule per booking is permitted. "
                    "To change again, cancel and make a new booking.".format(reference.upper()))

        # ── 6-hour window check on ORIGINAL session ───────────────────────────
        old_session = b.session
        # Both sides are naive local time (TZ=Asia/Colombo set on the container).
        session_dt = datetime.combine(old_session.session_date, old_session.start_time)
        hours_until = (session_dt - datetime.now()).total_seconds() / 3600

        if hours_until < 6:
            _trace("reschedule_booking", args,
                   f"too late to reschedule ({hours_until:.1f}h remaining)")
            return (f"TOO_LATE_TO_RESCHEDULE: the original session is only "
                    f"{hours_until:.1f} hours away. Rescheduling requires at least "
                    f"6 hours notice. The patient should contact the hospital directly.")

        # ── Resolve new session by date + time + same consultant ──────────────
        try:
            target_date = date.fromisoformat(new_date)
            h, m = [int(x) for x in new_time.split(":")]
            target_time = dt_time(h, m)
        except Exception:
            _trace("reschedule_booking", args, "invalid date/time format")
            return "INVALID_DATE_TIME: use YYYY-MM-DD for date and HH:MM for time."

        # Find the target session (with relationships for response building).
        new_s = db.execute(
            select(Session)
            .options(joinedload(Session.consultant).joinedload(Consultant.hospital))
            .where(
                Session.consultant_id == old_session.consultant_id,
                Session.session_date == target_date,
                Session.start_time == target_time,
            )
        ).unique().scalar_one_or_none()

        if not new_s:
            _trace("reschedule_booking", args, "no matching session found for that date/time")
            return (f"SESSION_NOT_FOUND: {old_session.consultant.name} has no session on "
                    f"{new_date} at {new_time}. Please choose from the available sessions shown.")

        if new_s.id == old_session.id:
            _trace("reschedule_booking", args, "same session selected")
            return "SAME_SESSION: that is the same session as the current one. Choose a different date or time."

        # Acquire row lock on target session only (FOR UPDATE cannot be used with outer joins).
        new_s = db.execute(
            select(Session).where(Session.id == new_s.id).with_for_update()
        ).scalar_one_or_none()

        if new_s.available_slots <= 0:
            _trace("reschedule_booking", args, "new session full")
            return "SESSION_FULL: that session has no available slots. Choose another."

        # Duplicate check on target session (runs inside the row lock).
        phone_stored = b.patient_phone   # normalised; save before any commit/rollback
        new_s_id = new_s.id
        dupe = db.execute(select(Booking).where(
            Booking.session_id == new_s_id,
            Booking.patient_phone == phone_stored,
            Booking.status == "CONFIRMED",
        )).scalar_one_or_none()
        if dupe:
            _trace("reschedule_booking", args,
                   f"duplicate in target session ({dupe.reference})")
            return (f"DUPLICATE_BOOKING: this number already has booking "
                    f"{dupe.reference} in that session.")

        # ── Perform the reschedule ─────────────────────────────────────────────
        old_session.booked_slots -= 1
        new_s.booked_slots += 1

        old_fee = b.amount
        new_amount = new_s.consultant.consultation_fee + 200
        fee_diff = round(new_amount - old_fee, 2)

        b.session_id = new_s.id
        b.appointment_number = new_s.booked_slots
        b.amount = new_amount
        b.rescheduled = True
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            dupe2 = db.execute(select(Booking).where(
                Booking.session_id == new_s_id,
                Booking.patient_phone == phone_stored,
                Booking.status == "CONFIRMED",
            )).scalar_one_or_none()
            if dupe2:
                _trace("reschedule_booking", args,
                       f"duplicate blocked by index ({dupe2.reference})")
                return (f"DUPLICATE_BOOKING: this number already has booking "
                        f"{dupe2.reference} in that session.")
            raise

        if fee_diff > 0:
            fee_note = f"An additional Rs. {fee_diff:,.0f} will be charged to the original payment method."
        elif fee_diff < 0:
            fee_note = f"A refund of Rs. {abs(fee_diff):,.0f} will be returned to the original payment method within 2–5 working days."
        else:
            fee_note = "No fee difference — total remains Rs. {:,.0f}.".format(new_amount)

        out = {
            "reference": b.reference,
            "status": "RESCHEDULED",
            "doctor": new_s.consultant.name,
            "hospital": new_s.consultant.hospital.name,
            "new_date": new_s.session_date.isoformat(),
            "new_day": new_s.session_date.strftime("%A"),
            "new_time": new_s.start_time.strftime("%I:%M %p"),
            "new_appointment_number": b.appointment_number,
            "new_total_amount_lkr": new_amount,
            "fee_adjustment_note": fee_note,
            "reschedule_limit": "This booking cannot be rescheduled again. One reschedule per booking.",
        }
        _trace("reschedule_booking", args,
               f"rescheduled {b.reference} → {new_s.session_date} {new_s.start_time}")
        return json.dumps(out, indent=2)


class LookupInput(BaseModel):
    reference: str | None = Field(default=None, description="e.g. ECH12345678")
    phone: str | None = Field(default=None, description="Patient contact number")


def lookup_booking(reference=None, phone=None) -> str:
    if phone:
        try:
            phone = normalise_phone(phone)
        except ValueError as e:
            return str(e)
    args = {"reference": reference, "phone": phone}
    with SessionLocal() as db:
        q = select(Booking).options(
            joinedload(Booking.session)
            .joinedload(Session.consultant)
            .joinedload(Consultant.hospital))
        if reference:
            q = q.where(Booking.reference == reference.upper())
        elif phone:
            q = q.where(Booking.patient_phone == phone)
        else:
            return "ERROR: provide a reference or a phone number."

        rows = db.execute(q.limit(10)).unique().scalars().all()
        if not rows:
            _trace("lookup_booking", args, "0 results")
            return "NO_BOOKING_FOUND."

        result = [{
            "reference": b.reference, "status": b.status,
            "patient": b.patient_name,
            "consultant_id": b.session.consultant_id,
            "doctor": b.session.consultant.name,
            "hospital": b.session.consultant.hospital.name,
            "date": b.session.session_date.isoformat(),
            "time": b.session.start_time.strftime("%I:%M %p"),
            "appointment_number": b.appointment_number,
            "amount_lkr": b.amount,
            "already_rescheduled": b.rescheduled,
        } for b in rows]
        _trace("lookup_booking", args, f"{len(result)} bookings")
        return json.dumps(result, indent=2)


def build_tools() -> list[StructuredTool]:
    return [
        StructuredTool.from_function(
            func=search_knowledge_base, name="search_knowledge_base",
            description=("Look up e-Channelling policy: refunds, no-show charges, "
                         "cancellation, fees, payment methods, rescheduling, how "
                         "booking works, support contacts. ALWAYS use this before "
                         "answering any policy question."),
            args_schema=KBInput),
        StructuredTool.from_function(
            func=search_consultants, name="search_consultants",
            description=("Find doctors by specialty, name, city or hospital. Returns "
                         "fees and the consultant_id needed for availability."),
            args_schema=ConsultantInput),
        StructuredTool.from_function(
            func=get_availability, name="get_availability",
            description="Get bookable sessions and open slot counts for a consultant.",
            args_schema=AvailabilityInput),
        StructuredTool.from_function(
            func=prepare_booking, name="prepare_booking",
            description=(
                "Validate and preview a booking BEFORE committing it. "
                "Call this once you have session_id, patient_name, and patient_phone. "
                "Returns a full cost breakdown, estimated appointment number, AND a "
                "confirmation_token that is required by create_booking. "
                "Always call this first — only call create_booking after the patient "
                "explicitly confirms the preview."
            ),
            args_schema=PrepareBookingInput),
        StructuredTool.from_function(
            func=create_booking, name="create_booking",
            description=(
                "Commit a confirmed booking to the database. "
                "Requires the confirmation_token from the prepare_booking result — "
                "the call is rejected without it. Only call AFTER the patient has "
                "confirmed the prepare_booking preview."
            ),
            args_schema=BookingInput),
        StructuredTool.from_function(
            func=lookup_booking, name="lookup_booking",
            description="Retrieve existing bookings by reference or phone number.",
            args_schema=LookupInput),
        StructuredTool.from_function(
            func=reschedule_booking, name="reschedule_booking",
            description=(
                "Move a confirmed booking to a different session with the same consultant. "
                "Requires: booking reference, new_date (YYYY-MM-DD), new_time (HH:MM 24h). "
                "The tool looks up the correct session automatically — do NOT pass a session_id. "
                "Enforces: same consultant, at least 6 hours before original session, "
                "one reschedule per booking, and available slots in the new session. "
                "Only call after the patient has confirmed the new date and time choice."
            ),
            args_schema=RescheduleInput),
    ]