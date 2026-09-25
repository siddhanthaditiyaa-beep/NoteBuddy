from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import FRONTEND_ORIGIN
from app.routers import notes, chat, user, demo, review

app = FastAPI(title="NoteBuddy API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notes.router)
app.include_router(chat.router)
app.include_router(user.router)
app.include_router(demo.router)
app.include_router(review.router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "NoteBuddy API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
