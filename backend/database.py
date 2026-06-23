import os
from pathlib import Path
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / ".env.local", override=True)

url: str = os.environ.get("SUPABASE_URL", "")
key: str = (
    os.environ.get("SUPABASE_SECRET_KEY", "")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    or os.environ.get("SUPABASE_KEY", "")
)

supabase: Optional[Client] = create_client(url, key) if url and key else None
