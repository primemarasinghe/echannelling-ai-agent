from datetime import date as DateType, time as TimeType
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update as sql_update
from sqlalchemy.orm import Session as OrmSession, joinedload

from app.db import get_db
from app.models import Booking, Consultant, DoctorNotification, Session
from app.services.auth_service import get_current_user
from app.models import User

router = APIRouter(prefix="/api/portal", tags=["portal"])


class CreateSessionBody(BaseModel):
    session_date: str   # "YYYY-MM-DD"
    start_time: str     # "HH:MM"
    end_time: str       # "HH:MM"
    total_slots: int


class UpdateProfileBody(BaseModel):
    name: Optional[str] = None
    qualifications: Optional[str] = None
    years_experience: Optional[int] = None
    consultation_fee: Optional[float] = None
    languages: Optional[str] = None


def _require_doctor(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access only")
    return current_user


@router.get("/dashboard")
def doctor_dashboard(
    db: OrmSession = Depends(get_db),
    current_user: User = Depends(_require_doctor),
):
    consultant = db.execute(
        select(Consultant)
        .options(joinedload(Consultant.hospital))
        .where(Consultant.email == current_user.email)
    ).unique().scalar_one_or_none()

    if not consultant:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    sessions = db.execute(
        select(Session)
        .where(Session.consultant_id == consultant.id)
        .order_by(Session.session_date.desc(), Session.start_time)
    ).scalars().all()

    session_data = []
    total_bookings = 0
    total_revenue = 0.0

    for s in sessions:
        bookings = db.execute(
            select(Booking)
            .where(Booking.session_id == s.id)
            .where(Booking.status == "CONFIRMED")
            .order_by(Booking.appointment_number)
        ).scalars().all()

        total_bookings += len(bookings)
        total_revenue  += len(bookings) * consultant.consultation_fee

        session_data.append({
            "id":              s.id,
            "session_date":    s.session_date.isoformat(),
            "start_time":      str(s.start_time)[:5],
            "end_time":        str(s.end_time)[:5],
            "total_slots":     s.total_slots,
            "booked_slots":    s.booked_slots,
            "available_slots": s.available_slots,
            "patients": [
                {
                    "appointment_number": b.appointment_number,
                    "patient_name":       b.patient_name,
                    "patient_phone":      b.patient_phone,
                    "reference":          b.reference,
                    "amount":             b.amount,
                    "created_at":         b.created_at.isoformat(),
                }
                for b in bookings
            ],
        })

    return {
        "consultant": {
            "id":               consultant.id,
            "name":             consultant.name,
            "email":            consultant.email,
            "specialty":        consultant.specialty,
            "qualifications":   consultant.qualifications,
            "years_experience": consultant.years_experience,
            "consultation_fee": consultant.consultation_fee,
            "languages":        consultant.languages,
            "hospital":         consultant.hospital.name,
            "city":             consultant.hospital.city,
        },
        "stats": {
            "total_sessions":  len(sessions),
            "total_bookings":  total_bookings,
            "total_revenue":   round(total_revenue, 2),
            "upcoming_sessions": sum(1 for s in sessions if s.available_slots > 0),
        },
        "sessions": session_data,
    }


@router.patch("/profile")
def update_profile(
    body: UpdateProfileBody,
    db: OrmSession = Depends(get_db),
    current_user: User = Depends(_require_doctor),
):
    consultant = db.execute(
        select(Consultant)
        .options(joinedload(Consultant.hospital))
        .where(Consultant.email == current_user.email)
    ).unique().scalar_one_or_none()
    if not consultant:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    if body.name is not None and body.name.strip():
        consultant.name = body.name.strip()
    if body.qualifications is not None:
        consultant.qualifications = body.qualifications
    if body.years_experience is not None:
        if body.years_experience < 0:
            raise HTTPException(status_code=400, detail="Years experience must be ≥ 0")
        consultant.years_experience = body.years_experience
    if body.consultation_fee is not None:
        if body.consultation_fee <= 0:
            raise HTTPException(status_code=400, detail="Consultation fee must be > 0")
        consultant.consultation_fee = body.consultation_fee
    if body.languages is not None:
        consultant.languages = body.languages

    db.commit()
    db.refresh(consultant)

    return {
        "id":               consultant.id,
        "name":             consultant.name,
        "email":            consultant.email,
        "specialty":        consultant.specialty,
        "qualifications":   consultant.qualifications,
        "years_experience": consultant.years_experience,
        "consultation_fee": consultant.consultation_fee,
        "languages":        consultant.languages,
        "hospital":         consultant.hospital.name,
        "city":             consultant.hospital.city,
    }


@router.post("/sessions", status_code=201)
def create_session(
    body: CreateSessionBody,
    db: OrmSession = Depends(get_db),
    current_user: User = Depends(_require_doctor),
):
    consultant = db.execute(
        select(Consultant).where(Consultant.email == current_user.email)
    ).scalar_one_or_none()
    if not consultant:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    try:
        sess_date = DateType.fromisoformat(body.session_date)
        start     = TimeType.fromisoformat(body.start_time)
        end       = TimeType.fromisoformat(body.end_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date or time format")

    if sess_date < DateType.today():
        raise HTTPException(status_code=400, detail="Session date cannot be in the past")

    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    if not (1 <= body.total_slots <= 100):
        raise HTTPException(status_code=400, detail="Total slots must be between 1 and 100")

    existing = db.execute(
        select(Session)
        .where(Session.consultant_id == consultant.id)
        .where(Session.session_date == sess_date)
        .where(Session.start_time == start)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A session already exists at this date and start time",
        )

    session = Session(
        consultant_id=consultant.id,
        session_date=sess_date,
        start_time=start,
        end_time=end,
        total_slots=body.total_slots,
        booked_slots=0,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "id":              session.id,
        "session_date":    session.session_date.isoformat(),
        "start_time":      str(session.start_time)[:5],
        "end_time":        str(session.end_time)[:5],
        "total_slots":     session.total_slots,
        "booked_slots":    0,
        "available_slots": session.total_slots,
        "patients":        [],
    }


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: OrmSession = Depends(get_db),
    current_user: User = Depends(_require_doctor),
):
    consultant = db.execute(
        select(Consultant).where(Consultant.email == current_user.email)
    ).scalar_one_or_none()
    if not consultant:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    session = db.execute(
        select(Session)
        .where(Session.id == session_id)
        .where(Session.consultant_id == consultant.id)
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.booked_slots > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {session.booked_slots} confirmed booking(s) exist",
        )

    db.delete(session)
    db.commit()


# ── Helpers shared by notification endpoints ─────────────────────────────────
def _get_consultant(db: OrmSession, email: str) -> Consultant:
    c = db.execute(
        select(Consultant).where(Consultant.email == email)
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    return c


@router.get("/notifications")
def get_notifications(
    db: OrmSession = Depends(get_db),
    current_user: User = Depends(_require_doctor),
):
    consultant = _get_consultant(db, current_user.email)
    rows = db.execute(
        select(DoctorNotification)
        .where(DoctorNotification.consultant_id == consultant.id)
        .order_by(DoctorNotification.created_at.desc())
        .limit(50)
    ).scalars().all()
    return [
        {
            "id":         n.id,
            "message":    n.message,
            "is_read":    n.is_read,
            "created_at": n.created_at.isoformat(),
        }
        for n in rows
    ]


@router.patch("/notifications/read-all")
def mark_all_notifications_read(
    db: OrmSession = Depends(get_db),
    current_user: User = Depends(_require_doctor),
):
    consultant = _get_consultant(db, current_user.email)
    db.execute(
        sql_update(DoctorNotification)
        .where(DoctorNotification.consultant_id == consultant.id)
        .where(DoctorNotification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    db.commit()
    return {"ok": True}
