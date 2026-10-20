from datetime import date, datetime, time

from pgvector.sqlalchemy import Vector
from sqlalchemy import (Boolean, Date, DateTime, Float, ForeignKey, Index,
                        Integer, String, Text, Time, UniqueConstraint, func,
                        text)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import get_settings
from app.db import Base

settings = get_settings()


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    city: Mapped[str] = mapped_column(String(60), index=True)
    address: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(40))

    consultants: Mapped[list["Consultant"]] = relationship(back_populates="hospital")


class Consultant(Base):
    __tablename__ = "consultants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True, unique=True, index=True)
    specialty: Mapped[str] = mapped_column(String(80), index=True)
    qualifications: Mapped[str] = mapped_column(String(160))
    years_experience: Mapped[int] = mapped_column(Integer)
    consultation_fee: Mapped[float] = mapped_column(Float)
    languages: Mapped[str] = mapped_column(String(120))
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))

    hospital: Mapped[Hospital] = relationship(back_populates="consultants")
    sessions: Mapped[list["Session"]] = relationship(
        back_populates="consultant", cascade="all, delete-orphan"
    )


class Session(Base):
    """A doctor's channelling session on one date, holding N appointment slots."""

    __tablename__ = "sessions"
    __table_args__ = (UniqueConstraint("consultant_id", "session_date", "start_time"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    consultant_id: Mapped[int] = mapped_column(ForeignKey("consultants.id"))
    session_date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    total_slots: Mapped[int] = mapped_column(Integer, default=20)
    booked_slots: Mapped[int] = mapped_column(Integer, default=0)

    consultant: Mapped[Consultant] = relationship(back_populates="sessions")

    @property
    def available_slots(self) -> int:
        return max(0, self.total_slots - self.booked_slots)


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        Index(
            "uq_booking_session_phone_confirmed",
            "session_id", "patient_phone",
            unique=True,
            postgresql_where=text("status = 'CONFIRMED'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"))
    patient_name: Mapped[str] = mapped_column(String(120))
    patient_phone: Mapped[str] = mapped_column(String(30), index=True)
    patient_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    appointment_number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="CONFIRMED")
    amount: Mapped[float] = mapped_column(Float)
    rescheduled: Mapped[bool] = mapped_column(Boolean, default=False)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    session: Mapped[Session] = relationship(lazy="select")


class KBChunk(Base):
    """A chunk of an approved policy document, with its embedding.

    This is the pgvector table. `embedding` holds the OpenAI vector; similarity
    search runs directly against this column in SQL.
    """

    __tablename__ = "kb_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    doc_id: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(160))
    source_file: Mapped[str] = mapped_column(String(120))
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.embedding_dimensions))
    approved: Mapped[bool] = mapped_column(Boolean, default=True)


class Conversation(Base):
    """Message log. Feeds conversation memory and, later, analytics."""

    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_key: Mapped[str] = mapped_column(String(64), index=True)
    role: Mapped[str] = mapped_column(String(16))          # user | assistant
    content: Mapped[str] = mapped_column(Text)
    grounded: Mapped[bool] = mapped_column(Boolean, default=True)
    tools_used: Mapped[str] = mapped_column(Text, default="")
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    context_note: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)


class User(Base):
    """Authenticated user — Google Sign-In or email/password."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    google_id: Mapped[str | None] = mapped_column(String(120), unique=True, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    picture: Mapped[str | None] = mapped_column(String(500), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reset_token: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reset_token_expiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Patient profile fields
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    blood_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)


class DoctorNotification(Base):
    """In-app notification created whenever a patient books a doctor's session."""

    __tablename__ = "doctor_notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    consultant_id: Mapped[int] = mapped_column(ForeignKey("consultants.id"), index=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class LabTestBooking(Base):
    __tablename__ = "lab_test_bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    patient_name: Mapped[str] = mapped_column(String(120))
    patient_phone: Mapped[str] = mapped_column(String(30), index=True)
    patient_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tests_json: Mapped[str] = mapped_column(Text)  # JSON: [{code,name,price}]
    total_amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    order_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class KnowledgeGap(Base):
    """Queries where the knowledge base returned no relevant results.

    Used to identify documentation gaps and prioritise content updates.
    """

    __tablename__ = "knowledge_gaps"

    id: Mapped[int] = mapped_column(primary_key=True)
    query: Mapped[str] = mapped_column(Text)
    session_key: Mapped[str] = mapped_column(String(64), index=True, default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())