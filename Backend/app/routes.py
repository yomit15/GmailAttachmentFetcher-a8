from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv
import os
import requests

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Supabase credentials are not set in environment variables.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

router = APIRouter()

@router.get("/logs/")
def get_logs(user_email: str = Query(..., description="User email")):
    try:
        response = supabase.table("logs").select("*").eq("user_email", user_email).order("created_at", desc=True).limit(50).execute()
        return {"logs": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users/")
def get_users():
    try:
        response = supabase.table("users").select("*").execute()
        return {"users": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/preferences/")
def get_preferences(user_email: str = Query(..., description="User email")):
    try:
        response = supabase.table("users").select("file_type, file_name_filter, date_from, gmail_folder, created_at, updated_at").eq("email", user_email).single().execute()
        return {"preferences": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/preferences/")
def set_preferences(user_email: str = Query(..., description="User email"), preferences: dict = Body(...)):
    try:
        update_data = {**preferences, "updated_at": str(__import__('datetime').datetime.utcnow())}
        response = supabase.table("users").update(update_data).eq("email", user_email).execute()
        return {"message": "Preferences updated", "user_email": user_email, "preferences": preferences}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/token/refresh/")
def refresh_token(user_email: str = Query(..., description="User email")):
    try:
        # Get refresh token from Supabase
        user_resp = supabase.table("users").select("refresh_token").eq("email", user_email).single().execute()
        refresh_token = user_resp.data.get("refresh_token")
        if not refresh_token:
            raise HTTPException(status_code=400, detail="No refresh token found for user.")
        # Refresh token with Google
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
        resp = requests.post(token_url, data=data)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to refresh token with Google.")
        tokens = resp.json()
        # Update tokens in Supabase
        new_data = {
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token", refresh_token),
            "token_expires_at": str(__import__('datetime').datetime.utcnow() + __import__('datetime').timedelta(seconds=tokens["expires_in"]))
        }
        supabase.table("users").update(new_data).eq("email", user_email).execute()
        return {"access_token": tokens["access_token"], "expires_in": tokens["expires_in"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))