from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_key: str = Field(default="demo", max_length=64)


class SourceChunk(BaseModel):
    doc_id: str
    title: str
    snippet: str
    score: float


class ToolCall(BaseModel):
    name: str
    input: dict[str, Any]
    output_summary: str
    result_json: dict[str, Any] | None = None


class DoctorCard(BaseModel):
    consultant_id: int
    name: str
    specialty: str
    qualifications: str
    years_experience: int
    consultation_fee_lkr: float
    languages: str
    hospital: str
    city: str


class PendingBooking(BaseModel):
    confirmation_token: str
    session_id: int
    doctor: str
    hospital: str
    date: str
    day: str
    time: str
    estimated_appointment_number: int
    consultation_fee_lkr: float
    service_charge_lkr: float
    total_lkr: float
    patient_name: str
    patient_phone: str


class SessionCard(BaseModel):
    session_id: int
    doctor: str
    hospital: str
    date: str
    day: str
    start_time: str
    available_slots: int
    fee_lkr: float


class ChatResponse(BaseModel):
    answer: str
    grounded: bool
    mode: str
    sources: list[SourceChunk] = []
    tool_calls: list[ToolCall] = []
    latency_ms: int
    session_key: str
    pending_booking: PendingBooking | None = None
    doctor_cards: list[DoctorCard] | None = None
    session_cards: list[SessionCard] | None = None
    session_window: str | None = None
