"""Lab test booking via PayHere sandbox — mirrors the doctor payment flow."""
import hashlib
import json
import logging
import random
import string

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from app.config import get_settings
from app.db import SessionLocal, get_db
from app.models import LabTestBooking, User
from app.services.auth_service import get_optional_user, require_admin

router = APIRouter(prefix="/api/labtests", tags=["labtests"])
_log = logging.getLogger(__name__)


def _payhere_hash(merchant_id: str, order_id: str, amount: str, currency: str, secret: str) -> str:
    secret_md5 = hashlib.md5(secret.encode()).hexdigest().upper()
    return hashlib.md5(f"{merchant_id}{order_id}{amount}{currency}{secret_md5}".encode()).hexdigest().upper()


class LabTestItem(BaseModel):
    code: str
    name: str
    price: float


class InitiateRequest(BaseModel):
    patient_name: str
    patient_phone: str
    patient_email: str | None = None
    tests: list[LabTestItem]


@router.post("/initiate")
def initiate(req: InitiateRequest,
             current_user: User | None = Depends(get_optional_user),
             db: OrmSession = Depends(get_db)):
    settings = get_settings()
    if not settings.payhere_merchant_id or not settings.payhere_merchant_secret:
        raise HTTPException(503, "Payment gateway not configured.")
    if not req.tests:
        raise HTTPException(400, "No tests selected.")

    total = round(sum(t.price for t in req.tests), 2)
    ref = "LAB" + "".join(random.choices(string.digits, k=9))
    order_id = f"LAB-{ref[3:11]}"

    booking = LabTestBooking(
        reference=ref,
        user_id=current_user.id if current_user else None,
        patient_name=req.patient_name.strip(),
        patient_phone=req.patient_phone.strip(),
        patient_email=(req.patient_email or "").strip() or None,
        tests_json=json.dumps([t.model_dump() for t in req.tests]),
        total_amount=total,
        status="PENDING",
        order_id=order_id,
    )
    db.add(booking)
    db.commit()

    merchant_id = settings.payhere_merchant_id
    amount_str = f"{total:.2f}"
    currency = "LKR"
    parts = req.patient_name.strip().split(None, 1)
    first_name = parts[0] if parts else "Patient"
    last_name = parts[1] if len(parts) > 1 else "."

    return {
        "reference": ref,
        "merchant_id": merchant_id,
        "order_id": order_id,
        "amount": amount_str,
        "currency": currency,
        "hash": _payhere_hash(merchant_id, order_id, amount_str, currency,
                              settings.payhere_merchant_secret),
        "items": f"Lab Tests — {', '.join(t.code for t in req.tests)}",
        "first_name": first_name,
        "last_name": last_name,
        "email": req.patient_email or "patient@echannelling.lk",
        "phone": req.patient_phone,
        "address": "23 Deshamanya H K Dharmadasa Mawatha",
        "city": "Colombo",
        "country": "Sri Lanka",
        "notify_url": f"{settings.app_base_url}/api/labtests/notify",
    }


class CompleteRequest(BaseModel):
    reference: str
    order_id: str
    payment_id: str | None = None
    patient_email: str | None = None


@router.post("/complete")
def complete(req: CompleteRequest, db: OrmSession = Depends(get_db)):
    booking = db.execute(
        select(LabTestBooking).where(LabTestBooking.reference == req.reference)
    ).scalar_one_or_none()

    if not booking:
        raise HTTPException(404, "Booking reference not found.")
    if booking.status == "CONFIRMED":
        return {"status": "CONFIRMED", "reference": booking.reference, "already_existed": True}
    if booking.status == "FAILED":
        raise HTTPException(400, "This booking was cancelled.")

    if req.patient_email and req.patient_email.strip():
        booking.patient_email = req.patient_email.strip()

    booking.status = "CONFIRMED"
    db.commit()
    db.refresh(booking)

    if booking.patient_email:
        try:
            from app.services.email_svc import send_lab_test_confirmation
            tests = json.loads(booking.tests_json)
            send_lab_test_confirmation(
                to_email=booking.patient_email,
                ref=booking.reference,
                patient_name=booking.patient_name,
                tests=tests,
                total_lkr=booking.total_amount,
            )
        except Exception as exc:
            _log.warning("Lab confirmation email failed: %s", exc)

    _log.info("Lab test booking confirmed: ref=%s", booking.reference)
    return {"status": "CONFIRMED", "reference": booking.reference}


def _verify_ipn(form: dict, secret: str) -> bool:
    try:
        secret_md5 = hashlib.md5(secret.encode()).hexdigest().upper()
        raw = (form.get("merchant_id", "") + form.get("order_id", "") +
               form.get("payhere_amount", "") + form.get("payhere_currency", "") +
               form.get("status_code", "") + secret_md5)
        return hashlib.md5(raw.encode()).hexdigest().upper() == form.get("md5sig", "").upper()
    except Exception:
        return False


@router.post("/notify")
async def notify(request: Request):
    settings = get_settings()
    try:
        form = dict(await request.form())
    except Exception as exc:
        _log.warning("Lab IPN parse failed: %s", exc)
        return {"status": "ok"}

    if settings.payhere_merchant_secret and not _verify_ipn(form, settings.payhere_merchant_secret):
        _log.warning("Lab IPN rejected — invalid signature. order_id=%s", form.get("order_id"))
        return {"status": "ok"}

    status_code = form.get("status_code")
    order_id = form.get("order_id", "")

    try:
        with SessionLocal() as db:
            booking = db.execute(
                select(LabTestBooking).where(LabTestBooking.order_id == order_id)
            ).scalar_one_or_none()
            if booking:
                if status_code == "2":
                    booking.status = "CONFIRMED"
                elif status_code in ("-1", "-2", "-3"):
                    booking.status = "FAILED"
                db.commit()
    except Exception as exc:
        _log.error("Lab IPN DB update failed: %s", exc)

    if status_code == "2":
        _log.info("Lab IPN — success: order=%s", order_id)
    elif status_code in ("-1", "-2", "-3"):
        _log.warning("Lab IPN — failed: order=%s status=%s", order_id, status_code)

    return {"status": "ok"}


@router.get("/bookings")
def lab_bookings(db: OrmSession = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.execute(
        select(LabTestBooking).order_by(LabTestBooking.id.desc()).limit(50)
    ).scalars().all()
    return [{
        "reference": r.reference,
        "patient": r.patient_name,
        "phone": r.patient_phone,
        "tests": json.loads(r.tests_json),
        "total": r.total_amount,
        "status": r.status,
        "created_at": r.created_at.isoformat(),
    } for r in rows]
