import requests
from datetime import datetime, timedelta
import os

def refresh_google_token(refresh_token: str) -> dict:
    """
    Refreshes the Google OAuth access token using the refresh token.
    Returns the new token dict (with access_token, expires_in, etc.)
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    resp = requests.post(token_url, data=data)
    resp.raise_for_status()
    return resp.json()

def is_token_expired(token_expires_at: str) -> bool:
    """
    Checks if the token is expired (token_expires_at is ISO string).
    """
    if not token_expires_at:
        return True
    return datetime.fromisoformat(token_expires_at) <= datetime.utcnow()
