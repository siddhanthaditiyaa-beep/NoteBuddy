from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.config import FRONTEND_ORIGIN, SENTRY_DSN
from app.rate_limit import limiter
from app.routers import notes, chat, user, demo, review, planner, push, practice, coach, organizer

# --- Error tracking (Sentry free tier — no-op if SENTRY_DSN isn't set) -----
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.1, send_default_pii=False)

app = FastAPI(title="NoteBuddy API", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Scoped to exactly what the frontend actually sends — no wildcard methods
# or headers, and Authorization is now required for every protected route.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(notes.router)
app.include_router(chat.router)
app.include_router(user.router)
app.include_router(demo.router)
app.include_router(review.router)
app.include_router(planner.router)
app.include_router(push.router)
app.include_router(practice.router)
app.include_router(coach.router)
app.include_router(organizer.router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "NoteBuddy API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
