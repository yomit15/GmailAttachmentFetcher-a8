from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth.oauth_handler import router as auth_router
from gmail.routes import router as attachments_router
from app.routes import router as app_router

app = FastAPI()

app.include_router(auth_router)
app.include_router(attachments_router)
app.include_router(app_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, set this to your frontend's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
