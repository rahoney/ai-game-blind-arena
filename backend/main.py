from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
import os
import hashlib
import hmac
import base64
import secrets
import random
import re
import logging
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from postgrest.exceptions import APIError
try:
    from .database import supabase
    from .auth import create_firebase_custom_token, delete_firebase_user, get_firebase_app, get_public_firebase_config, get_super_admin_uids, require_firebase_user
    from .models import (
        Evaluation,
        PlayEvent,
        AccountLoginIdCreate,
        ProfileDisplayNameUpdate,
        ProfileIdentityUpdate,
        SignupEmailVerificationRequest,
        SignupEmailVerificationConfirm,
        LoginIdEmailRequest,
        FindLoginIdRequest,
        PasswordResetRequest,
        SendLoginIdEmailRequest,
        SocialProvidersUpdate,
        AccountDeletionRequest,
        CommentReactionToggle,
        CommentReplyCreate,
        AdminBlindToggle,
        ProfileBadgeUpdate,
        AccountDisplayNameChange,
    )
    from .services import GAMES_DATA, get_category_meta
    from .utils import (
        check_comment_submission_rate_limit,
        check_same_model_comment_rate_limit,
        check_reply_submission_rate_limit,
        validate_display_name,
        validate_comment_text,
        get_badge_info,
        check_memory_rate_limit,
        make_rate_limit_store,
        summarize_mypage_data,
        resolve_comment_reaction,
        build_user_badge_lookup,
        get_unlocked_badge_keys,
        resolve_profile_badge_key,
    )
except ImportError:
    from database import supabase
    from auth import create_firebase_custom_token, delete_firebase_user, get_firebase_app, get_public_firebase_config, get_super_admin_uids, require_firebase_user
    from models import (
        Evaluation,
        PlayEvent,
        AccountLoginIdCreate,
        ProfileDisplayNameUpdate,
        ProfileIdentityUpdate,
        SignupEmailVerificationRequest,
        SignupEmailVerificationConfirm,
        LoginIdEmailRequest,
        FindLoginIdRequest,
        PasswordResetRequest,
        SendLoginIdEmailRequest,
        SocialProvidersUpdate,
        AccountDeletionRequest,
        CommentReactionToggle,
        CommentReplyCreate,
        AdminBlindToggle,
        ProfileBadgeUpdate,
        AccountDisplayNameChange,
    )
    from services import GAMES_DATA, get_category_meta
    from utils import (
        check_comment_submission_rate_limit,
        check_same_model_comment_rate_limit,
        check_reply_submission_rate_limit,
        validate_display_name,
        validate_comment_text,
        get_badge_info,
        check_memory_rate_limit,
        make_rate_limit_store,
        summarize_mypage_data,
        resolve_comment_reaction,
        build_user_badge_lookup,
        get_unlocked_badge_keys,
        resolve_profile_badge_key,
    )

app = FastAPI(title="LLM Game Evaluator")
logger = logging.getLogger("veilplays")
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
COMMENT_REACTION_RATE_LIMITS = make_rate_limit_store()
COMMENT_REPLY_RATE_LIMITS = make_rate_limit_store()
COMMENT_SUBMISSION_HISTORY = make_rate_limit_store()
RECOVERY_RATE_LIMITS = make_rate_limit_store()
LOCAL_TEST_MODE = not bool(supabase)
LOCAL_DB = {
    "profiles": {},
    "game_stats": {},
    "evaluations": [],
    "user_views": [],
    "comment_reactions": [],
    "comment_replies": [],
    "auth_provider_accounts": [],
    "account_recovery_attempts": [],
    "signup_email_verifications": [],
}

# Enable CORS for local development
allowed_origins = [origin.strip() for origin in os.environ.get("CORS_ALLOW_ORIGINS", "").split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
LOGIN_ID_RE = re.compile(r"^[A-Za-z0-9]{4,15}$")
SERVICE_BRAND_NAME = "VeilPlays"
SERVICE_CONTEXT_NAME = "AI Game Blind Arena"
BLIND_TOKEN_SECRET = (
    os.getenv("BLIND_TOKEN_SECRET")
    or os.getenv("SECRET_KEY")
    or os.getenv("SUPABASE_JWT_SECRET")
    or "veilplays-local-blind-token-secret"
).encode("utf-8")


def _blind_digest(purpose: str, game_type: str, actual_model: str):
    message = f"{purpose}\0{game_type}\0{actual_model}".encode("utf-8")
    return base64.urlsafe_b64encode(
        hmac.new(BLIND_TOKEN_SECRET, message, hashlib.sha256).digest()
    ).decode("ascii").rstrip("=")


def _get_model_key(game_type: str, actual_model: str):
    return _blind_digest("model-key", game_type, actual_model)


def _get_blind_model_token(game_type: str, actual_model: str):
    return _blind_digest("blind-token", game_type, actual_model)


def _get_client_ip(request: Request):
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else request.client.host


def _invalid_recovery_input():
    raise HTTPException(status_code=400, detail="invalid_recovery_input")


def _normalize_email(email: str):
    return email.strip().casefold()


def _hash_recovery_identifier(*parts: str):
    secret = os.environ.get("ADMIN_TOKEN_SECRET") or os.environ.get("FIREBASE_PROJECT_ID") or "local"
    raw = "|".join(part.strip().casefold() for part in parts)
    return hashlib.sha256(f"{secret}:{raw}".encode("utf-8")).hexdigest()


def _hash_signup_verification_code(email: str, code: str):
    secret = os.environ.get("ADMIN_TOKEN_SECRET") or os.environ.get("FIREBASE_PROJECT_ID") or "local"
    raw = f"{_normalize_email(email)}:{code.strip()}"
    return hashlib.sha256(f"{secret}:{raw}".encode("utf-8")).hexdigest()


def _token_secret():
    return (os.environ.get("ADMIN_TOKEN_SECRET") or os.environ.get("FIREBASE_PROJECT_ID") or "local").encode("utf-8")


def _b64url_encode(data: bytes):
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str):
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _issue_signup_email_token(email: str):
    payload = {
        "email": _normalize_email(email),
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=30)).timestamp()),
    }
    payload_raw = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(_token_secret(), payload_raw.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_raw}.{_b64url_encode(signature)}"


def _verify_signup_email_token(token: str | None, email: str):
    if not token or "." not in token:
        return False
    payload_raw, signature_raw = token.split(".", 1)
    expected = _b64url_encode(hmac.new(_token_secret(), payload_raw.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(signature_raw, expected):
        return False
    try:
        payload = json.loads(_b64url_decode(payload_raw))
    except Exception:
        return False
    if payload.get("email") != _normalize_email(email):
        return False
    return int(payload.get("exp", 0)) >= int(datetime.now(timezone.utc).timestamp())


def _mask_login_id(login_id: str):
    prefix = login_id[:2] if len(login_id) >= 2 else login_id
    return (prefix + "*" * 15)[:15]


def _record_recovery_attempt(recovery_type: str, identifier_hash: str, request: Request, success: bool):
    row = {
        "recovery_type": recovery_type,
        "identifier_hash": identifier_hash,
        "ip_address": _get_client_ip(request),
        "user_agent": request.headers.get("User-Agent", ""),
        "success": success,
        "created_at": _now_iso(),
    }
    if LOCAL_TEST_MODE:
        LOCAL_DB["account_recovery_attempts"].append(row)
        return
    if supabase:
        try:
            supabase.table("account_recovery_attempts").insert(row).execute()
        except Exception:
            # Recovery audit failures should not reveal account state or block the user flow.
            return


def _check_recovery_rate_limit(recovery_type: str, identifier_hash: str, request: Request):
    ip = _get_client_ip(request)
    key = f"{recovery_type}:{identifier_hash}:{ip}"
    allowed, wait_time = check_memory_rate_limit(RECOVERY_RATE_LIMITS, key, 600, 5)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"recovery_rate_limited:{wait_time}")


def _send_login_id_email(email: str, login_id: str):
    api_key = os.environ.get("BREVO_API_KEY")
    sender_email = os.environ.get("MAIL_FROM_EMAIL")
    sender_name = os.environ.get("MAIL_FROM_NAME") or SERVICE_BRAND_NAME
    if not api_key or not sender_email:
        raise HTTPException(status_code=503, detail="mail_service_not_configured")

    body = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": email}],
        "subject": f"{SERVICE_BRAND_NAME} 아이디 안내",
        "textContent": (
            f"요청하신 {SERVICE_BRAND_NAME} 아이디는 {login_id} 입니다.\n\n"
            f"{SERVICE_CONTEXT_NAME} 계정 안내 메일입니다."
        ),
    }
    req = urllib_request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=10):
            return
    except urllib_error.HTTPError as exc:
        _log_brevo_error("login_id_email", exc)
        raise HTTPException(status_code=502, detail="mail_send_failed") from exc
    except urllib_error.URLError as exc:
        print(f"Brevo login_id_email network error: {exc}", flush=True)
        raise HTTPException(status_code=502, detail="mail_send_failed") from exc


def _is_mail_service_configured():
    return bool(os.environ.get("BREVO_API_KEY") and os.environ.get("MAIL_FROM_EMAIL"))


def _log_brevo_error(context: str, exc: urllib_error.HTTPError):
    try:
        body = exc.read().decode("utf-8", errors="replace")
    except Exception:
        body = ""
    print(f"Brevo {context} error: status={exc.code} body={body}", flush=True)


def _send_signup_verification_email(email: str, code: str):
    api_key = os.environ.get("BREVO_API_KEY")
    sender_email = os.environ.get("MAIL_FROM_EMAIL")
    sender_name = os.environ.get("MAIL_FROM_NAME") or SERVICE_BRAND_NAME
    if not api_key or not sender_email:
        raise HTTPException(status_code=503, detail="mail_service_not_configured")

    body = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": email}],
        "subject": f"{SERVICE_BRAND_NAME} 이메일 인증 코드",
        "textContent": (
            f"{SERVICE_BRAND_NAME} 회원가입 인증 코드는 {code} 입니다. 10분 안에 입력해 주세요.\n\n"
            f"{SERVICE_CONTEXT_NAME} 계정 인증 메일입니다."
        ),
    }
    req = urllib_request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=10):
            return
    except urllib_error.HTTPError as exc:
        _log_brevo_error("signup_verification", exc)
        raise HTTPException(status_code=502, detail="mail_send_failed") from exc
    except urllib_error.URLError as exc:
        print(f"Brevo signup_verification network error: {exc}", flush=True)
        raise HTTPException(status_code=502, detail="mail_send_failed") from exc


def _normalize_language(language: str | None):
    return "en" if (language or "").lower().startswith("en") else "ko"


def _send_password_reset_email(email: str, language: str | None = "ko"):
    api_key = os.environ.get("BREVO_API_KEY")
    sender_email = os.environ.get("MAIL_FROM_EMAIL")
    sender_name = os.environ.get("MAIL_FROM_NAME") or SERVICE_BRAND_NAME
    if not api_key or not sender_email:
        raise HTTPException(status_code=503, detail="mail_service_not_configured")

    try:
        from firebase_admin import auth as firebase_auth

        get_firebase_app()
        reset_link = firebase_auth.generate_password_reset_link(email)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="password_reset_link_failed") from exc

    lang = _normalize_language(language)
    if lang == "en":
        subject = f"{SERVICE_BRAND_NAME} Password Reset"
        text_content = (
            f"You requested a password reset for your {SERVICE_BRAND_NAME} account.\n\n"
            f"Open the link below to set a new password.\n{reset_link}\n\n"
            f"If you did not request this, you can ignore this email.\n\n"
            f"This is an account email for {SERVICE_CONTEXT_NAME}."
        )
    else:
        subject = f"{SERVICE_BRAND_NAME} 비밀번호 재설정"
        text_content = (
            f"{SERVICE_BRAND_NAME} 비밀번호 재설정을 요청하셨습니다.\n\n"
            f"아래 링크를 열어 새 비밀번호를 설정해 주세요.\n{reset_link}\n\n"
            f"본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.\n\n"
            f"{SERVICE_CONTEXT_NAME} 계정 안내 메일입니다."
        )

    body = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": email}],
        "subject": subject,
        "textContent": text_content,
    }
    req = urllib_request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=10):
            return
    except urllib_error.HTTPError as exc:
        _log_brevo_error("password_reset", exc)
        raise HTTPException(status_code=502, detail="mail_send_failed") from exc
    except urllib_error.URLError as exc:
        print(f"Brevo password_reset network error: {exc}", flush=True)
        raise HTTPException(status_code=502, detail="mail_send_failed") from exc


def _create_signup_email_verification(email: str, request: Request):
    normalized_email = _normalize_email(email)
    if not EMAIL_RE.fullmatch(normalized_email):
        _invalid_recovery_input()
    code = f"{secrets.randbelow(1000000):06d}"
    expires_in_seconds = 300
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)
    row = {
        "email": normalized_email,
        "code_hash": _hash_signup_verification_code(normalized_email, code),
        "ip_address": _get_client_ip(request),
        "user_agent": request.headers.get("User-Agent", ""),
        "expires_at": expires_at.isoformat(),
        "consumed_at": None,
        "created_at": _now_iso(),
    }
    if LOCAL_TEST_MODE:
        LOCAL_DB["signup_email_verifications"].append(row)
    elif supabase:
        try:
            supabase.table("signup_email_verifications").insert(row).execute()
        except APIError as exc:
            if getattr(exc, "code", "") == "PGRST205" or "signup_email_verifications" in str(exc):
                raise HTTPException(status_code=503, detail="signup_email_verification_not_configured") from exc
            raise
    else:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    _send_signup_verification_email(normalized_email, code)
    return {"sent": True, "expires_in_seconds": expires_in_seconds}


def _confirm_signup_email_verification(email: str, code: str):
    normalized_email = _normalize_email(email)
    code_hash = _hash_signup_verification_code(normalized_email, code)
    now = datetime.now(timezone.utc)
    if LOCAL_TEST_MODE:
        rows = [
            row for row in LOCAL_DB["signup_email_verifications"]
            if row["email"] == normalized_email and row["code_hash"] == code_hash and not row.get("consumed_at")
        ]
        rows.sort(key=lambda row: row.get("created_at", ""), reverse=True)
        row = rows[0] if rows else None
        if not row or datetime.fromisoformat(row["expires_at"]) < now:
            raise HTTPException(status_code=400, detail="invalid_verification_code")
        row["consumed_at"] = _now_iso()
        return {"verified": True, "email_verification_token": _issue_signup_email_token(normalized_email)}

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        res = (
            supabase.table("signup_email_verifications")
            .select("*")
            .eq("email", normalized_email)
            .eq("code_hash", code_hash)
            .is_("consumed_at", "null")
            .gte("expires_at", now.isoformat())
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        if getattr(exc, "code", "") == "PGRST205" or "signup_email_verifications" in str(exc):
            raise HTTPException(status_code=503, detail="signup_email_verification_not_configured") from exc
        raise
    row = (res.data or [None])[0]
    if not row:
        raise HTTPException(status_code=400, detail="invalid_verification_code")
    supabase.table("signup_email_verifications").update({"consumed_at": _now_iso()}).eq("id", row["id"]).execute()
    return {"verified": True, "email_verification_token": _issue_signup_email_token(normalized_email)}


def _validate_identity_fields(login_id: str, real_name: str, display_name: str, language: str | None = "ko"):
    if not LOGIN_ID_RE.fullmatch(login_id):
        raise HTTPException(status_code=400, detail="login_id_format")
    if not _is_valid_real_name(real_name, language):
        raise HTTPException(status_code=400, detail="real_name_format")
    is_valid, error_key = validate_display_name(display_name)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)


def _is_login_id_taken(login_id: str, current_uid: str | None = None):
    if not LOGIN_ID_RE.fullmatch(login_id):
        raise HTTPException(status_code=400, detail="login_id_format")

    if LOCAL_TEST_MODE:
        for existing_uid, existing in LOCAL_DB["profiles"].items():
            if current_uid and existing_uid == current_uid:
                continue
            if existing.get("login_id", "").casefold() == login_id.casefold():
                return True
        return False

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    duplicate_res = (
        supabase.table("profiles")
        .select("id, firebase_uid")
        .ilike("login_id", login_id)
        .limit(1)
        .execute()
    )
    duplicate = (duplicate_res.data or [None])[0]
    if not duplicate:
        return False
    return not current_uid or duplicate.get("firebase_uid") != current_uid


def _is_display_name_taken(display_name: str, current_uid: str | None = None):
    is_valid, error_key = validate_display_name(display_name)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)

    if LOCAL_TEST_MODE:
        for existing_uid, existing in LOCAL_DB["profiles"].items():
            if current_uid and existing_uid == current_uid:
                continue
            if existing.get("display_name", "").casefold() == display_name.casefold():
                return True
        return False

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    duplicate_res = (
        supabase.table("profiles")
        .select("id, firebase_uid")
        .ilike("display_name", display_name)
        .limit(1)
        .execute()
    )
    duplicate = (duplicate_res.data or [None])[0]
    if not duplicate:
        return False
    return not current_uid or duplicate.get("firebase_uid") != current_uid


def _find_profile_by_login_id(login_id: str):
    if not LOGIN_ID_RE.fullmatch(login_id):
        _invalid_recovery_input()

    if LOCAL_TEST_MODE:
        return next((
            profile for profile in LOCAL_DB["profiles"].values()
            if profile.get("login_id", "").casefold() == login_id.casefold()
        ), None)

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    res = (
        supabase.table("profiles")
        .select("id, firebase_uid, login_id, email")
        .ilike("login_id", login_id)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def _is_valid_real_name(real_name: str, language: str | None = "ko"):
    name = real_name.strip()
    if not name:
        return False
    if (language or "ko").split("-")[0].lower() == "en":
        return bool(re.fullmatch(r"[A-Za-z]+(?: [A-Za-z]+)*", name)) and len(re.sub(r"\s+", "", name)) >= 3
    return bool(re.fullmatch(r"[가-힣]{2,}", name))


def _normalize_provider_key(provider: str | None):
    provider_key = (provider or "").strip().lower()
    aliases = {
        "google.com": "google",
        "password": "password",
    }
    return aliases.get(provider_key, provider_key)


def _profile_payload_from_firebase_user(user: dict, role: str):
    firebase_info = user.get("firebase", {}) or {}
    sign_in_provider = firebase_info.get("sign_in_provider")
    provider = user.get("provider_key") if sign_in_provider == "custom" else sign_in_provider
    provider = _normalize_provider_key(provider)
    uid = user.get("uid", "")
    return {
        "firebase_uid": uid,
        "display_name": f"user_{uid[:8]}" if uid else "user",
        "display_name_set": False,
        "avatar_url": user.get("picture"),
        "role": role,
        "provider": provider,
        "email": user.get("email"),
        "email_verified": bool(user.get("email_verified")),
        "email_verification_required": not bool(user.get("email_verified")),
        "account_status": "active" if bool(user.get("email_verified")) else "email_unverified",
        "last_login_at": _now_iso(),
        "last_active_at": _now_iso(),
    }


def _auth_provider_from_firebase_user(user: dict):
    firebase_info = user.get("firebase", {}) or {}
    sign_in_provider = firebase_info.get("sign_in_provider")
    provider = user.get("provider_key") if sign_in_provider == "custom" else sign_in_provider
    return _normalize_provider_key(provider)


def _resolve_profile_for_firebase_user(user: dict):
    uid = user.get("uid", "")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid Firebase user")

    role = "super_admin" if uid in get_super_admin_uids() else "user"
    payload = _profile_payload_from_firebase_user(user, role)

    if LOCAL_TEST_MODE:
        existing = LOCAL_DB["profiles"].get(uid)
        if existing:
            update_payload = dict(payload)
            update_payload.pop("display_name", None)
            update_payload.pop("display_name_set", None)
            if not payload.get("email"):
                update_payload.pop("email", None)
                update_payload.pop("email_verified", None)
                update_payload.pop("email_verification_required", None)
                update_payload.pop("account_status", None)
            if not payload.get("avatar_url"):
                update_payload.pop("avatar_url", None)
            existing.update(update_payload)
            existing["role"] = "super_admin" if role == "super_admin" else existing.get("role", "user")
            existing["updated_at"] = _now_iso()
            return existing
        profile = {
            "id": str(uuid4()),
            **payload,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        LOCAL_DB["profiles"][uid] = profile
        return profile

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    try:
        existing_res = supabase.table("profiles").select("*").eq("firebase_uid", uid).limit(1).execute()
        existing = (existing_res.data or [None])[0]
        if existing:
            update_payload = dict(payload)
            update_payload.pop("display_name", None)
            update_payload.pop("display_name_set", None)
            if not payload.get("email"):
                update_payload.pop("email", None)
                update_payload.pop("email_verified", None)
                update_payload.pop("email_verification_required", None)
                update_payload.pop("account_status", None)
            if not payload.get("avatar_url"):
                update_payload.pop("avatar_url", None)
            if existing.get("role") and role != "super_admin":
                update_payload["role"] = existing["role"]
            update_payload["updated_at"] = _now_iso()
            updated_res = supabase.table("profiles").update(update_payload).eq("firebase_uid", uid).execute()
            return (updated_res.data or [None])[0] or {**existing, **update_payload}

        insert_payload = {
            **payload,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        inserted_res = supabase.table("profiles").insert(insert_payload).execute()
        return (inserted_res.data or [None])[0] or insert_payload
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to resolve auth profile") from exc


def _get_request_profile(request: Request, required: bool = True):
    authorization = request.headers.get("Authorization", "")
    if not authorization.strip():
        if required:
            raise HTTPException(status_code=401, detail="Missing Firebase ID token")
        return None, None
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    return user, profile


def _get_profile_display_name(profile: dict | None):
    return (profile or {}).get("display_name", "").strip()


def _get_profile_id(profile: dict | None):
    return (profile or {}).get("id")


def _get_actor_from_request(request: Request, required: bool = True):
    user, profile = _get_request_profile(request, required=required)
    if profile:
        display_name = _get_profile_display_name(profile)
        profile_id = _get_profile_id(profile)
        if not profile_id:
            raise HTTPException(status_code=500, detail="profile_id_missing")
        is_valid, error_key = validate_display_name(display_name)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_key)
        return {
            "user": user,
            "profile": profile,
            "user_id": profile_id,
            "display_name": display_name,
            "is_admin": profile.get("role") in ("admin", "super_admin"),
        }

    if required:
        raise HTTPException(status_code=401, detail="auth_required")
    return None


def _update_profile_display_name(profile: dict, display_name: str):
    is_valid, error_key = validate_display_name(display_name)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)

    uid = profile.get("firebase_uid")
    if LOCAL_TEST_MODE:
        for existing_uid, existing in LOCAL_DB["profiles"].items():
            if existing_uid != uid and existing.get("display_name", "").casefold() == display_name.casefold():
                raise HTTPException(status_code=409, detail="display_name_taken")
        profile.update({
            "display_name": display_name,
            "display_name_set": True,
            "updated_at": _now_iso(),
        })
        return profile

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    try:
        if _is_display_name_taken(display_name, uid):
            raise HTTPException(status_code=409, detail="display_name_taken")

        update_payload = {
            "display_name": display_name,
            "display_name_set": True,
            "updated_at": _now_iso(),
        }
        updated_res = supabase.table("profiles").update(update_payload).eq("firebase_uid", uid).execute()
        return (updated_res.data or [None])[0] or {**profile, **update_payload}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to update display name") from exc


def _update_profile_identity(profile: dict, payload: ProfileIdentityUpdate):
    _validate_identity_fields(payload.login_id, payload.real_name, payload.display_name, payload.language)
    uid = profile.get("firebase_uid")

    if LOCAL_TEST_MODE:
        for existing_uid, existing in LOCAL_DB["profiles"].items():
            if existing_uid == uid:
                continue
            if existing.get("login_id", "").casefold() == payload.login_id.casefold():
                raise HTTPException(status_code=409, detail="login_id_taken")
            if existing.get("display_name", "").casefold() == payload.display_name.casefold():
                raise HTTPException(status_code=409, detail="display_name_taken")
        profile.update({
            "login_id": payload.login_id,
            "real_name": payload.real_name,
            "display_name": payload.display_name,
            "display_name_set": True,
            "email_verification_required": True,
            "account_status": "email_unverified" if not profile.get("email_verified") else "active",
            "updated_at": _now_iso(),
        })
        return profile

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    try:
        if _is_login_id_taken(payload.login_id, uid):
            raise HTTPException(status_code=409, detail="login_id_taken")

        if _is_display_name_taken(payload.display_name, uid):
            raise HTTPException(status_code=409, detail="display_name_taken")

        update_payload = {
            "login_id": payload.login_id,
            "real_name": payload.real_name,
            "display_name": payload.display_name,
            "display_name_set": True,
            "email_verification_required": True,
            "account_status": "email_unverified" if not profile.get("email_verified") else "active",
            "updated_at": _now_iso(),
        }
        updated_res = supabase.table("profiles").update(update_payload).eq("firebase_uid", uid).execute()
        return (updated_res.data or [None])[0] or {**profile, **update_payload}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to update profile identity") from exc


def _create_profile_login_id(profile: dict, payload: AccountLoginIdCreate, email: str):
    if profile.get("login_id"):
        raise HTTPException(status_code=409, detail="login_id_already_set")
    if not LOGIN_ID_RE.fullmatch(payload.login_id):
        raise HTTPException(status_code=400, detail="login_id_format")
    if not _is_valid_real_name(payload.real_name, payload.language):
        raise HTTPException(status_code=400, detail="real_name_format")

    uid = profile.get("firebase_uid")
    if not uid:
        raise HTTPException(status_code=500, detail="profile_uid_missing")
    normalized_email = _normalize_email(email)
    if not EMAIL_RE.fullmatch(normalized_email):
        raise HTTPException(status_code=400, detail="invalid_email")
    if _is_email_taken(normalized_email, uid):
        raise HTTPException(status_code=409, detail="email_taken")

    update_payload = {
        "login_id": payload.login_id,
        "real_name": payload.real_name,
        "email": normalized_email,
        "email_verified": True,
        "email_verification_required": False,
        "account_status": "active",
        "updated_at": _now_iso(),
    }

    if LOCAL_TEST_MODE:
        if _is_login_id_taken(payload.login_id, uid):
            raise HTTPException(status_code=409, detail="login_id_taken")
        profile.update(update_payload)
        return profile

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    try:
        if _is_login_id_taken(payload.login_id, uid):
            raise HTTPException(status_code=409, detail="login_id_taken")
        updated_res = supabase.table("profiles").update(update_payload).eq("firebase_uid", uid).execute()
        return (updated_res.data or [None])[0] or {**profile, **update_payload}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="profile_login_id_create_failed") from exc


def _find_profile_for_login_id_recovery(payload: FindLoginIdRequest):
    if not payload.real_name.strip() or not payload.display_name.strip() or not EMAIL_RE.fullmatch(payload.email):
        return None
    email = _normalize_email(payload.email)
    if LOCAL_TEST_MODE:
        return next(
            (
                profile for profile in LOCAL_DB["profiles"].values()
                if profile.get("real_name") == payload.real_name
                and profile.get("display_name", "").casefold() == payload.display_name.casefold()
                and _normalize_email(profile.get("email", "")) == email
                and profile.get("login_id")
            ),
            None,
        )
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    res = (
        supabase.table("profiles")
        .select("id, login_id, email, real_name, display_name")
        .eq("email", email)
        .eq("real_name", payload.real_name)
        .ilike("display_name", payload.display_name)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def _find_profile_for_password_reset(payload: PasswordResetRequest):
    if not payload.real_name.strip() or not LOGIN_ID_RE.fullmatch(payload.login_id) or not EMAIL_RE.fullmatch(payload.email):
        return None
    email = _normalize_email(payload.email)
    if LOCAL_TEST_MODE:
        return next(
            (
                profile for profile in LOCAL_DB["profiles"].values()
                if profile.get("real_name") == payload.real_name
                and profile.get("login_id", "").casefold() == payload.login_id.casefold()
                and _normalize_email(profile.get("email", "")) == email
            ),
            None,
        )
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    res = (
        supabase.table("profiles")
        .select("id, login_id, email, real_name")
        .eq("email", email)
        .eq("real_name", payload.real_name)
        .ilike("login_id", payload.login_id)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def _update_profile_social_providers(profile: dict, providers: list[str]):
    cleaned = sorted({_normalize_provider_key(provider) for provider in providers if provider})
    uid = profile.get("firebase_uid")
    if LOCAL_TEST_MODE:
        profile.update({
            "social_providers": cleaned,
            "updated_at": _now_iso(),
        })
        return profile
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        update_payload = {
            "social_providers": cleaned,
            "updated_at": _now_iso(),
        }
        updated_res = supabase.table("profiles").update(update_payload).eq("firebase_uid", uid).execute()
        return (updated_res.data or [None])[0] or {**profile, **update_payload}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to update social providers") from exc


def _is_email_taken(email: str, current_uid: str | None = None):
    normalized_email = _normalize_email(email)
    if not EMAIL_RE.fullmatch(normalized_email):
        raise HTTPException(status_code=400, detail="invalid_email")
    if LOCAL_TEST_MODE:
        return any(
            _normalize_email(profile.get("email", "")) == normalized_email
            and profile.get("firebase_uid") != current_uid
            for profile in LOCAL_DB["profiles"].values()
        )
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    query = supabase.table("profiles").select("firebase_uid").eq("email", normalized_email).limit(1)
    if current_uid:
        query = query.neq("firebase_uid", current_uid)
    res = query.execute()
    return bool(res.data)


def _update_profile_email(profile: dict, email: str):
    normalized_email = _normalize_email(email)
    uid = profile.get("firebase_uid")
    if not uid:
        raise HTTPException(status_code=500, detail="profile_uid_missing")
    if _normalize_email(profile.get("email", "")) == normalized_email:
        raise HTTPException(status_code=400, detail="email_unchanged")
    if _is_email_taken(normalized_email, uid):
        raise HTTPException(status_code=409, detail="email_taken")

    update_payload = {
        "email": normalized_email,
        "email_verified": True,
        "email_verification_required": False,
        "account_status": "active",
        "updated_at": _now_iso(),
    }
    if LOCAL_TEST_MODE:
        profile.update(update_payload)
        return profile

    try:
        from firebase_admin import auth as firebase_auth

        get_firebase_app()
        firebase_auth.update_user(uid, email=normalized_email, email_verified=True)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="firebase_email_update_failed") from exc

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        updated_res = supabase.table("profiles").update(update_payload).eq("firebase_uid", uid).execute()
        return (updated_res.data or [None])[0] or {**profile, **update_payload}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="profile_email_update_failed") from exc


def _anonymize_deleted_account(profile: dict):
    profile_id = profile.get("id")
    uid = profile.get("firebase_uid", "")
    if not profile_id or not uid:
        raise HTTPException(status_code=500, detail="profile_id_missing")

    deleted_display_name = "탈퇴한 사용자"
    unique_profile_display_name = f"deleted_user_{str(profile_id).replace('-', '')[:12]}"
    deleted_uid = f"deleted:{uid}:{profile_id}"
    update_payload = {
        "firebase_uid": deleted_uid,
        "login_id": None,
        "real_name": None,
        "display_name": unique_profile_display_name,
        "display_name_set": False,
        "avatar_url": None,
        "role": "user",
        "provider": None,
        "social_providers": [],
        "email": None,
        "email_verified": False,
        "email_verification_required": False,
        "account_status": "withdrawn",
        "profile_badge_key": None,
        "updated_at": _now_iso(),
        "last_active_at": _now_iso(),
    }

    if LOCAL_TEST_MODE:
        profile.update(update_payload)
        for row in LOCAL_DB["evaluations"]:
            if row.get("user_id") == profile_id:
                row["profile_display_name"] = deleted_display_name
        for row in LOCAL_DB["comment_reactions"]:
            if row.get("user_id") == profile_id:
                row["profile_display_name"] = deleted_display_name
        for row in LOCAL_DB["comment_replies"]:
            if row.get("user_id") == profile_id:
                row["profile_display_name"] = deleted_display_name
        for row in LOCAL_DB["user_views"]:
            if row.get("user_id") == profile_id:
                row["display_name"] = deleted_display_name
        LOCAL_DB["auth_provider_accounts"] = [
            row for row in LOCAL_DB["auth_provider_accounts"]
            if row.get("profile_id") != profile_id
        ]
        return profile

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    try:
        updated_res = supabase.table("profiles").update(update_payload).eq("id", profile_id).execute()
        supabase.table("evaluations").update({"profile_display_name": deleted_display_name}).eq("user_id", profile_id).execute()
        supabase.table("comment_reactions").update({"profile_display_name": deleted_display_name}).eq("user_id", profile_id).execute()
        supabase.table("comment_replies").update({"profile_display_name": deleted_display_name}).eq("user_id", profile_id).execute()
        supabase.table("user_views").update({"display_name": deleted_display_name}).eq("user_id", profile_id).execute()
        supabase.table("auth_provider_accounts").delete().eq("profile_id", profile_id).execute()
        return (updated_res.data or [None])[0] or {**profile, **update_payload}
    except Exception as exc:
        logger.exception("Account anonymization failed for profile_id=%s", profile_id)
        raise HTTPException(status_code=500, detail="account_delete_failed") from exc


def _get_oauth_state_secret():
    secret = (
        os.environ.get("OAUTH_STATE_SECRET", "").strip()
        or os.environ.get("ADMIN_TOKEN_SECRET", "").strip()
        or os.environ.get("KAKAO_CLIENT_SECRET", "").strip()
        or os.environ.get("NAVER_CLIENT_SECRET", "").strip()
        or os.environ.get("GITHUB_CLIENT_SECRET", "").strip()
        or os.environ.get("DISCORD_CLIENT_SECRET", "").strip()
        or os.environ.get("STEAM_API_KEY", "").strip()
    )
    if not secret:
        raise HTTPException(status_code=503, detail="oauth_state_secret_not_configured")
    return secret.encode("utf-8")


def _make_oauth_state(provider: str, mode: str = "login", profile: dict | None = None):
    payload = {
        "provider": provider,
        "mode": mode,
        "nonce": secrets.token_urlsafe(24),
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }
    if mode == "link":
        if not profile or not profile.get("id") or not profile.get("firebase_uid"):
            raise HTTPException(status_code=500, detail="profile_id_missing")
        payload["profile_id"] = profile["id"]
        payload["firebase_uid"] = profile["firebase_uid"]
    payload_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    payload_token = base64.urlsafe_b64encode(payload_bytes).decode("ascii").rstrip("=")
    signature = hmac.new(_get_oauth_state_secret(), payload_token.encode("ascii"), hashlib.sha256).digest()
    signature_token = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    return f"{payload_token}.{signature_token}"


def _decode_oauth_state(state: str):
    payload_token, _, signature_token = (state or "").partition(".")
    if not payload_token or not signature_token:
        raise HTTPException(status_code=400, detail="invalid_oauth_state")
    expected = hmac.new(_get_oauth_state_secret(), payload_token.encode("ascii"), hashlib.sha256).digest()
    actual = base64.urlsafe_b64decode(signature_token + "=" * (-len(signature_token) % 4))
    if not hmac.compare_digest(expected, actual):
        raise HTTPException(status_code=400, detail="invalid_oauth_state")
    payload_bytes = base64.urlsafe_b64decode(payload_token + "=" * (-len(payload_token) % 4))
    return json.loads(payload_bytes.decode("utf-8"))


def _validate_oauth_state(provider: str, state: str, cookie_state: str | None):
    if not state or not cookie_state or state != cookie_state:
        raise HTTPException(status_code=400, detail="invalid_oauth_state")
    payload = _decode_oauth_state(state)
    if payload.get("provider") != provider:
        raise HTTPException(status_code=400, detail="invalid_oauth_state")
    issued_at = int(payload.get("iat") or 0)
    now = int(datetime.now(timezone.utc).timestamp())
    if issued_at <= 0 or now - issued_at > 600:
        raise HTTPException(status_code=400, detail="expired_oauth_state")
    return payload


def _oauth_popup_html(payload: dict):
    return HTMLResponse(
        f"""<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>OAuth Complete</title></head>
<body>
<script>
(function() {{
  const payload = {json.dumps(payload, ensure_ascii=False)};
  if (window.opener && !window.opener.closed) {{
    window.opener.postMessage(payload, window.location.origin);
  }}
  window.close();
}}());
</script>
<p>로그인 처리를 완료했습니다. 이 창을 닫아도 됩니다.</p>
</body>
</html>"""
    )


def _oauth_error_html(provider: str, detail: str):
    return _oauth_popup_html({
        "type": "oauth_error",
        "provider": provider,
        "detail": detail,
    })


def _oauth_cancelled_html(provider: str):
    return _oauth_popup_html({
        "type": "oauth_cancelled",
        "provider": provider,
    })


def _oauth_state_cookie_name(provider: str):
    return f"oauth_state_{provider}"


def _post_form_json(url: str, data: dict, headers: dict | None = None):
    encoded = urllib_parse.urlencode(data).encode("utf-8")
    request = urllib_request.Request(
        url,
        data=encoded,
        headers={
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
            **(headers or {}),
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"oauth_token_exchange_failed:{detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="oauth_token_exchange_failed") from exc


def _get_json(url: str, headers: dict | None = None):
    request = urllib_request.Request(url, headers=headers or {}, method="GET")
    try:
        with urllib_request.urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"oauth_userinfo_failed:{detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="oauth_userinfo_failed") from exc


def _post_form_text(url: str, data: dict, headers: dict | None = None):
    encoded = urllib_parse.urlencode(data).encode("utf-8")
    request = urllib_request.Request(
        url,
        data=encoded,
        headers={
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
            **(headers or {}),
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(request, timeout=10) as response:
            return response.read().decode("utf-8", errors="replace")
    except urllib_error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"openid_check_failed:{detail}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="openid_check_failed") from exc


def _revoke_kakao_provider_account(account: dict):
    admin_key = os.environ.get("KAKAO_ADMIN_KEY", "").strip()
    provider_user_id = str(account.get("provider_user_id") or "").strip()
    if not admin_key or not provider_user_id:
        return False
    _post_form_json(
        "https://kapi.kakao.com/v1/user/unlink",
        {
            "target_id_type": "user_id",
            "target_id": provider_user_id,
        },
        headers={"Authorization": f"KakaoAK {admin_key}"},
    )
    return True


def _revoke_provider_account(account: dict):
    provider = account.get("provider")
    try:
        if provider == "kakao":
            return _revoke_kakao_provider_account(account)
    except Exception:
        logger.exception(
            "Provider revoke failed provider=%s provider_user_id=%s",
            provider,
            account.get("provider_user_id"),
        )
    return False


def _revoke_provider_accounts(accounts: list[dict]):
    revoked = []
    for account in accounts:
        if _revoke_provider_account(account):
            revoked.append(account.get("provider"))
    return revoked


def _get_kakao_config():
    config = {
        "client_id": os.environ.get("KAKAO_CLIENT_ID", "").strip(),
        "client_secret": os.environ.get("KAKAO_CLIENT_SECRET", "").strip(),
        "redirect_uri": os.environ.get("KAKAO_REDIRECT_URI", "").strip(),
    }
    if not config["client_id"] or not config["redirect_uri"]:
        raise HTTPException(status_code=503, detail="kakao_oauth_not_configured")
    return config


def _exchange_kakao_code(code: str):
    config = _get_kakao_config()
    data = {
        "grant_type": "authorization_code",
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "code": code,
    }
    if config["client_secret"]:
        data["client_secret"] = config["client_secret"]
    return _post_form_json("https://kauth.kakao.com/oauth/token", data)


def _fetch_kakao_user(access_token: str):
    return _get_json(
        "https://kapi.kakao.com/v2/user/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )


def _extract_kakao_identity(kakao_user: dict):
    provider_user_id = str(kakao_user.get("id") or "").strip()
    if not provider_user_id:
        raise HTTPException(status_code=502, detail="kakao_user_id_missing")
    account = kakao_user.get("kakao_account") or {}
    profile = account.get("profile") or {}
    kakao_display_name_field = "nick" + "name"
    return {
        "provider": "kakao",
        "provider_user_id": provider_user_id,
        "firebase_uid": f"kakao:{provider_user_id}",
        "email": _normalize_email(account.get("email") or ""),
        "email_verified": bool(account.get("is_email_verified")),
        "display_name": (profile.get(kakao_display_name_field) or "").strip(),
        "avatar_url": (profile.get("profile_image_url") or profile.get("thumbnail_image_url") or "").strip(),
    }


def _get_naver_config():
    config = {
        "client_id": os.environ.get("NAVER_CLIENT_ID", "").strip(),
        "client_secret": os.environ.get("NAVER_CLIENT_SECRET", "").strip(),
        "redirect_uri": os.environ.get("NAVER_REDIRECT_URI", "").strip(),
    }
    if not config["client_id"] or not config["client_secret"] or not config["redirect_uri"]:
        raise HTTPException(status_code=503, detail="naver_oauth_not_configured")
    return config


def _exchange_naver_code(code: str, state: str):
    config = _get_naver_config()
    data = {
        "grant_type": "authorization_code",
        "client_id": config["client_id"],
        "client_secret": config["client_secret"],
        "redirect_uri": config["redirect_uri"],
        "code": code,
        "state": state,
    }
    return _post_form_json("https://nid.naver.com/oauth2.0/token", data)


def _fetch_naver_user(access_token: str):
    return _get_json(
        "https://openapi.naver.com/v1/nid/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )


def _extract_naver_identity(naver_user: dict):
    response = naver_user.get("response") or {}
    provider_user_id = str(response.get("id") or "").strip()
    if not provider_user_id:
        raise HTTPException(status_code=502, detail="naver_user_id_missing")
    return {
        "provider": "naver",
        "provider_user_id": provider_user_id,
        "firebase_uid": f"naver:{provider_user_id}",
        "email": _normalize_email(response.get("email") or ""),
        "email_verified": bool(response.get("email")),
        "display_name": ((response.get("nickname") or response.get("name") or "")).strip(),
        "avatar_url": (response.get("profile_image") or "").strip(),
    }


def _get_github_config():
    config = {
        "client_id": os.environ.get("GITHUB_CLIENT_ID", "").strip(),
        "client_secret": os.environ.get("GITHUB_CLIENT_SECRET", "").strip(),
        "redirect_uri": os.environ.get("GITHUB_REDIRECT_URI", "").strip(),
    }
    if not config["client_id"] or not config["client_secret"] or not config["redirect_uri"]:
        raise HTTPException(status_code=503, detail="github_oauth_not_configured")
    return config


def _exchange_github_code(code: str):
    config = _get_github_config()
    data = {
        "client_id": config["client_id"],
        "client_secret": config["client_secret"],
        "redirect_uri": config["redirect_uri"],
        "code": code,
    }
    token_data = _post_form_json(
        "https://github.com/login/oauth/access_token",
        data,
        headers={"Accept": "application/json"},
    )
    if token_data.get("error"):
        raise HTTPException(
            status_code=502,
            detail=f"github_token_exchange_failed:{token_data.get('error_description') or token_data.get('error')}",
        )
    return token_data


def _github_api_headers(access_token: str):
    return {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _fetch_github_user(access_token: str):
    return _get_json(
        "https://api.github.com/user",
        headers=_github_api_headers(access_token),
    )


def _fetch_github_emails(access_token: str):
    try:
        emails = _get_json(
            "https://api.github.com/user/emails",
            headers=_github_api_headers(access_token),
        )
        return emails if isinstance(emails, list) else []
    except HTTPException:
        return []


def _pick_github_email(github_user: dict, github_emails: list[dict]):
    for email_row in github_emails:
        if email_row.get("primary") and email_row.get("verified") and email_row.get("email"):
            return _normalize_email(email_row.get("email")), True
    for email_row in github_emails:
        if email_row.get("verified") and email_row.get("email"):
            return _normalize_email(email_row.get("email")), True
    public_email = _normalize_email(github_user.get("email") or "")
    return public_email, False


def _extract_github_identity(github_user: dict, github_emails: list[dict]):
    provider_user_id = str(github_user.get("id") or "").strip()
    if not provider_user_id:
        raise HTTPException(status_code=502, detail="github_user_id_missing")
    email, email_verified = _pick_github_email(github_user, github_emails)
    return {
        "provider": "github",
        "provider_user_id": provider_user_id,
        "firebase_uid": f"github:{provider_user_id}",
        "email": email,
        "email_verified": email_verified,
        "display_name": ((github_user.get("name") or github_user.get("login") or "")).strip(),
        "avatar_url": (github_user.get("avatar_url") or "").strip(),
    }


def _get_discord_config():
    config = {
        "client_id": os.environ.get("DISCORD_CLIENT_ID", "").strip(),
        "client_secret": os.environ.get("DISCORD_CLIENT_SECRET", "").strip(),
        "redirect_uri": os.environ.get("DISCORD_REDIRECT_URI", "").strip(),
    }
    if not config["client_id"] or not config["client_secret"] or not config["redirect_uri"]:
        raise HTTPException(status_code=503, detail="discord_oauth_not_configured")
    return config


def _exchange_discord_code(code: str):
    config = _get_discord_config()
    data = {
        "grant_type": "authorization_code",
        "client_id": config["client_id"],
        "client_secret": config["client_secret"],
        "redirect_uri": config["redirect_uri"],
        "code": code,
    }
    return _post_form_json("https://discord.com/api/oauth2/token", data)


def _discord_api_headers(access_token: str):
    return {"Authorization": f"Bearer {access_token}"}


def _fetch_discord_user(access_token: str):
    return _get_json(
        "https://discord.com/api/users/@me",
        headers=_discord_api_headers(access_token),
    )


def _revoke_discord_access_token(access_token: str):
    token = (access_token or "").strip()
    if not token:
        return False
    config = _get_discord_config()
    _post_form_json(
        "https://discord.com/api/oauth2/token/revoke",
        {
            "client_id": config["client_id"],
            "client_secret": config["client_secret"],
            "token": token,
            "token_type_hint": "access_token",
        },
    )
    return True


def _make_discord_avatar_url(discord_user: dict):
    user_id = str(discord_user.get("id") or "").strip()
    avatar_hash = str(discord_user.get("avatar") or "").strip()
    if not user_id or not avatar_hash:
        return ""
    extension = "gif" if avatar_hash.startswith("a_") else "png"
    return f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.{extension}?size=256"


def _extract_discord_identity(discord_user: dict):
    provider_user_id = str(discord_user.get("id") or "").strip()
    if not provider_user_id:
        raise HTTPException(status_code=502, detail="discord_user_id_missing")
    return {
        "provider": "discord",
        "provider_user_id": provider_user_id,
        "firebase_uid": f"discord:{provider_user_id}",
        "email": _normalize_email(discord_user.get("email") or ""),
        "email_verified": bool(discord_user.get("verified")),
        "display_name": ((discord_user.get("global_name") or discord_user.get("username") or "")).strip(),
        "avatar_url": _make_discord_avatar_url(discord_user),
    }


def _get_steam_config():
    config = {
        "api_key": os.environ.get("STEAM_API_KEY", "").strip(),
        "return_url": os.environ.get("STEAM_RETURN_URL", "").strip(),
        "realm": os.environ.get("STEAM_REALM", "").strip(),
    }
    if not config["return_url"] or not config["realm"]:
        raise HTTPException(status_code=503, detail="steam_openid_not_configured")
    return config


def _make_steam_return_to(state: str):
    config = _get_steam_config()
    separator = "&" if "?" in config["return_url"] else "?"
    return f"{config['return_url']}{separator}{urllib_parse.urlencode({'state': state})}"


def _extract_steam_id(claimed_id: str):
    match = re.fullmatch(r"https://steamcommunity\.com/openid/id/(\d{15,25})", claimed_id or "")
    if not match:
        raise HTTPException(status_code=400, detail="invalid_steam_claimed_id")
    return match.group(1)


def _parse_openid_text_response(response_text: str):
    parsed = {}
    for line in (response_text or "").splitlines():
        key, separator, value = line.partition(":")
        if separator:
            parsed[key.strip()] = value.strip()
    return parsed


def _validate_steam_openid_assertion(request: Request, state: str):
    query_items = list(request.query_params.multi_items())
    openid_values = {
        key: value
        for key, value in query_items
        if key.startswith("openid.")
    }
    if openid_values.get("openid.mode") != "id_res":
        raise HTTPException(status_code=400, detail="invalid_steam_openid_mode")
    if openid_values.get("openid.op_endpoint") != "https://steamcommunity.com/openid/login":
        raise HTTPException(status_code=400, detail="invalid_steam_openid_endpoint")
    claimed_id = openid_values.get("openid.claimed_id", "")
    if openid_values.get("openid.identity") != claimed_id:
        raise HTTPException(status_code=400, detail="invalid_steam_identity")
    if openid_values.get("openid.return_to") != _make_steam_return_to(state):
        raise HTTPException(status_code=400, detail="invalid_steam_return_to")
    steam_id = _extract_steam_id(claimed_id)
    check_payload = dict(openid_values)
    check_payload["openid.mode"] = "check_authentication"
    response_text = _post_form_text("https://steamcommunity.com/openid/login", check_payload)
    parsed = _parse_openid_text_response(response_text)
    if parsed.get("is_valid") != "true":
        raise HTTPException(status_code=400, detail="invalid_steam_assertion")
    return steam_id


def _fetch_steam_player_summary(steam_id: str):
    config = _get_steam_config()
    if not config["api_key"]:
        return {}
    params = urllib_parse.urlencode({
        "key": config["api_key"],
        "steamids": steam_id,
        "format": "json",
    })
    try:
        data = _get_json(f"https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?{params}")
        players = (((data or {}).get("response") or {}).get("players") or [])
        return players[0] if players else {}
    except HTTPException:
        return {}


def _extract_steam_identity(steam_id: str, player_summary: dict):
    return {
        "provider": "steam",
        "provider_user_id": steam_id,
        "firebase_uid": f"steam:{steam_id}",
        "email": "",
        "email_verified": False,
        "display_name": (player_summary.get("personaname") or "").strip(),
        "avatar_url": (player_summary.get("avatarfull") or player_summary.get("avatarmedium") or "").strip(),
    }


def _build_oauth_login_url(provider: str, state: str):
    if provider == "kakao":
        config = _get_kakao_config()
        params = {
            "response_type": "code",
            "client_id": config["client_id"],
            "redirect_uri": config["redirect_uri"],
            "state": state,
        }
        return f"https://kauth.kakao.com/oauth/authorize?{urllib_parse.urlencode(params)}"
    if provider == "naver":
        config = _get_naver_config()
        params = {
            "response_type": "code",
            "client_id": config["client_id"],
            "redirect_uri": config["redirect_uri"],
            "state": state,
        }
        return f"https://nid.naver.com/oauth2.0/authorize?{urllib_parse.urlencode(params)}"
    if provider == "github":
        config = _get_github_config()
        params = {
            "client_id": config["client_id"],
            "redirect_uri": config["redirect_uri"],
            "scope": "read:user user:email",
            "state": state,
        }
        return f"https://github.com/login/oauth/authorize?{urllib_parse.urlencode(params)}"
    if provider == "discord":
        config = _get_discord_config()
        params = {
            "response_type": "code",
            "client_id": config["client_id"],
            "redirect_uri": config["redirect_uri"],
            "scope": "identify email",
            "state": state,
        }
        return f"https://discord.com/oauth2/authorize?{urllib_parse.urlencode(params)}"
    if provider == "steam":
        config = _get_steam_config()
        params = {
            "openid.ns": "http://specs.openid.net/auth/2.0",
            "openid.mode": "checkid_setup",
            "openid.return_to": _make_steam_return_to(state),
            "openid.realm": config["realm"],
            "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
            "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
        }
        return f"https://steamcommunity.com/openid/login?{urllib_parse.urlencode(params)}"
    raise HTTPException(status_code=404, detail="oauth_provider_not_supported")


def _provider_callback_is_secure(provider: str):
    if provider == "steam":
        return _get_steam_config()["return_url"].startswith("https://")
    if provider == "kakao":
        return _get_kakao_config()["redirect_uri"].startswith("https://")
    if provider == "naver":
        return _get_naver_config()["redirect_uri"].startswith("https://")
    if provider == "github":
        return _get_github_config()["redirect_uri"].startswith("https://")
    if provider == "discord":
        return _get_discord_config()["redirect_uri"].startswith("https://")
    return False


def _oauth_start_redirect(provider: str, mode: str = "login", profile: dict | None = None):
    state = _make_oauth_state(provider, mode=mode, profile=profile)
    login_url = _build_oauth_login_url(provider, state)
    response = RedirectResponse(login_url, status_code=302)
    response.set_cookie(
        _oauth_state_cookie_name(provider),
        state,
        max_age=600,
        httponly=True,
        secure=_provider_callback_is_secure(provider),
        samesite="lax",
    )
    return response


def _oauth_link_start_response(provider: str, profile: dict):
    state = _make_oauth_state(provider, mode="link", profile=profile)
    login_url = _build_oauth_login_url(provider, state)
    response = JSONResponse({"url": login_url})
    response.set_cookie(
        _oauth_state_cookie_name(provider),
        state,
        max_age=600,
        httponly=True,
        secure=_provider_callback_is_secure(provider),
        samesite="lax",
    )
    return response


def _handle_oauth_identity(provider: str, identity: dict, state_payload: dict):
    if state_payload.get("mode") == "link":
        profile = _get_profile_by_id(str(state_payload.get("profile_id") or ""))
        if (
            not profile
            or profile.get("firebase_uid") != state_payload.get("firebase_uid")
            or profile.get("account_status") in ("deleted", "withdrawn")
        ):
            raise HTTPException(status_code=409, detail="oauth_link_profile_invalid")
        _link_oauth_profile(identity, profile)
        return _oauth_popup_html({
            "type": "oauth_link_success",
            "provider": provider,
        })

    profile = _upsert_oauth_profile(identity)
    custom_token = create_firebase_custom_token(
        profile["firebase_uid"],
        {
            "provider_key": provider,
            "provider_user_id": identity["provider_user_id"],
        },
    )
    return _oauth_popup_html({
        "type": "oauth_custom_token",
        "provider": provider,
        "customToken": custom_token,
    })


def _extract_firebase_linked_provider_identity(firebase_uid: str, provider: str):
    if provider != "google":
        raise HTTPException(status_code=404, detail="provider_link_record_not_supported")
    try:
        from firebase_admin import auth as firebase_auth

        get_firebase_app()
        firebase_user = firebase_auth.get_user(firebase_uid)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="firebase_provider_lookup_failed") from exc

    for provider_info in firebase_user.provider_data or []:
        if provider_info.provider_id == "google.com":
            provider_user_id = str(provider_info.uid or "").strip()
            if not provider_user_id:
                raise HTTPException(status_code=502, detail="google_provider_user_id_missing")
            return {
                "provider": "google",
                "provider_user_id": provider_user_id,
                "firebase_uid": firebase_uid,
                "email": _normalize_email(provider_info.email or firebase_user.email or ""),
                "email_verified": bool(firebase_user.email_verified),
                "display_name": (provider_info.display_name or firebase_user.display_name or "").strip(),
                "avatar_url": (provider_info.photo_url or firebase_user.photo_url or "").strip(),
            }
    raise HTTPException(status_code=409, detail="google_provider_not_linked")


def _get_provider_account(provider: str, provider_user_id: str):
    if LOCAL_TEST_MODE:
        return next((
            row for row in LOCAL_DB["auth_provider_accounts"]
            if row.get("provider") == provider and row.get("provider_user_id") == provider_user_id
        ), None)
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    res = (
        supabase.table("auth_provider_accounts")
        .select("*")
        .eq("provider", provider)
        .eq("provider_user_id", provider_user_id)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def _get_provider_accounts_for_profile(profile_id: str):
    if LOCAL_TEST_MODE:
        return [
            row for row in LOCAL_DB["auth_provider_accounts"]
            if row.get("profile_id") == profile_id
        ]
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    res = supabase.table("auth_provider_accounts").select("*").eq("profile_id", profile_id).execute()
    return res.data or []


def _get_provider_account_for_profile(profile_id: str, provider: str):
    if LOCAL_TEST_MODE:
        return next((
            row for row in LOCAL_DB["auth_provider_accounts"]
            if row.get("profile_id") == profile_id and row.get("provider") == provider
        ), None)
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    res = (
        supabase.table("auth_provider_accounts")
        .select("*")
        .eq("profile_id", profile_id)
        .eq("provider", provider)
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def _get_profile_by_id(profile_id: str):
    if LOCAL_TEST_MODE:
        return next((profile for profile in LOCAL_DB["profiles"].values() if profile.get("id") == profile_id), None)
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    res = supabase.table("profiles").select("*").eq("id", profile_id).limit(1).execute()
    return (res.data or [None])[0]


def _get_profile_by_firebase_uid(firebase_uid: str):
    if LOCAL_TEST_MODE:
        return LOCAL_DB["profiles"].get(firebase_uid)
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    res = supabase.table("profiles").select("*").eq("firebase_uid", firebase_uid).limit(1).execute()
    return (res.data or [None])[0]


def _linked_provider_keys_for_profile(profile: dict):
    profile_id = profile.get("id")
    providers = {_normalize_provider_key(provider) for provider in (profile.get("social_providers") or [])}
    primary_provider = _normalize_provider_key(profile.get("provider"))
    if primary_provider and primary_provider != "password":
        providers.add(primary_provider)
    if profile_id:
        try:
            providers.update(
                _normalize_provider_key(row.get("provider"))
                for row in _get_provider_accounts_for_profile(profile_id)
                if row.get("provider")
            )
        except HTTPException:
            raise
        except Exception:
            logger.exception("Failed to read linked providers for profile_id=%s", profile_id)
    return sorted(provider for provider in providers if provider and provider != "password")


def _update_profile_provider_fields(profile: dict, providers: list[str]):
    cleaned = sorted({_normalize_provider_key(provider) for provider in providers if provider and _normalize_provider_key(provider) != "password"})
    current_provider = _normalize_provider_key(profile.get("provider"))
    provider_field = current_provider if current_provider == "password" or current_provider in cleaned else (cleaned[0] if cleaned else None)
    update_payload = {
        "provider": provider_field,
        "social_providers": cleaned,
        "updated_at": _now_iso(),
    }
    if LOCAL_TEST_MODE:
        profile.update(update_payload)
        return profile
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    updated_res = supabase.table("profiles").update(update_payload).eq("id", profile["id"]).execute()
    return (updated_res.data or [None])[0] or {**profile, **update_payload}


def _delete_provider_account_for_profile(profile_id: str, provider: str):
    provider = _normalize_provider_key(provider)
    if LOCAL_TEST_MODE:
        LOCAL_DB["auth_provider_accounts"] = [
            row for row in LOCAL_DB["auth_provider_accounts"]
            if not (row.get("profile_id") == profile_id and _normalize_provider_key(row.get("provider")) == provider)
        ]
        return
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    supabase.table("auth_provider_accounts").delete().eq("profile_id", profile_id).eq("provider", provider).execute()


def _remove_profile_provider_field(profile: dict | None, provider: str):
    if not profile or not profile.get("id"):
        return profile
    provider = _normalize_provider_key(provider)
    providers = [
        _normalize_provider_key(item)
        for item in (profile.get("social_providers") or [])
        if _normalize_provider_key(item) != provider
    ]
    update_payload = {
        "social_providers": sorted(set(providers)),
        "updated_at": _now_iso(),
    }
    if _normalize_provider_key(profile.get("provider")) == provider:
        update_payload["provider"] = update_payload["social_providers"][0] if update_payload["social_providers"] else None
    if LOCAL_TEST_MODE:
        profile.update(update_payload)
        return profile
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    updated_res = supabase.table("profiles").update(update_payload).eq("id", profile["id"]).execute()
    return (updated_res.data or [None])[0] or {**profile, **update_payload}


def _unlink_oauth_profile_provider(profile: dict, provider: str, current_auth_provider: str | None = None):
    provider = _normalize_provider_key(provider)
    if provider not in {"google", "kakao", "naver", "github", "discord", "steam"}:
        raise HTTPException(status_code=404, detail="oauth_provider_not_supported")
    profile_id = profile.get("id")
    if not profile_id:
        raise HTTPException(status_code=500, detail="profile_id_missing")
    if profile.get("account_status") in ("deleted", "withdrawn"):
        raise HTTPException(status_code=409, detail="oauth_account_deleted")

    linked_providers = set(_linked_provider_keys_for_profile(profile))
    if provider not in linked_providers:
        raise HTTPException(status_code=404, detail="auth_provider_not_linked")

    remaining_providers = sorted(linked_providers - {provider})
    has_login_id = bool((profile.get("login_id") or "").strip())
    if not has_login_id and not remaining_providers:
        raise HTTPException(status_code=409, detail="auth_provider_unlink_last_method")

    _delete_provider_account_for_profile(profile_id, provider)
    refreshed_profile = _get_profile_by_id(profile_id) or profile
    updated_profile = _update_profile_provider_fields(refreshed_profile, remaining_providers)
    return {
        "profile": updated_profile,
        "linked_providers": _linked_provider_keys_for_profile(updated_profile),
        "is_admin": updated_profile.get("role") in ("admin", "super_admin"),
        "signed_out_required": _normalize_provider_key(current_auth_provider) == provider,
    }


def _link_oauth_profile(identity: dict, profile: dict):
    provider = identity["provider"]
    provider_user_id = identity["provider_user_id"]
    profile_id = profile.get("id")
    if not profile_id:
        raise HTTPException(status_code=500, detail="profile_id_missing")
    if profile.get("account_status") in ("deleted", "withdrawn"):
        raise HTTPException(status_code=409, detail="oauth_account_deleted")

    now = _now_iso()
    existing_account = _get_provider_account(provider, provider_user_id)
    if existing_account and existing_account.get("profile_id") != profile_id:
        other_profile = _get_profile_by_id(existing_account.get("profile_id"))
        if other_profile and other_profile.get("account_status") not in ("deleted", "withdrawn"):
            _remove_profile_provider_field(other_profile, provider)

    current_provider_account = _get_provider_account_for_profile(profile_id, provider)
    if current_provider_account and current_provider_account.get("provider_user_id") != provider_user_id:
        raise HTTPException(status_code=409, detail="oauth_provider_already_linked")

    account_payload = {
        "profile_id": profile_id,
        "provider": provider,
        "provider_user_id": provider_user_id,
        "provider_email": identity.get("email") or None,
        "provider_display_name": identity.get("display_name") or None,
        "provider_avatar_url": identity.get("avatar_url") or None,
        "updated_at": now,
    }

    if LOCAL_TEST_MODE:
        target_account = existing_account or current_provider_account
        if target_account:
            target_account.update(account_payload)
        else:
            LOCAL_DB["auth_provider_accounts"].append({
                "id": str(uuid4()),
                **account_payload,
                "created_at": now,
            })
        return _update_profile_provider_fields(profile, [*_linked_provider_keys_for_profile(profile), provider])

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        supabase.table("auth_provider_accounts").upsert(
            account_payload,
            on_conflict="provider,provider_user_id",
        ).execute()
        refreshed_profile = _get_profile_by_id(profile_id) or profile
        return _update_profile_provider_fields(refreshed_profile, [*_linked_provider_keys_for_profile(refreshed_profile), provider])
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("OAuth account link failed provider=%s profile_id=%s", provider, profile_id)
        raise HTTPException(status_code=500, detail="oauth_link_failed") from exc


def _upsert_oauth_profile(identity: dict):
    provider = identity["provider"]
    provider_user_id = identity["provider_user_id"]
    firebase_uid = identity["firebase_uid"]
    now = _now_iso()
    temporary_display_name = f"user{hashlib.sha256(f'{provider}:{provider_user_id}'.encode('utf-8')).hexdigest()[:10]}"
    account = _get_provider_account(provider, provider_user_id)
    if account:
        profile = _get_profile_by_id(account["profile_id"])
        if not profile or profile.get("account_status") in ("deleted", "withdrawn"):
            raise HTTPException(status_code=409, detail="oauth_account_deleted")
        providers = sorted({*(profile.get("social_providers") or []), provider})
        profile_updates = {
            "provider": profile.get("provider") or provider,
            "social_providers": providers,
            "last_login_at": now,
            "last_active_at": now,
            "updated_at": now,
        }
        account_updates = {
            "provider_email": identity.get("email") or None,
            "provider_display_name": identity.get("display_name") or None,
            "provider_avatar_url": identity.get("avatar_url") or None,
            "updated_at": now,
        }
        if LOCAL_TEST_MODE:
            profile.update(profile_updates)
            account.update(account_updates)
            return profile
        if not supabase:
            raise HTTPException(status_code=503, detail="Supabase is not configured")
        updated_res = supabase.table("profiles").update(profile_updates).eq("id", profile["id"]).execute()
        supabase.table("auth_provider_accounts").update(account_updates).eq("id", account["id"]).execute()
        profile = (updated_res.data or [None])[0] or {**profile, **profile_updates}
        return profile

    existing_profile = _get_profile_by_firebase_uid(firebase_uid)
    if existing_profile and existing_profile.get("account_status") in ("deleted", "withdrawn"):
        existing_profile = None

    if LOCAL_TEST_MODE:
        profile = existing_profile
        if not profile:
            profile = {
                "id": str(uuid4()),
                "firebase_uid": firebase_uid,
                "login_id": None,
                "real_name": None,
                "display_name": temporary_display_name,
                "display_name_set": False,
                "avatar_url": identity.get("avatar_url") or None,
                "role": "user",
                "provider": provider,
                "social_providers": [provider],
                "email": identity.get("email") or None,
                "email_verified": identity.get("email_verified", False),
                "email_verification_required": False,
                "account_status": "active",
                "profile_badge_key": None,
                "created_at": now,
                "updated_at": now,
                "last_login_at": now,
                "last_active_at": now,
            }
            LOCAL_DB["profiles"][firebase_uid] = profile
        else:
            providers = sorted({*(profile.get("social_providers") or []), provider})
            profile.update({
                "provider": profile.get("provider") or provider,
                "social_providers": providers,
                "last_login_at": now,
                "last_active_at": now,
                "updated_at": now,
            })
        LOCAL_DB["auth_provider_accounts"].append({
            "id": str(uuid4()),
            "profile_id": profile["id"],
            "provider": provider,
            "provider_user_id": provider_user_id,
            "provider_email": identity.get("email") or None,
            "provider_display_name": identity.get("display_name") or None,
            "provider_avatar_url": identity.get("avatar_url") or None,
            "created_at": now,
            "updated_at": now,
        })
        return profile

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    try:
        profile = existing_profile
        if not profile:
            insert_payload = {
                "firebase_uid": firebase_uid,
                "login_id": None,
                "real_name": None,
                "display_name": temporary_display_name,
                "display_name_set": False,
                "avatar_url": identity.get("avatar_url") or None,
                "role": "user",
                "provider": provider,
                "social_providers": [provider],
                "email": identity.get("email") or None,
                "email_verified": identity.get("email_verified", False),
                "email_verification_required": False,
                "account_status": "active",
                "created_at": now,
                "updated_at": now,
                "last_login_at": now,
                "last_active_at": now,
            }
            inserted_res = supabase.table("profiles").insert(insert_payload).execute()
            profile = (inserted_res.data or [None])[0] or insert_payload
        else:
            providers = sorted({*(profile.get("social_providers") or []), provider})
            update_payload = {
                "provider": profile.get("provider") or provider,
                "social_providers": providers,
                "last_login_at": now,
                "last_active_at": now,
                "updated_at": now,
            }
            updated_res = supabase.table("profiles").update(update_payload).eq("id", profile["id"]).execute()
            profile = (updated_res.data or [None])[0] or {**profile, **update_payload}

        account_payload = {
            "profile_id": profile["id"],
            "provider": provider,
            "provider_user_id": provider_user_id,
            "provider_email": identity.get("email") or None,
            "provider_display_name": identity.get("display_name") or None,
            "provider_avatar_url": identity.get("avatar_url") or None,
            "updated_at": now,
        }
        supabase.table("auth_provider_accounts").upsert(
            account_payload,
            on_conflict="provider,provider_user_id",
        ).execute()
        return profile
    except Exception as exc:
        raise HTTPException(status_code=500, detail="oauth_profile_upsert_failed") from exc


def _find_actual_model(game_type: str, blind_model_id: str, preferred_lang: str = "ko", blind_model_token: str | None = None):
    lang_games = GAMES_DATA.get(preferred_lang, GAMES_DATA.get('ko', {}))
    if blind_model_token:
        for m in lang_games.get(game_type, []):
            if _get_blind_model_token(game_type, m["actual_model"]) == blind_model_token:
                return m["actual_model"]

        for lang_dict in GAMES_DATA.values():
            for m in lang_dict.get(game_type, []):
                if _get_blind_model_token(game_type, m["actual_model"]) == blind_model_token:
                    return m["actual_model"]

    for m in lang_games.get(game_type, []):
        if m["blind_id"] == blind_model_id:
            return m["actual_model"]

    for lang_dict in GAMES_DATA.values():
        for m in lang_dict.get(game_type, []):
            if m["blind_id"] == blind_model_id:
                return m["actual_model"]
    return None


def _local_get_eval_rows_for_profile(profile: dict):
    profile_id = _get_profile_id(profile)
    return [
        {
            "profile_display_name": _activity_display_name(row),
            "game_type": row["game_type"],
            "actual_model_name": row["actual_model_name"],
        }
        for row in LOCAL_DB["evaluations"]
        if profile_id and row.get("user_id") == profile_id
    ]


def _local_get_view_rows_for_profile(profile: dict):
    profile_id = _get_profile_id(profile)
    return [
        {
            "display_name": row.get("display_name"),
            "game_type": row["game_type"],
            "actual_model_name": row["actual_model_name"],
        }
        for row in LOCAL_DB["user_views"]
        if profile_id and row.get("user_id") == profile_id
    ]


def _summarize_mypage_for_profile(profile: dict, eval_rows, view_rows):
    return {
        **summarize_mypage_data(
            _get_profile_display_name(profile),
            eval_rows,
            view_rows,
            GAMES_DATA,
            profile.get("profile_badge_key"),
        ),
        "user_id": _get_profile_id(profile),
        "login_id": profile.get("login_id"),
        "email": profile.get("email"),
    }


def _strip_postgrest_missing_column_fields(row: dict, exc: Exception):
    message = str(exc)
    missing_fields = []
    for field in row:
        if f"'{field}' column" in message or f'"{field}" column' in message or f"column {field}" in message:
            missing_fields.append(field)
    if not missing_fields:
        return None
    return {key: value for key, value in row.items() if key not in missing_fields}


def _activity_display_name(row: dict):
    return (row.get("profile_display_name") or row.get("display_name") or "").strip()


def _build_results_payload(game_type: str, data, reaction_rows, reply_rows, current_display_name: str | None, is_admin: bool, user_eval_rows, user_view_rows, saved_profile_badges, current_user_id: str | None = None):
    stats = {}
    blind_mapping = {}
    for lang_dict in GAMES_DATA.values():
        for m in lang_dict.get(game_type, []):
            blind_mapping[m['actual_model']] = m['blind_id']

    def resolve_activity_display_name(row: dict):
        display_name = _activity_display_name(row)
        if display_name:
            return display_name
        if current_user_id and row.get("user_id") == current_user_id:
            return current_display_name or ""
        return ""

    participant_display_names = {resolve_activity_display_name(row) for row in data if resolve_activity_display_name(row)}
    participant_display_names.update(resolve_activity_display_name(reply) for reply in reply_rows if resolve_activity_display_name(reply))
    badge_lookup = build_user_badge_lookup(participant_display_names, user_eval_rows, user_view_rows, GAMES_DATA, saved_profile_badges)

    reaction_map = {}
    for reaction in reaction_rows:
        key = reaction['evaluation_id']
        if key not in reaction_map:
            reaction_map[key] = {
                "like_count": 0,
                "dislike_count": 0,
                "user_reactions": {},
                "user_reactions_by_id": {},
            }
        if reaction['reaction_type'] == 'like':
            reaction_map[key]["like_count"] += 1
        elif reaction['reaction_type'] == 'dislike':
            reaction_map[key]["dislike_count"] += 1
        reaction_display_name = _activity_display_name(reaction)
        if reaction_display_name:
            reaction_map[key]["user_reactions"][reaction_display_name] = reaction['reaction_type']
        if reaction.get('user_id'):
            reaction_map[key]["user_reactions_by_id"][reaction['user_id']] = reaction['reaction_type']

    reply_map = {}
    for reply in reply_rows:
        evaluation_id = reply['evaluation_id']
        reply_map.setdefault(evaluation_id, [])
        is_blinded = bool(reply.get('is_blinded'))
        reply_display_name = resolve_activity_display_name(reply)
        reply_map[evaluation_id].append({
            "id": reply['id'],
            "display_name": reply_display_name,
            "reply": reply['reply'] if is_admin or not is_blinded else "",
            "created_at": reply.get('created_at'),
            "is_blinded": is_blinded,
            "badge": {
                "stage_key": badge_lookup.get(reply_display_name, {}).get('profile_badge_key', 'badge_egg')
            },
        })

    for row in data:
        m_name = row['actual_model_name']
        if m_name not in stats:
            stats[m_name] = {
                "count": 0,
                "scores": {"control": 0, "structure": 0, "presentation": 0, "difficulty": 0, "fun": 0, "overall": 0, "total": 0},
                "comments": []
            }
        stats[m_name]['count'] += 1
        stats[m_name]['scores']['control'] += row['score_control']
        stats[m_name]['scores']['structure'] += row['score_structure']
        stats[m_name]['scores']['presentation'] += row['score_presentation']
        stats[m_name]['scores']['difficulty'] += row['score_difficulty']
        stats[m_name]['scores']['fun'] += row['score_fun']
        stats[m_name]['scores']['overall'] += row['score_overall']
        stats[m_name]['scores']['total'] += row['total_score']

        if row.get('comment'):
            reaction_info = reaction_map.get(row['id'], {"like_count": 0, "dislike_count": 0, "user_reactions": {}, "user_reactions_by_id": {}})
            is_blinded = bool(row.get('is_blinded'))
            row_display_name = resolve_activity_display_name(row)
            stats[m_name]['comments'].append({
                "id": row['id'],
                "display_name": row_display_name,
                "comment": row['comment'] if is_admin or not is_blinded else "",
                "is_blinded": is_blinded,
                "created_at": row.get('created_at'),
                "like_count": reaction_info["like_count"],
                "dislike_count": reaction_info["dislike_count"],
                "user_reaction": (
                    reaction_info["user_reactions_by_id"].get(current_user_id)
                    if current_user_id
                    else reaction_info["user_reactions"].get(current_display_name) if current_display_name else None
                ),
                "badge": {
                    "stage_key": badge_lookup.get(row_display_name, {}).get('profile_badge_key', 'badge_egg')
                },
                "replies": reply_map.get(row['id'], []),
            })

    result = []
    for m_name, s in stats.items():
        count = s['count']
        result.append({
            "actual_model_name": m_name,
            "blind_id": blind_mapping.get(m_name, "?"),
            "model_key": _get_model_key(game_type, m_name),
            "participant_count": count,
            "avg_control": round(s['scores']['control'] / count, 1) if count > 0 else 0,
            "avg_structure": round(s['scores']['structure'] / count, 1) if count > 0 else 0,
            "avg_presentation": round(s['scores']['presentation'] / count, 1) if count > 0 else 0,
            "avg_difficulty": round(s['scores']['difficulty'] / count, 1) if count > 0 else 0,
            "avg_fun": round(s['scores']['fun'] / count, 1) if count > 0 else 0,
            "avg_overall": round(s['scores']['overall'] / count, 1) if count > 0 else 0,
            "avg_total": round(s['scores']['total'] / count, 1) if count > 0 else 0,
            "comments": s['comments']
        })

    return {"results": result, "is_admin": is_admin}

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    with open(STATIC_DIR / "index.html", "r", encoding="utf-8") as f:
        return f.read()


@app.get("/api/display-name-blocklist.csv")
async def get_display_name_blocklist():
    blocklist_path = BASE_DIR / "data" / "display_name_blocklist.csv"
    if not blocklist_path.exists():
        raise HTTPException(status_code=404, detail="display_name_blocklist_not_found")
    return FileResponse(
        str(blocklist_path),
        media_type="text/csv; charset=utf-8",
        filename="display_name_blocklist.csv",
    )


@app.get("/api/auth/config")
async def auth_config():
    return get_public_firebase_config()


@app.post("/api/auth/oauth/{provider}/link/start")
async def oauth_link_start(provider: str, request: Request):
    provider = _normalize_provider_key(provider)
    if provider not in {"kakao", "naver", "github", "discord", "steam"}:
        raise HTTPException(status_code=404, detail="oauth_provider_not_supported")
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    return _oauth_link_start_response(provider, profile)


@app.post("/api/auth/provider/{provider}/link-record")
async def record_firebase_provider_link(provider: str, request: Request):
    provider = _normalize_provider_key(provider)
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    identity = _extract_firebase_linked_provider_identity(user.get("uid", ""), provider)
    updated_profile = _link_oauth_profile(identity, profile)
    return {
        "profile": updated_profile,
        "linked_providers": _linked_provider_keys_for_profile(updated_profile),
        "is_admin": updated_profile.get("role") in ("admin", "super_admin"),
    }


@app.delete("/api/auth/provider/{provider}/link")
async def unlink_auth_provider(provider: str, request: Request):
    provider = _normalize_provider_key(provider)
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    return _unlink_oauth_profile_provider(profile, provider, _auth_provider_from_firebase_user(user))


@app.get("/api/auth/oauth/kakao/start")
async def kakao_oauth_start():
    return _oauth_start_redirect("kakao")


@app.get("/api/auth/oauth/kakao/callback")
async def kakao_oauth_callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
    response = None
    try:
        if error:
            response = _oauth_cancelled_html("kakao")
            response.delete_cookie("oauth_state_kakao")
            return response
        if not code:
            return _oauth_error_html("kakao", "oauth_code_missing")
        state_payload = _validate_oauth_state("kakao", state or "", request.cookies.get("oauth_state_kakao"))
        token_data = _exchange_kakao_code(code)
        access_token = token_data.get("access_token")
        if not access_token:
            return _oauth_error_html("kakao", "oauth_access_token_missing")
        kakao_user = _fetch_kakao_user(access_token)
        identity = _extract_kakao_identity(kakao_user)
        response = _handle_oauth_identity("kakao", identity, state_payload)
    except HTTPException as exc:
        response = _oauth_error_html("kakao", str(exc.detail))
    except Exception:
        response = _oauth_error_html("kakao", "oauth_login_failed")
    response.delete_cookie("oauth_state_kakao")
    return response


@app.get("/api/auth/oauth/naver/start")
async def naver_oauth_start():
    return _oauth_start_redirect("naver")


@app.get("/api/auth/oauth/naver/callback")
async def naver_oauth_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    response = None
    try:
        if error:
            response = _oauth_cancelled_html("naver")
            response.delete_cookie("oauth_state_naver")
            return response
        if not code:
            return _oauth_error_html("naver", "oauth_code_missing")
        state_payload = _validate_oauth_state("naver", state or "", request.cookies.get("oauth_state_naver"))
        token_data = _exchange_naver_code(code, state or "")
        access_token = token_data.get("access_token")
        if not access_token:
            return _oauth_error_html("naver", "oauth_access_token_missing")
        naver_user = _fetch_naver_user(access_token)
        identity = _extract_naver_identity(naver_user)
        response = _handle_oauth_identity("naver", identity, state_payload)
    except HTTPException as exc:
        response = _oauth_error_html("naver", str(exc.detail))
    except Exception:
        response = _oauth_error_html("naver", "oauth_login_failed")
    response.delete_cookie("oauth_state_naver")
    return response


@app.get("/api/auth/oauth/github/start")
async def github_oauth_start():
    return _oauth_start_redirect("github")


@app.get("/api/auth/oauth/github/callback")
async def github_oauth_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    response = None
    try:
        if error:
            response = _oauth_cancelled_html("github")
            response.delete_cookie("oauth_state_github")
            return response
        if not code:
            return _oauth_error_html("github", "oauth_code_missing")
        state_payload = _validate_oauth_state("github", state or "", request.cookies.get("oauth_state_github"))
        token_data = _exchange_github_code(code)
        access_token = token_data.get("access_token")
        if not access_token:
            return _oauth_error_html("github", "oauth_access_token_missing")
        github_user = _fetch_github_user(access_token)
        github_emails = _fetch_github_emails(access_token)
        identity = _extract_github_identity(github_user, github_emails)
        response = _handle_oauth_identity("github", identity, state_payload)
    except HTTPException as exc:
        response = _oauth_error_html("github", str(exc.detail))
    except Exception:
        response = _oauth_error_html("github", "oauth_login_failed")
    response.delete_cookie("oauth_state_github")
    return response


@app.get("/api/auth/oauth/discord/start")
async def discord_oauth_start():
    return _oauth_start_redirect("discord")


@app.get("/api/auth/oauth/discord/callback")
async def discord_oauth_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    response = None
    access_token = ""
    try:
        if error:
            response = _oauth_cancelled_html("discord")
            response.delete_cookie("oauth_state_discord")
            return response
        if not code:
            return _oauth_error_html("discord", "oauth_code_missing")
        state_payload = _validate_oauth_state("discord", state or "", request.cookies.get("oauth_state_discord"))
        token_data = _exchange_discord_code(code)
        access_token = token_data.get("access_token") or ""
        if not access_token:
            return _oauth_error_html("discord", "oauth_access_token_missing")
        discord_user = _fetch_discord_user(access_token)
        identity = _extract_discord_identity(discord_user)
        response = _handle_oauth_identity("discord", identity, state_payload)
    except HTTPException as exc:
        response = _oauth_error_html("discord", str(exc.detail))
    except Exception:
        response = _oauth_error_html("discord", "oauth_login_failed")
    finally:
        if access_token:
            try:
                _revoke_discord_access_token(access_token)
            except Exception:
                logger.exception("Discord access token revoke failed")
    response.delete_cookie("oauth_state_discord")
    return response


@app.get("/api/auth/oauth/steam/start")
async def steam_openid_start():
    return _oauth_start_redirect("steam")


@app.get("/api/auth/oauth/steam/callback")
async def steam_openid_callback(request: Request, state: str | None = None):
    response = None
    try:
        if request.query_params.get("openid.mode") == "cancel":
            response = _oauth_cancelled_html("steam")
            response.delete_cookie("oauth_state_steam")
            return response
        state_payload = _validate_oauth_state("steam", state or "", request.cookies.get("oauth_state_steam"))
        steam_id = _validate_steam_openid_assertion(request, state or "")
        player_summary = _fetch_steam_player_summary(steam_id)
        identity = _extract_steam_identity(steam_id, player_summary)
        response = _handle_oauth_identity("steam", identity, state_payload)
    except HTTPException as exc:
        response = _oauth_error_html("steam", str(exc.detail))
    except Exception:
        response = _oauth_error_html("steam", "openid_login_failed")
    response.delete_cookie("oauth_state_steam")
    return response


@app.get("/api/auth/me")
async def auth_me(request: Request):
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    linked_providers = _linked_provider_keys_for_profile(profile)
    return {
        "uid": user.get("uid", ""),
        "email": user.get("email"),
        "email_verified": bool(user.get("email_verified")),
        "name": user.get("name"),
        "picture": user.get("picture"),
        "provider": user.get("firebase", {}).get("sign_in_provider"),
        "profile": profile,
        "linked_providers": linked_providers,
        "is_admin": profile.get("role") in ("admin", "super_admin"),
        "display_name_changed_at": profile.get("display_name_changed_at"),
    }


@app.post("/api/auth/signup/email-code")
async def request_signup_email_code(payload: SignupEmailVerificationRequest, request: Request):
    if _is_email_taken(payload.email):
        raise HTTPException(status_code=409, detail="email_taken")
    identifier_hash = _hash_recovery_identifier("signup_email_code", payload.email)
    _check_recovery_rate_limit("signup_email_code", identifier_hash, request)
    return _create_signup_email_verification(payload.email, request)


@app.post("/api/auth/signup/confirm-email-code")
async def confirm_signup_email_code(payload: SignupEmailVerificationConfirm, request: Request):
    identifier_hash = _hash_recovery_identifier("signup_email_confirm", payload.email)
    _check_recovery_rate_limit("signup_email_confirm", identifier_hash, request)
    if not re.fullmatch(r"\d{6}", payload.code):
        raise HTTPException(status_code=400, detail="invalid_verification_code")
    return _confirm_signup_email_verification(payload.email, payload.code)


@app.get("/api/profile/login-id-availability")
async def check_login_id_availability(login_id: str):
    normalized_login_id = (login_id or "").strip()
    if not LOGIN_ID_RE.fullmatch(normalized_login_id):
        raise HTTPException(status_code=400, detail="login_id_format")
    try:
        return {
            "login_id": normalized_login_id,
            "available": not _is_login_id_taken(normalized_login_id),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="login_id_check_failed") from exc


@app.get("/api/profile/display-name-availability")
async def check_display_name_availability(display_name: str):
    normalized_display_name = (display_name or "").strip()
    is_valid, error_key = validate_display_name(normalized_display_name)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)
    try:
        return {
            "display_name": normalized_display_name,
            "available": not _is_display_name_taken(normalized_display_name),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="display_name_check_failed") from exc


@app.get("/api/auth/me/display-name/check")
async def check_my_display_name_availability(display_name: str, request: Request):
    """로그인한 사용자의 닉네임 변경용 중복 확인. 본인 닉네임은 중복으로 처리하지 않는다."""
    user = require_firebase_user(request)
    uid = user.get("uid", "")
    normalized = (display_name or "").strip()
    is_valid, error_key = validate_display_name(normalized)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)
    try:
        return {
            "display_name": normalized,
            "available": not _is_display_name_taken(normalized, uid),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="display_name_check_failed") from exc


@app.post("/api/auth/me/display-name")
async def change_my_display_name(payload: AccountDisplayNameChange, request: Request):
    """로그인한 사용자의 닉네임 변경. 30일 쿨다운 적용."""
    user = require_firebase_user(request)
    uid = user.get("uid", "")
    display_name = payload.display_name

    # Step 1: 쿨다운 체크 (가장 먼저)
    profile = _resolve_profile_for_firebase_user(user)
    base_date_str = profile.get("display_name_changed_at") or profile.get("created_at")
    if base_date_str:
        try:
            from datetime import datetime, timezone, timedelta
            base_date = datetime.fromisoformat(base_date_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - base_date < timedelta(days=30):
                raise HTTPException(status_code=429, detail="display_name_change_cooldown")
        except HTTPException:
            raise
        except Exception:
            pass

    # Step 2: 형식 + 필터 검증
    is_valid, error_key = validate_display_name(display_name)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)

    # Step 3: 중복 확인 (본인 제외)
    if _is_display_name_taken(display_name, uid):
        raise HTTPException(status_code=409, detail="display_name_taken")

    # Step 4: DB 업데이트
    now_iso = _now_iso()
    if LOCAL_TEST_MODE:
        if uid in LOCAL_DB["profiles"]:
            LOCAL_DB["profiles"][uid]["display_name"] = display_name
            LOCAL_DB["profiles"][uid]["display_name_changed_at"] = now_iso
        return {"display_name": display_name, "display_name_changed_at": now_iso}

    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    try:
        supabase.table("profiles").update({
            "display_name": display_name,
            "display_name_changed_at": now_iso,
            "updated_at": now_iso,
        }).eq("firebase_uid", uid).execute()
        return {"display_name": display_name, "display_name_changed_at": now_iso}
    except Exception as exc:
        raise HTTPException(status_code=500, detail="display_name_change_failed") from exc


@app.post("/api/auth/login-id-email")
async def resolve_login_id_email(payload: LoginIdEmailRequest, request: Request):
    login_id = payload.login_id.strip()
    identifier_hash = _hash_recovery_identifier("login_id_email", login_id)
    _check_recovery_rate_limit("login_id_email", identifier_hash, request)
    profile = _find_profile_by_login_id(login_id)
    if not profile or not profile.get("email"):
        _record_recovery_attempt("find_login_id", identifier_hash, request, False)
        _invalid_recovery_input()
    _record_recovery_attempt("find_login_id", identifier_hash, request, True)
    return {"email": _normalize_email(profile["email"])}


@app.patch("/api/profile/display-name")
async def update_profile_display_name(payload: ProfileDisplayNameUpdate, request: Request):
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    updated_profile = _update_profile_display_name(profile, payload.display_name)
    return {
        "profile": updated_profile,
        "is_admin": updated_profile.get("role") in ("admin", "super_admin"),
    }


@app.patch("/api/profile/identity")
async def update_profile_identity(payload: ProfileIdentityUpdate, request: Request):
    user = require_firebase_user(request)
    if user.get("email") and not user.get("email_verified"):
        if not _verify_signup_email_token(payload.email_verification_token, user.get("email", "")):
            raise HTTPException(status_code=403, detail="email_verification_required")
        try:
            from firebase_admin import auth as firebase_auth

            get_firebase_app()
            firebase_auth.update_user(user.get("uid"), email_verified=True)
            user["email_verified"] = True
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Failed to update Firebase email verification") from exc
    profile = _resolve_profile_for_firebase_user(user)
    updated_profile = _update_profile_identity(profile, payload)
    return {
        "profile": updated_profile,
        "is_admin": updated_profile.get("role") in ("admin", "super_admin"),
    }


@app.post("/api/auth/recovery/find-login-id")
async def recover_login_id(payload: FindLoginIdRequest, request: Request):
    identifier_hash = _hash_recovery_identifier("find_login_id", payload.real_name, payload.display_name, payload.email)
    _check_recovery_rate_limit("find_login_id", identifier_hash, request)
    profile = _find_profile_for_login_id_recovery(payload)
    if not profile:
        _record_recovery_attempt("find_login_id", identifier_hash, request, False)
        _invalid_recovery_input()

    _record_recovery_attempt("find_login_id", identifier_hash, request, True)
    return {
        "masked_login_id": _mask_login_id(profile.get("login_id", "")),
        "email_send_available": _is_mail_service_configured(),
    }


@app.post("/api/auth/recovery/send-login-id-email")
async def send_login_id_email(payload: SendLoginIdEmailRequest, request: Request):
    identifier_hash = _hash_recovery_identifier("send_login_id_email", payload.real_name, payload.display_name, payload.email)
    _check_recovery_rate_limit("send_login_id_email", identifier_hash, request)
    profile = _find_profile_for_login_id_recovery(payload)
    if not profile:
        _record_recovery_attempt("send_login_id_email", identifier_hash, request, False)
        _invalid_recovery_input()

    _send_login_id_email(_normalize_email(profile.get("email", payload.email)), profile.get("login_id", ""))
    _record_recovery_attempt("send_login_id_email", identifier_hash, request, True)
    return {"sent": True}


@app.post("/api/auth/recovery/password-reset")
async def recover_password(payload: PasswordResetRequest, request: Request):
    identifier_hash = _hash_recovery_identifier("reset_password", payload.real_name, payload.login_id, payload.email)
    _check_recovery_rate_limit("reset_password", identifier_hash, request)
    profile = _find_profile_for_password_reset(payload)
    if not profile:
        _record_recovery_attempt("reset_password", identifier_hash, request, False)
        _invalid_recovery_input()

    _send_password_reset_email(_normalize_email(profile.get("email", payload.email)), payload.language)
    _record_recovery_attempt("reset_password", identifier_hash, request, True)
    return {"sent": True}


@app.post("/api/auth/me/password-reset")
async def send_current_user_password_reset(request: Request):
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    email = _normalize_email(profile.get("email") or user.get("email") or "")
    if not EMAIL_RE.fullmatch(email):
        raise HTTPException(status_code=400, detail="invalid_recovery_input")
    language = request.query_params.get("lang") or request.headers.get("X-Client-Language") or "ko"
    _send_password_reset_email(email, language)
    return {"sent": True}


@app.post("/api/auth/me/email-change/code")
async def request_current_user_email_change_code(payload: SignupEmailVerificationRequest, request: Request):
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    normalized_email = _normalize_email(payload.email)
    if _normalize_email(profile.get("email", "")) == normalized_email:
        raise HTTPException(status_code=400, detail="email_unchanged")
    if _is_email_taken(normalized_email, profile.get("firebase_uid")):
        raise HTTPException(status_code=409, detail="email_taken")
    identifier_hash = _hash_recovery_identifier("email_change_code", profile.get("id", ""), normalized_email)
    _check_recovery_rate_limit("email_change_code", identifier_hash, request)
    return _create_signup_email_verification(normalized_email, request)


@app.post("/api/auth/me/email-change/confirm")
async def confirm_current_user_email_change(payload: SignupEmailVerificationConfirm, request: Request):
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    normalized_email = _normalize_email(payload.email)
    if not re.fullmatch(r"\d{6}", payload.code):
        raise HTTPException(status_code=400, detail="invalid_verification_code")
    if _normalize_email(profile.get("email", "")) == normalized_email:
        raise HTTPException(status_code=400, detail="email_unchanged")
    identifier_hash = _hash_recovery_identifier("email_change_confirm", profile.get("id", ""), normalized_email)
    _check_recovery_rate_limit("email_change_confirm", identifier_hash, request)
    _confirm_signup_email_verification(normalized_email, payload.code)
    updated_profile = _update_profile_email(profile, normalized_email)
    return {
        "profile": updated_profile,
        "is_admin": updated_profile.get("role") in ("admin", "super_admin"),
    }


@app.post("/api/auth/me/login-id/code")
async def request_current_user_login_id_code(payload: SignupEmailVerificationRequest, request: Request):
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    if profile.get("login_id"):
        raise HTTPException(status_code=409, detail="login_id_already_set")
    normalized_email = _normalize_email(payload.email)
    if _is_email_taken(normalized_email, profile.get("firebase_uid")):
        raise HTTPException(status_code=409, detail="email_taken")
    identifier_hash = _hash_recovery_identifier("login_id_create_code", profile.get("id", ""), normalized_email)
    _check_recovery_rate_limit("login_id_create_code", identifier_hash, request)
    return _create_signup_email_verification(normalized_email, request)


@app.post("/api/auth/me/login-id")
async def create_current_user_login_id(payload: AccountLoginIdCreate, request: Request):
    user = require_firebase_user(request)
    user_email = _normalize_email(user.get("email") or "")
    if not EMAIL_RE.fullmatch(user_email):
        raise HTTPException(status_code=400, detail="email_required_after_credential_link")
    if not _verify_signup_email_token(payload.email_verification_token, user_email):
        raise HTTPException(status_code=403, detail="email_verification_required")

    try:
        from firebase_admin import auth as firebase_auth

        get_firebase_app()
        firebase_auth.update_user(user.get("uid"), email_verified=True)
        user["email_verified"] = True
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to update Firebase email verification") from exc

    profile = _resolve_profile_for_firebase_user(user)
    updated_profile = _create_profile_login_id(profile, payload, user_email)
    return {
        "profile": updated_profile,
        "linked_providers": _linked_provider_keys_for_profile(updated_profile),
        "is_admin": updated_profile.get("role") in ("admin", "super_admin"),
    }


@app.patch("/api/profile/social-providers")
async def update_profile_social_providers(payload: SocialProvidersUpdate, request: Request):
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    updated_profile = _update_profile_social_providers(profile, payload.providers)
    return {
        "profile": updated_profile,
        "is_admin": updated_profile.get("role") in ("admin", "super_admin"),
    }


@app.delete("/api/profile/account")
async def delete_profile_account(payload: AccountDeletionRequest, request: Request):
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="account_delete_confirm_required")
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    provider_accounts = _get_provider_accounts_for_profile(profile.get("id"))
    _revoke_provider_accounts(provider_accounts)
    _anonymize_deleted_account(profile)
    delete_firebase_user(user.get("uid", ""))
    return {"deleted": True}


@app.get("/api/games")
async def get_games(lang: str = 'ko', blind_seed: str = ''):
    """Returns games grouped by type, hides actual model names, and includes play counts based on language."""
    response = {}
    
    # Use lang specific data or fallback to 'ko' if not found
    lang_games = GAMES_DATA.get(lang, GAMES_DATA.get('ko', {}))
    category_meta = get_category_meta(lang_games)
    
    seed = (blind_seed or "default")[:128]
    response_models_by_type = {}
    for g_type, models in lang_games.items():
        response_models = [dict(model) for model in models]
        random.Random(f"{seed}:{lang}:{g_type}").shuffle(response_models)
        for index, model in enumerate(response_models):
            model["blind_id"] = chr(65 + index)
        response_models_by_type[g_type] = response_models
        response[g_type] = [
            {
                "blind_id": m["blind_id"],
                "model_key": _get_model_key(g_type, m["actual_model"]),
                "blind_model_token": _get_blind_model_token(g_type, m["actual_model"]),
                "file": f"/static/{m['file']}",
            }
            for m in response_models
        ]
    
    play_counts = {}
    eval_counts = {}
    
    if LOCAL_TEST_MODE:
        for key, row in LOCAL_DB["game_stats"].items():
            play_counts[key] = row["plays"]

        for row in LOCAL_DB["evaluations"]:
            key = f"{row['game_type']}_{row['actual_model_name']}"
            if key not in eval_counts:
                eval_counts[key] = set()
            if row.get('user_id'):
                eval_counts[key].add(row['user_id'])
    elif supabase:
        try:
            # Fetch play counts
            res_plays = supabase.table('game_stats').select('*').execute()
            for row in res_plays.data:
                key = f"{row['game_type']}_{row['actual_model_name']}"
                play_counts[key] = row['plays']
                
            res_evals = supabase.table('evaluations').select('game_type, actual_model_name, user_id').execute()
            for row in res_evals.data:
                if not row.get('user_id'):
                    continue
                key = f"{row['game_type']}_{row['actual_model_name']}"
                if key not in eval_counts:
                    eval_counts[key] = set()
                eval_counts[key].add(row['user_id'])
        except Exception as e:
            print("DB Fetch Error:", e)
            
    # Enrich the response with stats
    for g_type, models in response_models_by_type.items():
        if g_type not in response:
            continue
        for m in response[g_type]:
            # find actual model name
            try:
                actual = next(x["actual_model"] for x in models if x["blind_id"] == m["blind_id"])
                key = f"{g_type}_{actual}"
                m["play_count"] = play_counts.get(key, 0)
                m["eval_count"] = len(eval_counts.get(key, set()))
            except StopIteration:
                pass

    return {"games": response, "categories": category_meta}

@app.post("/api/play")
async def record_play(data: PlayEvent, request: Request):
    actual_model = _find_actual_model(data.game_type, data.blind_model_id, blind_model_token=data.blind_model_token)
    actor = _get_actor_from_request(request, required=False)
            
    if actual_model:
        if LOCAL_TEST_MODE:
            key = f"{data.game_type}_{actual_model}"
            LOCAL_DB["game_stats"][key] = {
                "game_type": data.game_type,
                "actual_model_name": actual_model,
                "plays": LOCAL_DB["game_stats"].get(key, {}).get("plays", 0) + 1,
            }

            if actor:
                if actor.get("user_id"):
                    LOCAL_DB["user_views"].append({
                        "id": str(uuid4()),
                        "user_id": actor["user_id"],
                        "display_name": actor["display_name"],
                        "game_type": data.game_type,
                        "actual_model_name": actual_model,
                        "viewed_at": _now_iso(),
                    })
        else:
            try:
                res = supabase.table('game_stats').select('plays').eq('game_type', data.game_type).eq('actual_model_name', actual_model).execute()
                if res.data:
                    current_plays = res.data[0]['plays']
                    supabase.table('game_stats').update({"plays": current_plays + 1}).eq('game_type', data.game_type).eq('actual_model_name', actual_model).execute()
                else:
                    supabase.table('game_stats').insert({"game_type": data.game_type, "actual_model_name": actual_model, "plays": 1}).execute()

                if actor and actor.get("user_id"):
                    try:
                        supabase.table('user_views').insert({
                            "user_id": actor["user_id"],
                            "display_name": actor["display_name"],
                            "game_type": data.game_type,
                            "actual_model_name": actual_model,
                        }).execute()
                    except Exception as exc:
                        print(f"user_views insert skipped: {exc}", flush=True)
            except Exception as e:
                print("Play recording error:", e)
            
    return {"status": "ok"}

@app.post("/api/evaluate")
async def submit_evaluation(eval: Evaluation, request: Request):
    actor = _get_actor_from_request(request, required=True)
    display_name = actor["display_name"]
    is_valid_comment, comment_error = validate_comment_text(eval.comment)
    if not is_valid_comment:
        raise HTTPException(status_code=400, detail=comment_error)
    
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0] if forwarded else request.client.host
        
    actual_model = _find_actual_model(
        eval.game_type,
        eval.blind_model_id,
        getattr(eval, 'language', 'ko'),
        blind_model_token=eval.blind_model_token,
    )
    if not actual_model:
        raise HTTPException(status_code=400, detail="Invalid game type or blind ID")

    actor_key = actor.get("user_id") or display_name.casefold()
    global_history_key = f"global:{actor_key}"
    model_history_key = f"model:{actor_key}:{eval.game_type}:{actual_model}"

    same_model_allowed, same_model_wait = check_same_model_comment_rate_limit(COMMENT_SUBMISSION_HISTORY[model_history_key])
    if not same_model_allowed:
        raise HTTPException(status_code=429, detail=f"rate_limit_comment_same_model:{same_model_wait}")

    model_submission_count = len(COMMENT_SUBMISSION_HISTORY[model_history_key])
    if model_submission_count == 0:
        global_allowed, global_wait = check_comment_submission_rate_limit(COMMENT_SUBMISSION_HISTORY[global_history_key])
        if not global_allowed:
            raise HTTPException(status_code=429, detail=f"rate_limit_comment_submit:{global_wait}")
        
    total_score = (
        eval.score_control
        + eval.score_structure
        + eval.score_presentation
        + eval.score_difficulty
        + eval.score_fun
        + eval.score_overall
    )
    
    data = {
        "ip_address": ip,
        "game_type": eval.game_type,
        "actual_model_name": actual_model,
        "blind_model_id": eval.blind_model_id,
        "score_control": eval.score_control,
        "score_structure": eval.score_structure,
        "score_presentation": eval.score_presentation,
        "score_difficulty": eval.score_difficulty,
        "score_fun": eval.score_fun,
        "score_overall": eval.score_overall,
        "total_score": total_score,
        "comment": eval.comment,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "user_id": actor["user_id"],
        "profile_display_name": display_name,
    }
    
    try:
        if LOCAL_TEST_MODE:
            existing = next((
                row for row in LOCAL_DB["evaluations"]
                if row.get("user_id") == actor["user_id"]
                and row["game_type"] == eval.game_type
                and row["actual_model_name"] == actual_model
            ), None)
            if existing:
                existing.update(data)
                existing["updated_at"] = _now_iso()
            else:
                data["id"] = str(uuid4())
                data["created_at"] = _now_iso()
                data["updated_at"] = _now_iso()
                data["is_blinded"] = False
                LOCAL_DB["evaluations"].append(data)
        else:
            try:
                existing_res = (
                    supabase.table('evaluations')
                    .select('id')
                    .eq('user_id', actor["user_id"])
                    .eq('game_type', eval.game_type)
                    .eq('actual_model_name', actual_model)
                    .limit(1)
                    .execute()
                )
                existing = (existing_res.data or [None])[0]
                if existing:
                    supabase.table('evaluations').update(data).eq('id', existing['id']).execute()
                else:
                    insert_data = {
                        **data,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    supabase.table('evaluations').insert(insert_data).execute()
            except Exception as exc:
                stripped_data = _strip_postgrest_missing_column_fields(data, exc)
                if stripped_data:
                    if actor.get("user_id") and "user_id" not in stripped_data:
                        raise
                    print(f"evaluation save missing-column fallback: {exc}", flush=True)
                    existing_res = (
                        supabase.table('evaluations')
                        .select('id')
                        .eq('user_id', actor["user_id"])
                        .eq('game_type', eval.game_type)
                        .eq('actual_model_name', actual_model)
                        .limit(1)
                        .execute()
                    )
                    existing = (existing_res.data or [None])[0]
                    if existing:
                        supabase.table('evaluations').update(stripped_data).eq('id', existing['id']).execute()
                    else:
                        supabase.table('evaluations').insert({
                            **stripped_data,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }).execute()
                else:
                    raise
        now_ts = datetime.now(timezone.utc).timestamp()
        COMMENT_SUBMISSION_HISTORY[global_history_key].append(now_ts)
        COMMENT_SUBMISSION_HISTORY[model_history_key].append(now_ts)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user_evals")
async def get_current_user_evals(request: Request):
    _, profile = _get_request_profile(request, required=True)
    profile_id = _get_profile_id(profile)
    display_name = _get_profile_display_name(profile)
    if LOCAL_TEST_MODE:
        return {
            "evals": [
                {
                    "game_type": row["game_type"],
                    "blind_model_id": row["blind_model_id"],
                    "model_key": _get_model_key(row["game_type"], row["actual_model_name"]),
                    "total_score": row["total_score"],
                    "actual_model_name": row["actual_model_name"],
                }
                for row in LOCAL_DB["evaluations"]
                if profile_id and row.get("user_id") == profile_id
            ]
        }
    try:
        res = (
            supabase.table('evaluations')
            .select('game_type, blind_model_id, total_score, actual_model_name')
            .eq('user_id', profile_id)
            .execute()
        )
        eval_rows = []
        for row in res.data or []:
            eval_rows.append({
                **row,
                "model_key": _get_model_key(row["game_type"], row["actual_model_name"]),
            })
        return {"evals": eval_rows}
    except Exception:
        return {"evals": []}


@app.get("/api/results/{game_type}")
async def get_results(game_type: str, request: Request):
    actor = _get_actor_from_request(request, required=False)
    current_display_name = actor["display_name"] if actor else None
    is_admin = bool(actor and actor.get("is_admin"))

    try:
        if LOCAL_TEST_MODE:
            data = [row for row in LOCAL_DB["evaluations"] if row["game_type"] == game_type]
            eval_ids = {row["id"] for row in data}
            reaction_rows = [row for row in LOCAL_DB["comment_reactions"] if row["evaluation_id"] in eval_ids]
            reply_rows = [row for row in LOCAL_DB["comment_replies"] if row["evaluation_id"] in eval_ids]
            participant_display_names = {_activity_display_name(row) for row in data if _activity_display_name(row)}
            participant_display_names.update(_activity_display_name(reply) for reply in reply_rows if _activity_display_name(reply))
            user_eval_rows = [row for row in LOCAL_DB["evaluations"] if _activity_display_name(row) in participant_display_names]
            user_view_rows = [row for row in LOCAL_DB["user_views"] if _activity_display_name(row) in participant_display_names]
            saved_profile_badges = {}
            saved_profile_badges.update({
                profile.get("display_name"): profile.get("profile_badge_key")
                for profile in LOCAL_DB["profiles"].values()
                if profile.get("display_name") in participant_display_names
            })
            return _build_results_payload(game_type, data, reaction_rows, reply_rows, current_display_name, is_admin, user_eval_rows, user_view_rows, saved_profile_badges, actor.get("user_id") if actor else None)

        res = supabase.table('evaluations').select('*').eq('game_type', game_type).execute()
        data = res.data
        reaction_rows = []
        reply_rows = []
        if data:
            eval_ids = [row['id'] for row in data]
            if eval_ids:
                reaction_res = supabase.table('comment_reactions').select('evaluation_id, profile_display_name, user_id, reaction_type').in_('evaluation_id', eval_ids).execute()
                reaction_rows = reaction_res.data or []
                reply_res = supabase.table('comment_replies').select('id, evaluation_id, profile_display_name, reply, is_blinded, created_at').in_('evaluation_id', eval_ids).order('created_at', desc=True).execute()
                reply_rows = reply_res.data or []
        
        user_eval_rows = []
        user_view_rows = []
        saved_profile_badges = {}
        participant_display_names = {_activity_display_name(row) for row in data if _activity_display_name(row)}
        participant_display_names.update(_activity_display_name(reply) for reply in reply_rows if _activity_display_name(reply))
        if participant_display_names:
            participant_list = list(participant_display_names)
            try:
                all_eval_res = supabase.table('evaluations').select('profile_display_name, game_type, actual_model_name').in_('profile_display_name', participant_list).execute()
                user_eval_rows = all_eval_res.data or []
            except Exception as exc:
                print(f"results user evaluation badge lookup skipped: {exc}", flush=True)
            try:
                all_view_res = supabase.table('user_views').select('display_name, game_type, actual_model_name').in_('display_name', participant_list).execute()
                user_view_rows = all_view_res.data or []
            except Exception as exc:
                print(f"results user_views badge lookup skipped: {exc}", flush=True)
            try:
                account_profile_res = supabase.table('profiles').select('display_name, profile_badge_key').in_('display_name', participant_list).execute()
                saved_profile_badges = {
                    row['display_name']: row.get('profile_badge_key')
                    for row in (account_profile_res.data or [])
                    if row.get('display_name')
                }
            except Exception as exc:
                print(f"results account profile badges skipped: {exc}", flush=True)

        return _build_results_payload(game_type, data, reaction_rows, reply_rows, current_display_name, is_admin, user_eval_rows, user_view_rows, saved_profile_badges, actor.get("user_id") if actor else None)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/comment-reaction")
async def toggle_comment_reaction(payload: CommentReactionToggle, request: Request):
    actor = _get_actor_from_request(request, required=True)
    display_name = actor["display_name"]

    if payload.reaction_type not in ("like", "dislike"):
        raise HTTPException(status_code=400, detail="invalid_reaction_type")

    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0] if forwarded else request.client.host
    actor_key = actor.get("user_id") or display_name.casefold()
    allowed, wait_time = check_memory_rate_limit(COMMENT_REACTION_RATE_LIMITS, f"{ip}:{actor_key}", 30, 20)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"rate_limit_comment_reaction:{wait_time}")

    try:
        if LOCAL_TEST_MODE:
            existing = next((
                row for row in LOCAL_DB["comment_reactions"]
                if row["evaluation_id"] == payload.evaluation_id
                and row.get("user_id") == actor["user_id"]
            ), None)
        else:
            query = supabase.table('comment_reactions').select('id, reaction_type').eq('evaluation_id', payload.evaluation_id)
            existing_res = query.eq('user_id', actor["user_id"]).limit(1).execute()
            existing = existing_res.data[0] if existing_res.data else None

        transition = resolve_comment_reaction(existing['reaction_type'] if existing else None, payload.reaction_type)

        if transition["action"] == "delete":
            if LOCAL_TEST_MODE:
                LOCAL_DB["comment_reactions"] = [row for row in LOCAL_DB["comment_reactions"] if row["id"] != existing["id"]]
            else:
                supabase.table('comment_reactions').delete().eq('id', existing['id']).execute()
            current_reaction = transition["current_reaction"]
        elif transition["action"] == "update":
            if LOCAL_TEST_MODE:
                existing["reaction_type"] = payload.reaction_type
                existing["updated_at"] = _now_iso()
            else:
                supabase.table('comment_reactions').update({
                    "reaction_type": payload.reaction_type,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq('id', existing['id']).execute()
            current_reaction = transition["current_reaction"]
        else:
            if LOCAL_TEST_MODE:
                LOCAL_DB["comment_reactions"].append({
                    "id": str(uuid4()),
                    "evaluation_id": payload.evaluation_id,
                    "user_id": actor["user_id"],
                    "profile_display_name": display_name,
                    "reaction_type": payload.reaction_type,
                    "created_at": _now_iso(),
                    "updated_at": _now_iso(),
                })
            else:
                insert_data = {
                    "evaluation_id": payload.evaluation_id,
                    "user_id": actor["user_id"],
                    "profile_display_name": display_name,
                    "reaction_type": payload.reaction_type,
                }
                supabase.table('comment_reactions').insert(insert_data).execute()
            current_reaction = transition["current_reaction"]

        like_count = 0
        dislike_count = 0
        count_rows = (
            [row for row in LOCAL_DB["comment_reactions"] if row["evaluation_id"] == payload.evaluation_id]
            if LOCAL_TEST_MODE else
            (supabase.table('comment_reactions').select('reaction_type').eq('evaluation_id', payload.evaluation_id).execute().data or [])
        )
        for row in count_rows:
            if row['reaction_type'] == 'like':
                like_count += 1
            elif row['reaction_type'] == 'dislike':
                dislike_count += 1

        return {
            "status": "success",
            "evaluation_id": payload.evaluation_id,
            "current_reaction": current_reaction,
            "like_count": like_count,
            "dislike_count": dislike_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/comment-reply")
async def create_comment_reply(payload: CommentReplyCreate, request: Request):
    actor = _get_actor_from_request(request, required=True)
    display_name = actor["display_name"]

    is_valid_reply, reply_error = validate_comment_text(payload.reply)
    if not is_valid_reply:
        raise HTTPException(status_code=400, detail=reply_error)

    if LOCAL_TEST_MODE:
        recent_reply_rows = [
            {
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
            }
            for row in LOCAL_DB["comment_replies"]
            if row.get("user_id") == actor["user_id"]
        ]
    else:
        query = supabase.table('comment_replies').select('created_at, updated_at')
        reply_limit_res = query.eq('user_id', actor["user_id"]).execute()
        recent_reply_rows = reply_limit_res.data or []

    allowed, wait_time, limit_reason = check_reply_submission_rate_limit(recent_reply_rows)
    if not allowed:
        detail_key = "rate_limit_comment_reply_daily" if limit_reason == "quota" else "rate_limit_comment_reply"
        raise HTTPException(status_code=429, detail=f"{detail_key}:{wait_time}")

    try:
        if LOCAL_TEST_MODE:
            found = any(row["id"] == payload.evaluation_id for row in LOCAL_DB["evaluations"])
        else:
            eval_res = supabase.table('evaluations').select('id').eq('id', payload.evaluation_id).limit(1).execute()
            found = bool(eval_res.data)
        if not found:
            raise HTTPException(status_code=404, detail="comment_not_found")

        if LOCAL_TEST_MODE:
            LOCAL_DB["comment_replies"].append({
                "id": str(uuid4()),
                "evaluation_id": payload.evaluation_id,
                "user_id": actor["user_id"],
                "profile_display_name": display_name,
                "reply": payload.reply,
                "is_blinded": False,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
            })
        else:
            insert_data = {
                "evaluation_id": payload.evaluation_id,
                "user_id": actor["user_id"],
                "profile_display_name": display_name,
                "reply": payload.reply,
            }
            supabase.table('comment_replies').insert(insert_data).execute()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/blind")
async def admin_toggle_blind(payload: AdminBlindToggle, request: Request):
    actor = _get_actor_from_request(request, required=True)
    if not actor.get("is_admin"):
        raise HTTPException(status_code=401, detail="admin_auth_required")

    table_map = {
        "comment": "evaluations",
        "reply": "comment_replies",
    }
    table_name = table_map.get(payload.target_type)
    if not table_name:
        raise HTTPException(status_code=400, detail="invalid_blind_target")

    try:
        if LOCAL_TEST_MODE:
            store_name = "evaluations" if table_name == "evaluations" else "comment_replies"
            target = next((row for row in LOCAL_DB[store_name] if row["id"] == payload.target_id), None)
            if not target:
                raise HTTPException(status_code=404, detail="blind_target_not_found")
            target["is_blinded"] = payload.is_blinded
            target["updated_at"] = _now_iso()
        else:
            existing_res = supabase.table(table_name).select('id').eq('id', payload.target_id).limit(1).execute()
            if not existing_res.data:
                raise HTTPException(status_code=404, detail="blind_target_not_found")

            update_data = {
                "is_blinded": payload.is_blinded,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            } if table_name == "comment_replies" else {
                "is_blinded": payload.is_blinded,
            }

            supabase.table(table_name).update(update_data).eq('id', payload.target_id).execute()
        return {
            "status": "success",
            "target_type": payload.target_type,
            "target_id": payload.target_id,
            "is_blinded": payload.is_blinded,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/mypage")
async def get_current_mypage(request: Request):
    _, profile = _get_request_profile(request, required=True)
    if LOCAL_TEST_MODE:
        return _summarize_mypage_for_profile(
            profile,
            _local_get_eval_rows_for_profile(profile),
            _local_get_view_rows_for_profile(profile),
        )

    try:
        profile_id = _get_profile_id(profile)
        eval_rows = []
        view_rows = []

        eval_res = supabase.table('evaluations').select('game_type, actual_model_name').eq('user_id', profile_id).execute()
        eval_rows = eval_res.data or []

        view_res = supabase.table('user_views').select('game_type, actual_model_name').eq('user_id', profile_id).execute()
        view_rows = view_res.data or []

        return _summarize_mypage_for_profile(profile, eval_rows, view_rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mypage/profile-badge")
async def update_profile_badge(payload: ProfileBadgeUpdate, request: Request):
    actor = _get_actor_from_request(request, required=True)
    profile = actor.get("profile")
    display_name = actor["display_name"]
    try:
        if LOCAL_TEST_MODE:
            eval_rows = _local_get_eval_rows_for_profile(profile)
            view_rows = _local_get_view_rows_for_profile(profile)
            unlocked_badge_keys = get_unlocked_badge_keys(eval_rows, view_rows, GAMES_DATA)
        else:
            eval_rows = []
            view_rows = []
            eval_res = supabase.table('evaluations').select('game_type, actual_model_name').eq('user_id', actor["user_id"]).execute()
            eval_rows = eval_res.data or []
            view_res = supabase.table('user_views').select('game_type, actual_model_name').eq('user_id', actor["user_id"]).execute()
            view_rows = view_res.data or []
            unlocked_badge_keys = get_unlocked_badge_keys(eval_rows, view_rows, GAMES_DATA)
        if payload.badge_key not in unlocked_badge_keys:
            raise HTTPException(status_code=400, detail="profile_badge_locked")

        resolved_badge_key = resolve_profile_badge_key(payload.badge_key, unlocked_badge_keys)
        if LOCAL_TEST_MODE:
            profile["profile_badge_key"] = resolved_badge_key
            profile["updated_at"] = _now_iso()
        else:
            supabase.table('profiles').update({
                "profile_badge_key": resolved_badge_key,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq('id', actor["user_id"]).execute()
        return {"status": "success", "profile_badge_key": resolved_badge_key}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
