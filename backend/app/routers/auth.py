import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Consultant, User
from app.services.auth_service import create_access_token, get_current_user
from app.services.email_svc import send_password_reset

router = APIRouter(prefix="/api/auth", tags=["auth"])
_settings = get_settings()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Pydantic schemas ─────────────────────────────────────────
class RegisterBody(BaseModel):
    name: str
    email: str
    password: str

class LoginBody(BaseModel):
    email: str
    password: str

class ForgotBody(BaseModel):
    email: str

class ResetBody(BaseModel):
    token: str
    password: str

class ProfileBody(BaseModel):
    name: str | None = None
    phone: str | None = None
    date_of_birth: str | None = None   # ISO date string YYYY-MM-DD
    gender: str | None = None
    blood_type: str | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None


# ── Helper ────────────────────────────────────────────────────
def _build_response(user: User, db: Session) -> dict:
    consultant = db.execute(
        select(Consultant).where(Consultant.email == user.email)
    ).scalar_one_or_none()
    return {
        "access_token": create_access_token(user),
        "user": {
            "id":            user.id,
            "email":         user.email,
            "name":          user.name,
            "picture":       user.picture,
            "role":          user.role,
            "consultant_id": consultant.id if consultant else None,
        },
    }


# ── Google Sign-In ────────────────────────────────────────────
@router.post("/google")
def google_signin(body: dict, db: Session = Depends(get_db)):
    credential = body.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Missing credential")
    if not _settings.google_client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured on server")

    try:
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            _settings.google_client_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {exc}")

    google_id = idinfo["sub"]
    email     = idinfo.get("email", "").lower()
    name      = idinfo.get("name", "")
    picture   = idinfo.get("picture", "")

    consultant = db.execute(
        select(Consultant).where(Consultant.email == email)
    ).scalar_one_or_none() if email else None

    if consultant:
        role = "doctor"
    elif email in _settings.admin_email_list:
        role = "admin"
    else:
        role = "user"

    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        # Could be an existing email/password user linking Google
        user = db.query(User).filter(User.email == email).first()

    if user:
        user.google_id  = google_id
        user.name       = name
        user.picture    = picture
        user.role       = role
        user.last_login = datetime.now(timezone.utc)
    else:
        user = User(
            google_id=google_id,
            email=email,
            name=name,
            picture=picture,
            role=role,
            last_login=datetime.now(timezone.utc),
        )
        db.add(user)

    db.commit()
    db.refresh(user)
    return _build_response(user, db)


# ── Email / Password Register ─────────────────────────────────
@router.post("/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    email = body.email.strip().lower()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    consultant = db.execute(
        select(Consultant).where(Consultant.email == email)
    ).scalar_one_or_none()

    role = "doctor" if consultant else ("admin" if email in _settings.admin_email_list else "user")

    user = User(
        email=email,
        name=body.name.strip(),
        password_hash=_pwd.hash(body.password),
        role=role,
        last_login=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _build_response(user, db)


# ── Email / Password Login ────────────────────────────────────
@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user  = db.query(User).filter(User.email == email).first()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not _pwd.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return _build_response(user, db)


# ── Forgot Password ───────────────────────────────────────────
@router.post("/forgot-password")
def forgot_password(body: ForgotBody, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user  = db.query(User).filter(User.email == email).first()

    if user:
        if not user.password_hash:
            # Google Sign-In account — no password to reset
            return {"ok": False, "google_account": True,
                    "message": "This account uses Google Sign-In. Please sign in with Google instead."}
        token = secrets.token_urlsafe(32)
        user.reset_token        = token
        user.reset_token_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()
        reset_link = f"{_settings.frontend_url}?reset_token={token}"
        send_password_reset(
            to_email=user.email,
            reset_link=reset_link,
            patient_name=user.name or "there",
        )

    return {"ok": True, "message": "If that email exists, a reset link has been sent."}


# ── Reset Password ────────────────────────────────────────────
@router.post("/reset-password")
def reset_password(body: ResetBody, db: Session = Depends(get_db)):
    now  = datetime.now(timezone.utc)
    user = db.query(User).filter(User.reset_token == body.token).first()

    if not user or not user.reset_token_expiry:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

    expiry = user.reset_token_expiry
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if now > expiry:
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user.password_hash      = _pwd.hash(body.password)
    user.reset_token        = None
    user.reset_token_expiry = None
    db.commit()
    return {"ok": True}


# ── Update Profile ────────────────────────────────────────────
@router.patch("/profile")
def update_profile(body: ProfileBody, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from datetime import date as date_type
    if body.name is not None and body.name.strip():
        current_user.name = body.name.strip()
    if body.phone is not None:
        current_user.phone = body.phone.strip() or None
    if body.date_of_birth is not None:
        try:
            current_user.date_of_birth = date_type.fromisoformat(body.date_of_birth) if body.date_of_birth else None
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if body.gender is not None:
        current_user.gender = body.gender or None
    if body.blood_type is not None:
        current_user.blood_type = body.blood_type or None
    if body.address is not None:
        current_user.address = body.address.strip() or None
    if body.emergency_contact_name is not None:
        current_user.emergency_contact_name = body.emergency_contact_name.strip() or None
    if body.emergency_contact_phone is not None:
        current_user.emergency_contact_phone = body.emergency_contact_phone.strip() or None

    db.commit()
    db.refresh(current_user)
    return _profile_dict(current_user)


def _profile_dict(u: User) -> dict:
    return {
        "id":                      u.id,
        "email":                   u.email,
        "name":                    u.name,
        "picture":                 u.picture,
        "role":                    u.role,
        "phone":                   u.phone,
        "date_of_birth":           u.date_of_birth.isoformat() if u.date_of_birth else None,
        "gender":                  u.gender,
        "blood_type":              u.blood_type,
        "address":                 u.address,
        "emergency_contact_name":  u.emergency_contact_name,
        "emergency_contact_phone": u.emergency_contact_phone,
    }


# ── Me ────────────────────────────────────────────────────────
@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.refresh(current_user)
    return _profile_dict(current_user)
