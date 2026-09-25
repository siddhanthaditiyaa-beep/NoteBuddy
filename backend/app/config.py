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

# --- Web Push (due-flashcard reminders) -------------------------------------
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_CLAIM_EMAIL = os.getenv("VAPID_CLAIM_EMAIL", "notebuddy@example.com")
# Shared secret the daily GitHub Actions cron sends — not a real user, so it
# can't use the normal JWT auth; this is the only thing guarding the send
# endpoint from being triggered by anyone who finds the URL.
PUSH_CRON_SECRET = os.getenv("PUSH_CRON_SECRET", "")
