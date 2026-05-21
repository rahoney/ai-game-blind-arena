from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
import os
import hashlib
import hmac
import base64
import secrets
import re
from urllib import error as urllib_error
from urllib import request as urllib_request
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from postgrest.exceptions import APIError
try:
    from .database import supabase
    from .auth import get_firebase_app, get_public_firebase_config, get_super_admin_uids, require_firebase_user
    from .models import (
        Evaluation,
        PlayEvent,
        NicknameLogin,
        ProfileDisplayNameUpdate,
        ProfileIdentityUpdate,
        SignupEmailVerificationRequest,
        SignupEmailVerificationConfirm,
        FindLoginIdRequest,
        PasswordResetRequest,
        SendLoginIdEmailRequest,
        SocialProvidersUpdate,
        CommentReactionToggle,
        CommentReplyCreate,
        AdminAuthRequest,
        AdminBlindToggle,
        ProfileBadgeUpdate,
    )
    from .services import GAMES_DATA, get_category_meta
    from .utils import (
        check_comment_submission_rate_limit,
        check_same_model_comment_rate_limit,
        check_reply_submission_rate_limit,
        validate_nickname,
        validate_comment_text,
        get_badge_info,
        check_memory_rate_limit,
        make_rate_limit_store,
        summarize_mypage_data,
        resolve_comment_reaction,
        is_admin_nickname,
        get_admin_password,
        issue_admin_token,
        verify_admin_token,
        build_user_badge_lookup,
        get_unlocked_badge_keys,
        resolve_profile_badge_key,
    )
except ImportError:
    from database import supabase
    from auth import get_firebase_app, get_public_firebase_config, get_super_admin_uids, require_firebase_user
    from models import (
        Evaluation,
        PlayEvent,
        NicknameLogin,
        ProfileDisplayNameUpdate,
        ProfileIdentityUpdate,
        SignupEmailVerificationRequest,
        SignupEmailVerificationConfirm,
        FindLoginIdRequest,
        PasswordResetRequest,
        SendLoginIdEmailRequest,
        SocialProvidersUpdate,
        CommentReactionToggle,
        CommentReplyCreate,
        AdminAuthRequest,
        AdminBlindToggle,
        ProfileBadgeUpdate,
    )
    from services import GAMES_DATA, get_category_meta
    from utils import (
        check_comment_submission_rate_limit,
        check_same_model_comment_rate_limit,
        check_reply_submission_rate_limit,
        validate_nickname,
        validate_comment_text,
        get_badge_info,
        check_memory_rate_limit,
        make_rate_limit_store,
        summarize_mypage_data,
        resolve_comment_reaction,
        is_admin_nickname,
        get_admin_password,
        issue_admin_token,
        verify_admin_token,
        build_user_badge_lookup,
        get_unlocked_badge_keys,
        resolve_profile_badge_key,
    )

app = FastAPI(title="LLM Game Evaluator")
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
LOGIN_RATE_LIMITS = make_rate_limit_store()
COMMENT_REACTION_RATE_LIMITS = make_rate_limit_store()
COMMENT_REPLY_RATE_LIMITS = make_rate_limit_store()
ADMIN_AUTH_RATE_LIMITS = make_rate_limit_store()
COMMENT_SUBMISSION_HISTORY = make_rate_limit_store()
RECOVERY_RATE_LIMITS = make_rate_limit_store()
LOCAL_TEST_MODE = not bool(supabase)
LOCAL_DB = {
    "nicknames": {},
    "profiles": {},
    "game_stats": {},
    "evaluations": [],
    "nickname_views": [],
    "comment_reactions": [],
    "comment_replies": [],
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
LOGIN_ID_RE = re.compile(r"^[A-Za-z0-9_]{4,30}$")


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
    sender_name = os.environ.get("MAIL_FROM_NAME") or "AI Game Blind Arena"
    if not api_key or not sender_email:
        raise HTTPException(status_code=503, detail="mail_service_not_configured")

    body = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": email}],
        "subject": "AI Game Blind Arena 아이디 안내",
        "textContent": f"요청하신 AI Game Blind Arena 아이디는 {login_id} 입니다.",
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
        raise HTTPException(status_code=502, detail="mail_send_failed") from exc
    except urllib_error.URLError as exc:
        raise HTTPException(status_code=502, detail="mail_send_failed") from exc


def _is_mail_service_configured():
    return bool(os.environ.get("BREVO_API_KEY") and os.environ.get("MAIL_FROM_EMAIL"))


def _send_signup_verification_email(email: str, code: str):
    api_key = os.environ.get("BREVO_API_KEY")
    sender_email = os.environ.get("MAIL_FROM_EMAIL")
    sender_name = os.environ.get("MAIL_FROM_NAME") or "AI Game Blind Arena"
    if not api_key or not sender_email:
        raise HTTPException(status_code=503, detail="mail_service_not_configured")

    body = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": email}],
        "subject": "AI Game Blind Arena 이메일 인증 코드",
        "textContent": f"AI Game Blind Arena 회원가입 인증 코드는 {code} 입니다. 10분 안에 입력해 주세요.",
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
        raise HTTPException(status_code=502, detail="mail_send_failed") from exc
    except urllib_error.URLError as exc:
        raise HTTPException(status_code=502, detail="mail_send_failed") from exc


def _create_signup_email_verification(email: str, request: Request):
    normalized_email = _normalize_email(email)
    if not EMAIL_RE.fullmatch(normalized_email):
        _invalid_recovery_input()
    code = f"{secrets.randbelow(1000000):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
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
    return {"sent": True, "expires_in_seconds": 600}


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


def _validate_identity_fields(login_id: str, real_name: str, display_name: str):
    if not LOGIN_ID_RE.fullmatch(login_id):
        raise HTTPException(status_code=400, detail="login_id_format")
    if not _is_valid_real_name(real_name):
        raise HTTPException(status_code=400, detail="real_name_format")
    is_valid, error_key = validate_nickname(display_name)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)


def _is_valid_real_name(real_name: str):
    name = real_name.strip()
    if not name:
        return False
    if re.search(r"[^A-Za-z가-힣\s]", name):
        return False
    if re.search(r"[ㄱ-ㅎㅏ-ㅣ]", name):
        return False
    has_korean = bool(re.search(r"[가-힣]", name))
    has_english = bool(re.search(r"[A-Za-z]", name))
    if has_korean and (has_english or re.search(r"\s", name)):
        return False
    if has_english and re.search(r"([A-Za-z])\1\1", name, re.IGNORECASE):
        return False
    return True


def _profile_payload_from_firebase_user(user: dict, role: str):
    firebase_info = user.get("firebase", {}) or {}
    provider = firebase_info.get("sign_in_provider")
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


def _update_profile_display_name(profile: dict, display_name: str):
    is_valid, error_key = validate_nickname(display_name)
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
        duplicate_res = (
            supabase.table("profiles")
            .select("id, firebase_uid")
            .ilike("display_name", display_name)
            .limit(1)
            .execute()
        )
        duplicate = (duplicate_res.data or [None])[0]
        if duplicate and duplicate.get("firebase_uid") != uid:
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
    _validate_identity_fields(payload.login_id, payload.real_name, payload.display_name)
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
        login_duplicate_res = (
            supabase.table("profiles")
            .select("id, firebase_uid")
            .ilike("login_id", payload.login_id)
            .limit(1)
            .execute()
        )
        login_duplicate = (login_duplicate_res.data or [None])[0]
        if login_duplicate and login_duplicate.get("firebase_uid") != uid:
            raise HTTPException(status_code=409, detail="login_id_taken")

        display_duplicate_res = (
            supabase.table("profiles")
            .select("id, firebase_uid")
            .ilike("display_name", payload.display_name)
            .limit(1)
            .execute()
        )
        display_duplicate = (display_duplicate_res.data or [None])[0]
        if display_duplicate and display_duplicate.get("firebase_uid") != uid:
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
    cleaned = sorted({provider for provider in providers if provider})
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


def _find_actual_model(game_type: str, blind_model_id: str, preferred_lang: str = "ko"):
    lang_games = GAMES_DATA.get(preferred_lang, GAMES_DATA.get('ko', {}))
    for m in lang_games.get(game_type, []):
        if m["blind_id"] == blind_model_id:
            return m["actual_model"]

    for lang_dict in GAMES_DATA.values():
        for m in lang_dict.get(game_type, []):
            if m["blind_id"] == blind_model_id:
                return m["actual_model"]
    return None


def _local_upsert_nickname(nickname: str):
    existing = LOCAL_DB["nicknames"].get(nickname)
    if existing:
        existing["last_active_at"] = _now_iso()
        return {"status": "success", "nickname": nickname, "created": False}

    LOCAL_DB["nicknames"][nickname] = {
        "nickname": nickname,
        "profile_badge_key": None,
        "created_at": _now_iso(),
        "last_active_at": _now_iso(),
    }
    return {"status": "success", "nickname": nickname, "created": True}


def _local_get_eval_rows_for_nickname(nickname: str):
    return [
        {"game_type": row["game_type"], "actual_model_name": row["actual_model_name"]}
        for row in LOCAL_DB["evaluations"]
        if row["nickname"] == nickname
    ]


def _local_get_view_rows_for_nickname(nickname: str):
    return [
        {"game_type": row["game_type"], "actual_model_name": row["actual_model_name"]}
        for row in LOCAL_DB["nickname_views"]
        if row["nickname"] == nickname
    ]


def _build_results_payload(game_type: str, data, reaction_rows, reply_rows, nickname: str | None, is_admin: bool, user_eval_rows, user_view_rows, saved_profile_badges):
    stats = {}
    blind_mapping = {}
    for lang_dict in GAMES_DATA.values():
        for m in lang_dict.get(game_type, []):
            blind_mapping[m['actual_model']] = m['blind_id']

    participant_nicknames = {row['nickname'] for row in data}
    participant_nicknames.update(reply['nickname'] for reply in reply_rows)
    badge_lookup = build_user_badge_lookup(participant_nicknames, user_eval_rows, user_view_rows, GAMES_DATA, saved_profile_badges)

    reaction_map = {}
    for reaction in reaction_rows:
        key = reaction['evaluation_id']
        if key not in reaction_map:
            reaction_map[key] = {
                "like_count": 0,
                "dislike_count": 0,
                "user_reactions": {}
            }
        if reaction['reaction_type'] == 'like':
            reaction_map[key]["like_count"] += 1
        elif reaction['reaction_type'] == 'dislike':
            reaction_map[key]["dislike_count"] += 1
        reaction_map[key]["user_reactions"][reaction['nickname']] = reaction['reaction_type']

    reply_map = {}
    for reply in reply_rows:
        evaluation_id = reply['evaluation_id']
        reply_map.setdefault(evaluation_id, [])
        is_blinded = bool(reply.get('is_blinded'))
        reply_map[evaluation_id].append({
            "id": reply['id'],
            "nickname": reply['nickname'],
            "reply": reply['reply'] if is_admin or not is_blinded else "",
            "created_at": reply.get('created_at'),
            "is_blinded": is_blinded,
            "badge": {
                "stage_key": badge_lookup.get(reply['nickname'], {}).get('profile_badge_key', 'badge_egg')
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
            reaction_info = reaction_map.get(row['id'], {"like_count": 0, "dislike_count": 0, "user_reactions": {}})
            is_blinded = bool(row.get('is_blinded'))
            stats[m_name]['comments'].append({
                "id": row['id'],
                "nickname": row['nickname'],
                "comment": row['comment'] if is_admin or not is_blinded else "",
                "is_blinded": is_blinded,
                "created_at": row.get('created_at'),
                "like_count": reaction_info["like_count"],
                "dislike_count": reaction_info["dislike_count"],
                "user_reaction": reaction_info["user_reactions"].get(nickname) if nickname else None,
                "badge": {
                    "stage_key": badge_lookup.get(row['nickname'], {}).get('profile_badge_key', 'badge_egg')
                },
                "replies": reply_map.get(row['id'], []),
            })

    result = []
    for m_name, s in stats.items():
        count = s['count']
        result.append({
            "actual_model_name": m_name,
            "blind_id": blind_mapping.get(m_name, "?"),
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


@app.get("/api/auth/config")
async def auth_config():
    return get_public_firebase_config()


@app.get("/api/auth/me")
async def auth_me(request: Request):
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    return {
        "uid": user.get("uid", ""),
        "email": user.get("email"),
        "email_verified": bool(user.get("email_verified")),
        "name": user.get("name"),
        "picture": user.get("picture"),
        "provider": user.get("firebase", {}).get("sign_in_provider"),
        "profile": profile,
        "is_admin": profile.get("role") in ("admin", "super_admin"),
    }


@app.post("/api/auth/signup/email-code")
async def request_signup_email_code(payload: SignupEmailVerificationRequest, request: Request):
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

    _record_recovery_attempt("reset_password", identifier_hash, request, True)
    return {"email": _normalize_email(profile.get("email", payload.email))}


@app.patch("/api/profile/social-providers")
async def update_profile_social_providers(payload: SocialProvidersUpdate, request: Request):
    user = require_firebase_user(request)
    profile = _resolve_profile_for_firebase_user(user)
    updated_profile = _update_profile_social_providers(profile, payload.providers)
    return {
        "profile": updated_profile,
        "is_admin": updated_profile.get("role") in ("admin", "super_admin"),
    }


@app.post("/api/nickname/login")
async def nickname_login(payload: NicknameLogin, request: Request):
    nickname = payload.nickname.strip()
    is_valid, error_key = validate_nickname(nickname)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)

    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0] if forwarded else request.client.host
    allowed, wait_time = check_memory_rate_limit(LOGIN_RATE_LIMITS, f"{ip}:{nickname.casefold()}", 60, 6)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"rate_limit_login:{wait_time}")

    if is_admin_nickname(nickname):
        return {"status": "admin_required", "nickname": nickname}

    if LOCAL_TEST_MODE:
        return _local_upsert_nickname(nickname)

    try:
        existing = supabase.table('nicknames').select('nickname').eq('nickname', nickname).limit(1).execute()
        if existing.data:
            supabase.table('nicknames').update({"last_active_at": datetime.now(timezone.utc).isoformat()}).eq('nickname', nickname).execute()
            return {"status": "success", "nickname": nickname, "created": False}

        supabase.table('nicknames').insert({"nickname": nickname}).execute()
        return {"status": "success", "nickname": nickname, "created": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _upsert_nickname_login(nickname: str):
    if LOCAL_TEST_MODE:
        return _local_upsert_nickname(nickname)

    existing = supabase.table('nicknames').select('nickname').eq('nickname', nickname).limit(1).execute()
    if existing.data:
        supabase.table('nicknames').update({"last_active_at": datetime.now(timezone.utc).isoformat()}).eq('nickname', nickname).execute()
        return {"status": "success", "nickname": nickname, "created": False}

    supabase.table('nicknames').insert({"nickname": nickname}).execute()
    return {"status": "success", "nickname": nickname, "created": True}


@app.post("/api/admin/auth")
async def admin_auth(payload: AdminAuthRequest, request: Request):
    nickname = payload.nickname.strip()
    is_valid, error_key = validate_nickname(nickname)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)
    if not is_admin_nickname(nickname):
        raise HTTPException(status_code=403, detail="admin_auth_forbidden")
    if not get_admin_password():
        raise HTTPException(status_code=503, detail="admin_auth_not_configured")

    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0] if forwarded else request.client.host
    allowed, wait_time = check_memory_rate_limit(ADMIN_AUTH_RATE_LIMITS, f"{ip}:{nickname.casefold()}", 60, 5)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"rate_limit_admin_auth:{wait_time}")

    if payload.password != get_admin_password():
        raise HTTPException(status_code=401, detail="admin_auth_invalid_password")

    try:
        login_result = _upsert_nickname_login(nickname)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        **login_result,
        "is_admin": True,
        "admin_token": issue_admin_token(nickname),
    }

@app.get("/api/games")
async def get_games(lang: str = 'ko'):
    """Returns games grouped by type, hides actual model names, and includes play counts based on language."""
    response = {}
    
    # Use lang specific data or fallback to 'ko' if not found
    lang_games = GAMES_DATA.get(lang, GAMES_DATA.get('ko', {}))
    category_meta = get_category_meta(lang_games)
    
    for g_type, models in lang_games.items():
        response[g_type] = [
            {
                "blind_id": m["blind_id"],
                "actual_model": m["actual_model"],
                "file": f"/static/{m['file']}",
            }
            for m in models
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
            eval_counts[key].add(row['nickname'])
    elif supabase:
        try:
            # Fetch play counts
            res_plays = supabase.table('game_stats').select('*').execute()
            for row in res_plays.data:
                key = f"{row['game_type']}_{row['actual_model_name']}"
                play_counts[key] = row['plays']
                
            # Fetch unique evaluator counts by nickname
            res_evals = supabase.table('evaluations').select('game_type, actual_model_name, nickname').execute()
            for row in res_evals.data:
                key = f"{row['game_type']}_{row['actual_model_name']}"
                if key not in eval_counts:
                    eval_counts[key] = set()
                eval_counts[key].add(row['nickname'])
        except Exception as e:
            print("DB Fetch Error:", e)
            
    # Enrich the response with stats
    for g_type, models in lang_games.items():
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
async def record_play(data: PlayEvent):
    actual_model = _find_actual_model(data.game_type, data.blind_model_id)
            
    if actual_model:
        if LOCAL_TEST_MODE:
            key = f"{data.game_type}_{actual_model}"
            LOCAL_DB["game_stats"][key] = {
                "game_type": data.game_type,
                "actual_model_name": actual_model,
                "plays": LOCAL_DB["game_stats"].get(key, {}).get("plays", 0) + 1,
            }

            if data.nickname:
                is_valid, _ = validate_nickname(data.nickname)
                if is_valid:
                    _local_upsert_nickname(data.nickname.strip())
                    LOCAL_DB["nickname_views"].append({
                        "id": str(uuid4()),
                        "nickname": data.nickname.strip(),
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

                if data.nickname:
                    is_valid, _ = validate_nickname(data.nickname)
                    if is_valid:
                        supabase.table('nickname_views').insert({
                            "nickname": data.nickname.strip(),
                            "game_type": data.game_type,
                            "actual_model_name": actual_model,
                        }).execute()
            except Exception as e:
                print("Play recording error:", e)
            
    return {"status": "ok"}

@app.post("/api/evaluate")
async def submit_evaluation(eval: Evaluation, request: Request):
    is_valid, error_key = validate_nickname(eval.nickname)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)
    is_valid_comment, comment_error = validate_comment_text(eval.comment)
    if not is_valid_comment:
        raise HTTPException(status_code=400, detail=comment_error)
    
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0] if forwarded else request.client.host
        
    actual_model = _find_actual_model(eval.game_type, eval.blind_model_id, getattr(eval, 'language', 'ko'))
    if not actual_model:
        raise HTTPException(status_code=400, detail="Invalid game type or blind ID")

    nickname_key = eval.nickname.casefold()
    global_history_key = f"global:{nickname_key}"
    model_history_key = f"model:{nickname_key}:{eval.game_type}:{actual_model}"

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
        "nickname": eval.nickname,
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
    }
    
    try:
        if LOCAL_TEST_MODE:
            _local_upsert_nickname(eval.nickname)
            existing = next((
                row for row in LOCAL_DB["evaluations"]
                if row["nickname"] == eval.nickname and row["game_type"] == eval.game_type and row["actual_model_name"] == actual_model
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
            supabase.table('evaluations').upsert(data, on_conflict="nickname,game_type,actual_model_name").execute()
        now_ts = datetime.now(timezone.utc).timestamp()
        COMMENT_SUBMISSION_HISTORY[global_history_key].append(now_ts)
        COMMENT_SUBMISSION_HISTORY[model_history_key].append(now_ts)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user_evals/{nickname}")
async def get_user_evals(nickname: str):
    if LOCAL_TEST_MODE:
        return {
            "evals": [
                {
                    "game_type": row["game_type"],
                    "blind_model_id": row["blind_model_id"],
                    "total_score": row["total_score"],
                    "actual_model_name": row["actual_model_name"],
                }
                for row in LOCAL_DB["evaluations"]
                if row["nickname"] == nickname
            ]
        }
    try:
        res = supabase.table('evaluations').select('game_type, blind_model_id, total_score, actual_model_name').eq('nickname', nickname).execute()
        return {"evals": res.data}
    except Exception as e:
        return {"evals": []}

@app.get("/api/results/{game_type}")
async def get_results(game_type: str, request: Request, nickname: str | None = None):
    admin_info = verify_admin_token(request.headers.get("X-Admin-Token"))
    is_admin = bool(admin_info)

    try:
        if LOCAL_TEST_MODE:
            data = [row for row in LOCAL_DB["evaluations"] if row["game_type"] == game_type]
            eval_ids = {row["id"] for row in data}
            reaction_rows = [row for row in LOCAL_DB["comment_reactions"] if row["evaluation_id"] in eval_ids]
            reply_rows = [row for row in LOCAL_DB["comment_replies"] if row["evaluation_id"] in eval_ids]
            participant_nicknames = {row["nickname"] for row in data} | {row["nickname"] for row in reply_rows}
            user_eval_rows = [row for row in LOCAL_DB["evaluations"] if row["nickname"] in participant_nicknames]
            user_view_rows = [row for row in LOCAL_DB["nickname_views"] if row["nickname"] in participant_nicknames]
            saved_profile_badges = {
                nickname_key: row.get("profile_badge_key")
                for nickname_key, row in LOCAL_DB["nicknames"].items()
                if nickname_key in participant_nicknames
            }
            return _build_results_payload(game_type, data, reaction_rows, reply_rows, nickname, is_admin, user_eval_rows, user_view_rows, saved_profile_badges)

        res = supabase.table('evaluations').select('*').eq('game_type', game_type).execute()
        data = res.data
        reaction_rows = []
        reply_rows = []
        if data:
            eval_ids = [row['id'] for row in data]
            if eval_ids:
                reaction_res = supabase.table('comment_reactions').select('evaluation_id, nickname, reaction_type').in_('evaluation_id', eval_ids).execute()
                reaction_rows = reaction_res.data or []
                reply_res = supabase.table('comment_replies').select('id, evaluation_id, nickname, reply, is_blinded, created_at').in_('evaluation_id', eval_ids).order('created_at', desc=True).execute()
                reply_rows = reply_res.data or []
        
        stats = {}
        blind_mapping = {}
        for lang_dict in GAMES_DATA.values():
            for m in lang_dict.get(game_type, []):
                blind_mapping[m['actual_model']] = m['blind_id']

        participant_nicknames = {row['nickname'] for row in data}
        participant_nicknames.update(reply['nickname'] for reply in reply_rows)

        user_eval_rows = []
        user_view_rows = []
        saved_profile_badges = {}
        if participant_nicknames:
            participant_list = list(participant_nicknames)
            all_eval_res = supabase.table('evaluations').select('nickname, game_type, actual_model_name').in_('nickname', participant_list).execute()
            user_eval_rows = all_eval_res.data or []
            all_view_res = supabase.table('nickname_views').select('nickname, game_type, actual_model_name').in_('nickname', participant_list).execute()
            user_view_rows = all_view_res.data or []
            profile_res = supabase.table('nicknames').select('nickname, profile_badge_key').in_('nickname', participant_list).execute()
            saved_profile_badges = {
                row['nickname']: row.get('profile_badge_key')
                for row in (profile_res.data or [])
            }

        badge_lookup = build_user_badge_lookup(participant_nicknames, user_eval_rows, user_view_rows, GAMES_DATA, saved_profile_badges)

        reaction_map = {}
        for reaction in reaction_rows:
            key = reaction['evaluation_id']
            if key not in reaction_map:
                reaction_map[key] = {
                    "like_count": 0,
                    "dislike_count": 0,
                    "user_reactions": {}
                }
            if reaction['reaction_type'] == 'like':
                reaction_map[key]["like_count"] += 1
            elif reaction['reaction_type'] == 'dislike':
                reaction_map[key]["dislike_count"] += 1
            reaction_map[key]["user_reactions"][reaction['nickname']] = reaction['reaction_type']

        reply_map = {}
        for reply in reply_rows:
            evaluation_id = reply['evaluation_id']
            reply_map.setdefault(evaluation_id, [])
            is_blinded = bool(reply.get('is_blinded'))
            reply_map[evaluation_id].append({
                "id": reply['id'],
                "nickname": reply['nickname'],
                "reply": reply['reply'] if is_admin or not is_blinded else "",
                "created_at": reply.get('created_at'),
                "is_blinded": is_blinded,
                "badge": {
                    "stage_key": badge_lookup.get(reply['nickname'], {}).get('profile_badge_key', 'badge_egg')
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
                reaction_info = reaction_map.get(row['id'], {"like_count": 0, "dislike_count": 0, "user_reactions": {}})
                is_blinded = bool(row.get('is_blinded'))
                stats[m_name]['comments'].append({
                    "id": row['id'],
                    "nickname": row['nickname'],
                    "comment": row['comment'] if is_admin or not is_blinded else "",
                    "is_blinded": is_blinded,
                    "created_at": row.get('created_at'),
                    "like_count": reaction_info["like_count"],
                    "dislike_count": reaction_info["dislike_count"],
                    "user_reaction": reaction_info["user_reactions"].get(nickname) if nickname else None,
                    "badge": {
                        "stage_key": badge_lookup.get(row['nickname'], {}).get('profile_badge_key', 'badge_egg')
                    },
                    "replies": reply_map.get(row['id'], []),
                })
                
        result = []
        for m_name, s in stats.items():
            count = s['count']
            result.append({
                "actual_model_name": m_name,
                "blind_id": blind_mapping.get(m_name, "?"),
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
            
        return _build_results_payload(game_type, data, reaction_rows, reply_rows, nickname, is_admin, user_eval_rows, user_view_rows, saved_profile_badges)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/comment-reaction")
async def toggle_comment_reaction(payload: CommentReactionToggle, request: Request):
    is_valid, error_key = validate_nickname(payload.nickname)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)

    if payload.reaction_type not in ("like", "dislike"):
        raise HTTPException(status_code=400, detail="invalid_reaction_type")

    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0] if forwarded else request.client.host
    allowed, wait_time = check_memory_rate_limit(COMMENT_REACTION_RATE_LIMITS, f"{ip}:{payload.nickname.casefold()}", 30, 20)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"rate_limit_comment_reaction:{wait_time}")

    try:
        if LOCAL_TEST_MODE:
            existing = next((
                row for row in LOCAL_DB["comment_reactions"]
                if row["evaluation_id"] == payload.evaluation_id and row["nickname"] == payload.nickname
            ), None)
        else:
            existing_res = supabase.table('comment_reactions').select('id, reaction_type').eq('evaluation_id', payload.evaluation_id).eq('nickname', payload.nickname).limit(1).execute()
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
                    "nickname": payload.nickname,
                    "reaction_type": payload.reaction_type,
                    "created_at": _now_iso(),
                    "updated_at": _now_iso(),
                })
            else:
                supabase.table('comment_reactions').insert({
                    "evaluation_id": payload.evaluation_id,
                    "nickname": payload.nickname,
                    "reaction_type": payload.reaction_type,
                }).execute()
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
    is_valid, error_key = validate_nickname(payload.nickname)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)

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
            if row["nickname"] == payload.nickname
        ]
    else:
        reply_limit_res = supabase.table('comment_replies').select('created_at, updated_at').eq('nickname', payload.nickname).execute()
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
            _local_upsert_nickname(payload.nickname)
            LOCAL_DB["comment_replies"].append({
                "id": str(uuid4()),
                "evaluation_id": payload.evaluation_id,
                "nickname": payload.nickname,
                "reply": payload.reply,
                "is_blinded": False,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
            })
        else:
            supabase.table('comment_replies').insert({
                "evaluation_id": payload.evaluation_id,
                "nickname": payload.nickname,
                "reply": payload.reply,
            }).execute()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/blind")
async def admin_toggle_blind(payload: AdminBlindToggle, request: Request):
    admin_info = verify_admin_token(request.headers.get("X-Admin-Token"))
    if not admin_info:
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


@app.get("/api/mypage/{nickname}")
async def get_mypage(nickname: str):
    is_valid, error_key = validate_nickname(nickname)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)

    if LOCAL_TEST_MODE:
        saved_profile_badge_key = LOCAL_DB["nicknames"].get(nickname, {}).get("profile_badge_key")
        return summarize_mypage_data(
            nickname,
            _local_get_eval_rows_for_nickname(nickname),
            _local_get_view_rows_for_nickname(nickname),
            GAMES_DATA,
            saved_profile_badge_key,
        )

    try:
        eval_res = supabase.table('evaluations').select('game_type, actual_model_name').eq('nickname', nickname).execute()
        view_res = supabase.table('nickname_views').select('game_type, actual_model_name').eq('nickname', nickname).execute()
        profile_res = supabase.table('nicknames').select('profile_badge_key').eq('nickname', nickname).limit(1).execute()
        saved_profile_badge_key = profile_res.data[0].get('profile_badge_key') if profile_res.data else None
        return summarize_mypage_data(nickname, eval_res.data or [], view_res.data or [], GAMES_DATA, saved_profile_badge_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mypage/profile-badge")
async def update_profile_badge(payload: ProfileBadgeUpdate):
    is_valid, error_key = validate_nickname(payload.nickname)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_key)

    try:
        if LOCAL_TEST_MODE:
            _local_upsert_nickname(payload.nickname)
            eval_rows = _local_get_eval_rows_for_nickname(payload.nickname)
            view_rows = _local_get_view_rows_for_nickname(payload.nickname)
            unlocked_badge_keys = get_unlocked_badge_keys(eval_rows, view_rows, GAMES_DATA)
        else:
            eval_res = supabase.table('evaluations').select('game_type, actual_model_name').eq('nickname', payload.nickname).execute()
            view_res = supabase.table('nickname_views').select('game_type, actual_model_name').eq('nickname', payload.nickname).execute()
            unlocked_badge_keys = get_unlocked_badge_keys(eval_res.data or [], view_res.data or [], GAMES_DATA)
        if payload.badge_key not in unlocked_badge_keys:
            raise HTTPException(status_code=400, detail="profile_badge_locked")

        resolved_badge_key = resolve_profile_badge_key(payload.badge_key, unlocked_badge_keys)
        if LOCAL_TEST_MODE:
            LOCAL_DB["nicknames"][payload.nickname]["profile_badge_key"] = resolved_badge_key
            LOCAL_DB["nicknames"][payload.nickname]["last_active_at"] = _now_iso()
        else:
            supabase.table('nicknames').update({
                "profile_badge_key": resolved_badge_key,
                "last_active_at": datetime.now(timezone.utc).isoformat(),
            }).eq('nickname', payload.nickname).execute()
        return {"status": "success", "profile_badge_key": resolved_badge_key}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
