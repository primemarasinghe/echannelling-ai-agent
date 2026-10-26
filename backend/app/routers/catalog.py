from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session as OrmSession, joinedload

from app.db import get_db
from app.models import (Booking, Consultant, Conversation, Hospital,
                        KBChunk, KnowledgeGap, LabTestBooking, Session, User)
from app.services.auth_service import require_admin

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/stats")
def stats(db: OrmSession = Depends(get_db), _: User = Depends(require_admin)):
    return {
        "consultants": db.scalar(select(func.count()).select_from(Consultant)),
        "hospitals": db.scalar(select(func.count()).select_from(Hospital)),
        "sessions": db.scalar(select(func.count()).select_from(Session)),
        "bookings": db.scalar(select(func.count()).select_from(Booking)),
        "lab_bookings": db.scalar(select(func.count()).select_from(LabTestBooking)),
        "kb_chunks": db.scalar(select(func.count()).select_from(KBChunk)),
        "messages_logged": db.scalar(select(func.count()).select_from(Conversation)),
    }


@router.get("/gaps")
def knowledge_gaps(db: OrmSession = Depends(get_db), _: User = Depends(require_admin)):
    """Return the 50 most recent queries that found no KB results."""
    rows = db.execute(
        select(KnowledgeGap)
        .order_by(KnowledgeGap.created_at.desc())
        .limit(50)
    ).scalars().all()
    return [
        {
            "id": r.id,
            "query": r.query,
            "session_key": r.session_key,
            "at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/bookings")
def bookings(db: OrmSession = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.execute(
        select(Booking)
        .options(joinedload(Booking.session).joinedload(Session.consultant))
        .order_by(Booking.id.desc()).limit(25)
    ).unique().scalars().all()
    return [{
        "reference": b.reference, "patient": b.patient_name,
        "doctor": b.session.consultant.name,
        "date": b.session.session_date.isoformat(),
        "appointment_number": b.appointment_number,
        "amount": b.amount, "status": b.status,
    } for b in rows]