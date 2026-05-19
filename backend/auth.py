import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException, Request

load_dotenv(Path(__file__).resolve().parent / ".env")


class FirebaseAuthConfigurationError(RuntimeError):
    pass


def _normalize_private_key(private_key: str) -> str:
    return private_key.replace("\\n", "\n")


@lru_cache(maxsize=1)
def get_firebase_app():
    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError as exc:
        raise FirebaseAuthConfigurationError(
            "firebase-admin is not installed. Run `pip install -r backend/requirements.txt`."
        ) from exc

    if firebase_admin._apps:
        return firebase_admin.get_app()

    project_id = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL", "").strip()
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY", "").strip()

    if project_id and client_email and private_key:
        cred = credentials.Certificate(
            {
                "type": "service_account",
                "project_id": project_id,
                "client_email": client_email,
                "private_key": _normalize_private_key(private_key),
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )
        return firebase_admin.initialize_app(cred, {"projectId": project_id})

    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        options = {"projectId": project_id} if project_id else None
        return firebase_admin.initialize_app(credentials.ApplicationDefault(), options)

    raise FirebaseAuthConfigurationError(
        "Firebase Admin credentials are missing. Set FIREBASE_PROJECT_ID, "
        "FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    )


def get_public_firebase_config():
    keys = {
        "apiKey": os.environ.get("FIREBASE_WEB_API_KEY", "").strip(),
        "authDomain": os.environ.get("FIREBASE_AUTH_DOMAIN", "").strip(),
        "projectId": os.environ.get("FIREBASE_PROJECT_ID", "").strip(),
        "appId": os.environ.get("FIREBASE_APP_ID", "").strip(),
        "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", "").strip(),
        "messagingSenderId": os.environ.get("FIREBASE_MESSAGING_SENDER_ID", "").strip(),
        "measurementId": os.environ.get("FIREBASE_MEASUREMENT_ID", "").strip(),
    }
    required_keys = ("apiKey", "authDomain", "projectId", "appId")
    missing = [key for key in required_keys if not keys[key]]
    return {
        **keys,
        "configured": not missing,
        "missing": missing,
    }


def get_super_admin_uids() -> set[str]:
    raw = os.environ.get("SUPER_ADMIN_FIREBASE_UIDS", "")
    return {uid.strip() for uid in raw.split(",") if uid.strip()}


def extract_bearer_token(request: Request) -> str:
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Missing Firebase ID token")
    return token.strip()


def verify_firebase_id_token(token: str):
    try:
        from firebase_admin import auth as firebase_auth

        get_firebase_app()
        return firebase_auth.verify_id_token(token)
    except FirebaseAuthConfigurationError:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Firebase ID token") from exc


def require_firebase_user(request: Request):
    try:
        return verify_firebase_id_token(extract_bearer_token(request))
    except FirebaseAuthConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
