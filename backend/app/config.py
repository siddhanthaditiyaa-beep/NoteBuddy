import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
SENTRY_DSN = os.getenv("SENTRY_DSN", "")

# --- Phase 0 hardening knobs (all optional, sane defaults) -----------------
MAX_UPLOAD_MB = float(os.getenv("MAX_UPLOAD_MB", "15"))
MAX_AUDIO_MB = float(os.getenv("MAX_AUDIO_MB", "20"))
DAILY_GENERATION_LIMIT = int(os.getenv("DAILY_GENERATION_LIMIT", "5"))
