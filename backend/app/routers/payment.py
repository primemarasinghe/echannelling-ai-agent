"""PayHere sandbox payment gateway integration.

Flow:
  1. POST /api/payment/initiate  — frontend asks for payment params + hash
  2. Frontend opens payhere.startPayment() popup
  3. POST /api/payment/complete  — frontend calls after onCompleted fires
  4. POST /api/payment/notify    — PayHere IPN webhook (sandbox: just logged)
"""
import hashlib
import logging
import random
import string

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.db import SessionLocal
from app.models import Booking, DoctorNotification, Session, User
from app.services.auth_service import get_optional_user
from app.services.tools import _PENDING_TOKENS, _purge_expired_tokens

router = APIRouter(prefix="/api/payment", tags=["payment"])
_log = logging.getLogger(__name__)


def _payhere_hash(merchant_id: str, order_id: str, amount: str,
                  currency: str, secret: str) -> str:
    secret_md5 = hashlib.md5(secret.encode()).hexdigest().upper()
    raw = f"{merchant_id}{order_id}{amount}{currency}{secret_md5}"
    return hashlib.md5(raw.encode()).hexdigest().upper()


class InitiateRequest(BaseModel):
    confirmation_token: str
    patient_name: str


@router.post("/initiate")
def initiate(req: InitiateRequest):
    settings = get_settings()

    if not settings.payhere_merchant_id or not settings.payhere_merchant_secret:
        raise HTTPException(503, "Payment gateway not configured. "
                            "Set PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET.")

    _purge_expired_tokens()
    pending = _PENDING_TOKENS.get(req.confirmation_token)
    if not pending:
        raise HTTPException(404, "Booking session expired. Please start the booking again.")

    with SessionLocal() as db:
        s = db.get(Session, pending["session_id"])
        if not s:
            raise HTTPException(404, "Session not found.")
        # Eager-load consultant for fee
        from sqlalchemy.orm import joinedload
        s = db.execute(
            select(Session)
            .options(joinedload(Session.consultant))
            .where(Session.id == pending["session_id"])
        ).scalar_one()
        amount = s.consultant.consultation_fee + 200.0
        description = (
            f"Channelling – {s.consultant.name} – "
            f"{s.session_date.strftime('%d %b %Y')} {s.start_time.strftime('%I:%M %p')}"
        )

    merchant_id = settings.payhere_merchant_id
    order_id = f"ECH-{req.confirmation_token[:8]}"
    amount_str = f"{amount:.2f}"
    currency = "LKR"

    parts = req.patient_name.strip().split(None, 1)
    first_name = parts[0] if parts else "Patient"
    last_name = parts[1] if len(parts) > 1 else "."

    return {
        "merchant_id": merchant_id,
        "order_id": order_id,
        "amount": amount_str,
        "currency": currency,
        "hash": _payhere_hash(merchant_id, order_id, amount_str, currency,
                              settings.payhere_merchant_secret),
        "items": description,
        "first_name": first_name,
        "last_name": last_name,
        "email": "patient@echannelling.lk",
        "phone": pending["patient_phone"],
        "address": "23 Deshamanya H K Dharmadasa Mawatha",
        "city": "Colombo",
        "country": "Sri Lanka",
        "notify_url": f"{settings.app_base_url}/api/payment/notify",
    }


class CompleteRequest(BaseModel):
    confirmation_token: str
    order_id: str
    payment_id: str | None = None
    patient_email: str | None = None


@router.post("/complete")
def complete(req: CompleteRequest, current_user: User | None = Depends(get_optional_user)):
    _purge_expired_tokens()
    pending = _PENDING_TOKENS.get(req.confirmation_token)
    if not pending:
        raise HTTPException(400,
            "Booking session expired or already confirmed. "
            "If you paid, your booking reference was already generated.")

    session_id = pending["session_id"]
    patient_name = pending["patient_name"]
    patient_phone = pending["patient_phone"]
    # Use frontend-supplied email; fall back to the logged-in user's email
    patient_email = (req.patient_email or "").strip() or (current_user.email if current_user else None)

    with SessionLocal() as db:
        s = db.execute(
            select(Session).where(Session.id == session_id).with_for_update()
        ).scalar_one_or_none()
        if not s:
            raise HTTPException(404, "Session not found.")
        if s.available_slots <= 0:
            raise HTTPException(409, "Session is now fully booked.")

        dupe = db.execute(
            select(Booking).where(
                Booking.session_id == session_id,
                Booking.patient_phone == patient_phone,
                Booking.status == "CONFIRMED",
            )
        ).scalar_one_or_none()
        if dupe:
            del _PENDING_TOKENS[req.confirmation_token]
            return {
                "status": "CONFIRMED",
                "reference": dupe.reference,
                "appointment_number": dupe.appointment_number,
                "already_existed": True,
            }

        s.booked_slots += 1
        ref = "ECH" + "".join(random.choices(string.digits, k=8))
        fee = s.consultant.consultation_fee + 200.0

        booking = Booking(
            reference=ref,
            session_id=s.id,
            patient_name=patient_name,
            patient_phone=patient_phone,
            patient_email=patient_email or None,
            appointment_number=s.booked_slots,
            amount=fee,
            status="CONFIRMED",
        )
        db.add(booking)

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            dupe2 = db.execute(
                select(Booking).where(
                    Booking.session_id == session_id,
                    Booking.patient_phone == patient_phone,
                    Booking.status == "CONFIRMED",
                )
            ).scalar_one_or_none()
            if dupe2:
                del _PENDING_TOKENS[req.confirmation_token]
                return {
                    "status": "CONFIRMED",
                    "reference": dupe2.reference,
                    "appointment_number": dupe2.appointment_number,
                    "already_existed": True,
                }
            raise

        booking_id = booking.id
        consultant_id = s.consultant_id
        doctor_name = s.consultant.name
        session_date_str = s.session_date.strftime("%d %b %Y")
        session_time_str = s.start_time.strftime("%I:%M %p")
        appt_num = booking.appointment_number

    # Fire doctor notification (best-effort, outside the booking transaction)
    try:
        with SessionLocal() as db:
            db.add(DoctorNotification(
                consultant_id=consultant_id,
                booking_id=booking_id,
                message=(
                    f"{patient_name} booked appointment "
                    f"#{appt_num} on {session_date_str} at {session_time_str} "
                    f"(paid via PayHere {req.order_id})"
                ),
            ))
            db.commit()
    except Exception as exc:
        _log.warning("Notification failed: %s", exc)

    # Token is single-use — consume it
    _PENDING_TOKENS.pop(req.confirmation_token, None)

    # Send confirmation email (best-effort)
    if patient_email:
        from app.services.email_svc import send_booking_confirmation
        send_booking_confirmation(
            to_email=patient_email,
            ref=ref,
            appt_num=appt_num,
            doctor=doctor_name,
            hospital="Nawaloka Hospital",
            date=session_date_str,
            time=session_time_str,
            patient_name=patient_name,
            patient_phone=patient_phone,
            total_lkr=fee,
        )

    _log.info("Payment booking confirmed: ref=%s order=%s", ref, req.order_id)
    return {
        "status": "CONFIRMED",
        "reference": ref,
        "appointment_number": appt_num,
        "doctor": doctor_name,
    }


@router.post("/notify")
async def notify(request: Request):
    """PayHere IPN webhook — logged only in sandbox."""
    try:
        form = dict(await request.form())
        _log.info("PayHere IPN: %s", form)
    except Exception as exc:
        _log.warning("IPN parse failed: %s", exc)
    return {"status": "ok"}
