from datetime import date, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from app.context import session_key_var
from app.db import get_db
from app.models import Conversation
from app import rate_limit as rl
from app.schemas import (ChatRequest, ChatResponse, DoctorCard, PendingBooking,
                         SessionCard, SourceChunk, ToolCall)
from app.services import agent as agent_svc
from app.services.retrieval import retrieve

router = APIRouter(prefix="/api", tags=["chat"])

HISTORY_TURNS = 8
_CONTEXT_NOTE_MAX = 1500


def _truncate_items(prefix: str, items: list[str], limit: int) -> str:
    """Join items under limit, dropping whole entries from the end with a count note."""
    kept: list[str] = []
    for i, item in enumerate(items):
        candidate = prefix + "; ".join(kept + [item])
        if len(candidate) > limit and kept:
            dropped = len(items) - i
            return prefix + "; ".join(kept) + f" (+{dropped} more not listed)"
        kept.append(item)
    return prefix + "; ".join(kept)


def _build_context_note(tool_calls: list[dict]) -> str | None:
    parts: list[str] = []
    for call in tool_calls:
        name = call["name"]
        rj = call.get("result_json") or {}

        if name == "search_consultants":
            doctors = rj.get("doctors", [])
            if doctors:
                items = [
                    f"{i}. {d['name']} (id {d['consultant_id']}, {d['specialty']}, "
                    f"{d['hospital']}, {d['city']}, Rs {int(d['consultation_fee_lkr'])}, "
                    f"{d['years_experience']}y exp, langs {d['languages']}, "
                    f"{d['qualifications']})"
                    for i, d in enumerate(doctors, 1)
                ]
                parts.append(_truncate_items("Doctors shown: ", items, _CONTEXT_NOTE_MAX))

        elif name == "get_availability":
            sessions = rj.get("sessions", [])
            if sessions:
                inp = call.get("input") or {}
                raw_from = inp.get("from_date") or date.today().isoformat()
                days = inp.get("days_ahead") or 14
                from_dt = date.fromisoformat(raw_from)
                to_dt = from_dt + timedelta(days=days)
                prefix = (
                    f"Sessions shown (next {days} days only, "
                    f"from {from_dt} to {to_dt}): "
                )
                items = [
                    f"{i}. session_id {s['session_id']}, {s['doctor']}, "
                    f"{s['hospital']}, {s['date']} ({s['day']}) {s['start_time']}, "
                    f"{s['available_slots']} slots, Rs {int(s['fee_lkr'])}"
                    for i, s in enumerate(sessions, 1)
                ]
                parts.append(_truncate_items(prefix, items, _CONTEXT_NOTE_MAX))

        elif name == "prepare_booking" and rj.get("status") == "READY_TO_CONFIRM":
            token = rj.get("confirmation_token", "")
            sid = rj.get("session_id", "")
            parts.append(f"Pending booking: session_id {sid}, confirmation_token {token}")

        elif name == "create_booking" and rj.get("reference"):
            parts.append(
                f"Booked: reference {rj['reference']}, "
                f"session_id {rj.get('session_id', '')}, "
                f"{rj.get('doctor', '')}, "
                f"{rj.get('date', '')} {rj.get('time', '')}, "
                f"phone {rj.get('patient_phone', '')}"
            )

    if not parts:
        return None
    note = " | ".join(parts)
    return note


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request, db: OrmSession = Depends(get_db)):
    # Rate-limit by both session_key and client IP
    rl.check(req.session_key, request)

    # Make session_key available to tools for gap logging
    session_key_var.set(req.session_key)

    history = db.execute(
        select(Conversation)
        .where(Conversation.session_key == req.session_key)
        .order_by(Conversation.id.desc())
        .limit(HISTORY_TURNS)
    ).scalars().all()
    history = list(reversed(history))

    result = agent_svc.run(req.message, history)

    # Re-run retrieval so the UI can display scored source cards.
    sources: list[SourceChunk] = []
    for call in result["tool_calls"]:
        if call["name"] != "search_knowledge_base":
            continue
        for c in retrieve(call["input"].get("query", req.message)):
            sources.append(SourceChunk(
                doc_id=c.doc_id, title=c.title,
                snippet=c.content[:400], score=c.score))

    # Extract doctor_cards if search_consultants ran this turn.
    doctor_cards: list[DoctorCard] | None = None
    for call in result["tool_calls"]:
        if call["name"] == "search_consultants" and call.get("result_json"):
            raw = call["result_json"].get("doctors", [])
            if raw:
                try:
                    doctor_cards = [DoctorCard(**d) for d in raw]
                except Exception:
                    pass
            break

    # Extract pending_booking if prepare_booking ran this turn.
    pending_booking: PendingBooking | None = None
    for call in result["tool_calls"]:
        if call["name"] == "prepare_booking" and call.get("result_json"):
            rj = call["result_json"]
            if rj.get("status") == "READY_TO_CONFIRM":
                try:
                    pending_booking = PendingBooking(**{
                        k: rj[k] for k in PendingBooking.model_fields
                    })
                except Exception:
                    pass
            break  # only use the first prepare_booking per turn

    # Extract session_cards and session_window if get_availability ran this turn.
    session_cards: list[SessionCard] | None = None
    session_window: str | None = None
    _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    for call in result["tool_calls"]:
        if call["name"] == "get_availability" and call.get("result_json"):
            raw = call["result_json"].get("sessions", [])
            if raw:
                try:
                    session_cards = [SessionCard(**s) for s in raw]
                except Exception:
                    pass
            inp = call.get("input") or {}
            raw_from = inp.get("from_date") or date.today().isoformat()
            days = inp.get("days_ahead") or 14
            from_dt = date.fromisoformat(raw_from)
            to_dt = from_dt + timedelta(days=days)
            session_window = (
                f"{from_dt.day} {_MONTHS[from_dt.month - 1]} – "
                f"{to_dt.day} {_MONTHS[to_dt.month - 1]}"
            )
            break

    context_note = _build_context_note(result["tool_calls"])

    db.add(Conversation(
        session_key=req.session_key, role="user", content=req.message))
    db.add(Conversation(
        session_key=req.session_key, role="assistant", content=result["answer"],
        grounded=result["grounded"],
        tools_used=",".join(t["name"] for t in result["tool_calls"]),
        latency_ms=result["latency_ms"],
        context_note=context_note))
    db.commit()

    return ChatResponse(
        answer=result["answer"],
        grounded=result["grounded"],
        mode=result["mode"],
        sources=sources,
        tool_calls=[ToolCall(
            name=t["name"],
            input=t["input"],
            output_summary=t["output_summary"],
            result_json=t.get("result_json"),
        ) for t in result["tool_calls"]],
        latency_ms=result["latency_ms"],
        session_key=req.session_key,
        pending_booking=pending_booking,
        doctor_cards=doctor_cards,
        session_cards=session_cards,
        session_window=session_window,
    )


@router.delete("/chat/{session_key}")
def clear_session(session_key: str, db: OrmSession = Depends(get_db)):
    rows = db.execute(select(Conversation).where(
        Conversation.session_key == session_key)).scalars().all()
    for r in rows:
        db.delete(r)
    db.commit()
    return {"cleared": len(rows)}
