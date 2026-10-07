from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete as sql_delete, func, select
from sqlalchemy.orm import Session as OrmSession, joinedload

from app.db import get_db
from app.models import Booking, Consultant, Session, Hospital
from app.services.auth_service import require_admin

router = APIRouter(prefix="/api/doctors", tags=["doctors"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateDoctorBody(BaseModel):
    name: str
    email: str
    specialty: str
    qualifications: str
    years_experience: int
    consultation_fee: float
    languages: str
    hospital_id: int


class UpdateDoctorBody(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    specialty: Optional[str] = None
    qualifications: Optional[str] = None
    years_experience: Optional[int] = None
    consultation_fee: Optional[float] = None
    languages: Optional[str] = None
    hospital_id: Optional[int] = None


# ── Hospitals list (used by register form) ────────────────────────────────────
# NOTE: must be declared before /{doctor_id} so FastAPI doesn't eat "hospitals"

@router.get("/hospitals")
def list_hospitals(db: OrmSession = Depends(get_db)):
    rows = db.execute(select(Hospital).order_by(Hospital.name)).scalars().all()
    return [{"id": h.id, "name": h.name, "city": h.city} for h in rows]


# ── Register new doctor (admin only) ─────────────────────────────────────────

@router.post("")
def create_doctor(
    body: CreateDoctorBody,
    db: OrmSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    hospital = db.get(Hospital, body.hospital_id)
    if not hospital:
        raise HTTPException(status_code=400, detail="Hospital not found")

    if body.email:
        if not body.email.lower().endswith("@gmail.com"):
            raise HTTPException(status_code=400, detail="Doctor email must be a Gmail address (@gmail.com)")
        existing = db.execute(
            select(Consultant).where(Consultant.email == body.email)
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="A doctor with this email already exists")

    consultant = Consultant(
        name=body.name,
        email=body.email,
        specialty=body.specialty,
        qualifications=body.qualifications,
        years_experience=body.years_experience,
        consultation_fee=body.consultation_fee,
        languages=body.languages,
        hospital_id=body.hospital_id,
    )
    db.add(consultant)
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
        "hospital":         hospital.name,
        "city":             hospital.city,
    }


# ── Update doctor (admin only) ───────────────────────────────────────────────

@router.patch("/{doctor_id}")
def update_doctor(
    doctor_id: int,
    body: UpdateDoctorBody,
    db: OrmSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    consultant = db.execute(
        select(Consultant)
        .options(joinedload(Consultant.hospital))
        .where(Consultant.id == doctor_id)
    ).unique().scalar_one_or_none()
    if not consultant:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if body.email is not None and body.email != consultant.email:
        if not body.email.lower().endswith("@gmail.com"):
            raise HTTPException(status_code=400, detail="Doctor email must be a Gmail address (@gmail.com)")
        clash = db.execute(
            select(Consultant)
            .where(Consultant.email == body.email)
            .where(Consultant.id != doctor_id)
        ).scalar_one_or_none()
        if clash:
            raise HTTPException(status_code=409, detail="A doctor with this email already exists")

    if body.name is not None:             consultant.name             = body.name
    if body.email is not None:            consultant.email            = body.email
    if body.specialty is not None:        consultant.specialty        = body.specialty
    if body.qualifications is not None:   consultant.qualifications   = body.qualifications
    if body.years_experience is not None: consultant.years_experience = body.years_experience
    if body.consultation_fee is not None: consultant.consultation_fee = body.consultation_fee
    if body.languages is not None:        consultant.languages        = body.languages
    if body.hospital_id is not None:
        hosp = db.get(Hospital, body.hospital_id)
        if not hosp:
            raise HTTPException(status_code=400, detail="Hospital not found")
        consultant.hospital_id = body.hospital_id

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
        "hospital_id":      consultant.hospital_id,
        "hospital_address": consultant.hospital.address,
        "hospital_phone":   consultant.hospital.phone,
        "city":             consultant.hospital.city,
    }


# ── Delete doctor (admin only) ───────────────────────────────────────────────

@router.delete("/{doctor_id}", status_code=204)
def delete_doctor(
    doctor_id: int,
    db: OrmSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    consultant = db.get(Consultant, doctor_id)
    if not consultant:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Block if any confirmed bookings exist for this doctor's sessions
    confirmed_count = db.execute(
        select(func.count(Booking.id))
        .join(Session, Booking.session_id == Session.id)
        .where(Session.consultant_id == doctor_id)
        .where(Booking.status == "CONFIRMED")
    ).scalar() or 0

    if confirmed_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {confirmed_count} confirmed booking(s) exist. Cancel them first.",
        )

    # Cascade: delete bookings → sessions → consultant
    session_ids = db.execute(
        select(Session.id).where(Session.consultant_id == doctor_id)
    ).scalars().all()

    if session_ids:
        db.execute(sql_delete(Booking).where(Booking.session_id.in_(session_ids)))
        db.execute(sql_delete(Session).where(Session.consultant_id == doctor_id))

    db.delete(consultant)
    db.commit()


# ── List all doctors ──────────────────────────────────────────────────────────

@router.get("")
def list_doctors(db: OrmSession = Depends(get_db)):
    rows = db.execute(
        select(Consultant)
        .options(joinedload(Consultant.hospital))
        .order_by(Consultant.name)
    ).unique().scalars().all()

    return [
        {
            "id":               c.id,
            "name":             c.name,
            "specialty":        c.specialty,
            "qualifications":   c.qualifications,
            "years_experience": c.years_experience,
            "consultation_fee": c.consultation_fee,
            "languages":        c.languages,
            "hospital":         c.hospital.name,
            "city":             c.hospital.city,
        }
        for c in rows
    ]


# ── Doctor detail ─────────────────────────────────────────────────────────────

@router.get("/{doctor_id}")
def doctor_detail(doctor_id: int, db: OrmSession = Depends(get_db)):
    consultant = db.execute(
        select(Consultant)
        .options(joinedload(Consultant.hospital))
        .where(Consultant.id == doctor_id)
    ).unique().scalar_one_or_none()

    if not consultant:
        raise HTTPException(status_code=404, detail="Doctor not found")

    sessions = db.execute(
        select(Session)
        .where(Session.consultant_id == doctor_id)
        .order_by(Session.session_date, Session.start_time)
    ).scalars().all()

    session_data = []
    for s in sessions:
        bookings = db.execute(
            select(Booking)
            .where(Booking.session_id == s.id)
            .where(Booking.status == "CONFIRMED")
            .order_by(Booking.appointment_number)
        ).scalars().all()

        session_data.append({
            "id":              s.id,
            "session_date":    s.session_date.isoformat(),
            "start_time":      str(s.start_time)[:5],
            "end_time":        str(s.end_time)[:5],
            "total_slots":     s.total_slots,
            "booked_slots":    s.booked_slots,
            "available_slots": s.available_slots,
            "seats": [
                {
                    "number":       b.appointment_number,
                    "patient_name": b.patient_name,
                    "reference":    b.reference,
                    "status":       b.status,
                }
                for b in bookings
            ],
        })

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
        "hospital_id":      consultant.hospital_id,
        "hospital_address": consultant.hospital.address,
        "hospital_phone":   consultant.hospital.phone,
        "city":             consultant.hospital.city,
        "sessions":         session_data,
    }
