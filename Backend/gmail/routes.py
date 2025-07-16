from fastapi import APIRouter, HTTPException, Query
from supabase import create_client, Client
from dotenv import load_dotenv
import os
import requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timedelta
from gmail.utils import refresh_google_token, is_token_expired

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Supabase credentials are not set in environment variables.")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

router = APIRouter(prefix="/attachments", tags=["attachments"])

@router.post("/process/")
def process_attachments(
    user_email: str = Query(...),
    file_type: str = Query(...),
    date_from: str = Query(...),  # format: YYYY-MM-DD
    file_name_filter: str = Query(None)
):
    # 1. Fetch user tokens and preferences from Supabase
    user_resp = supabase.table("users").select("*").eq("email", user_email).single().execute()
    user = user_resp.data
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = user.get("access_token")
    refresh_token = user.get("refresh_token")
    token_expires_at = user.get("token_expires_at")
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    # 2. Refresh token if expired
    if not access_token or not token_expires_at or is_token_expired(token_expires_at):
        if not refresh_token:
            raise HTTPException(status_code=400, detail="No refresh token available for user.")
        tokens = refresh_google_token(refresh_token)
        access_token = tokens["access_token"]
        new_expires_at = datetime.utcnow() + timedelta(seconds=tokens["expires_in"])
        supabase.table("users").update({
            "access_token": access_token,
            "token_expires_at": new_expires_at.isoformat()
        }).eq("email", user_email).execute()

    # 3. Build Gmail and Drive clients
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=[
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/drive.file"
        ]
    )
    gmail = build("gmail", "v1", credentials=creds)
    drive = build("drive", "v3", credentials=creds)

    # 3.5. Create a folder in Drive for this session
    folder_name = f"Gmail Attachments - {datetime.utcnow().date()} - {file_type}"
    folder_metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder"
    }
    folder = drive.files().create(
        body=folder_metadata,
        fields="id"
    ).execute()
    folder_id = folder.get("id")

    # 4. Search for emails with attachments
    query = f"has:attachment after:{date_from.replace('-', '/')}"
    if file_name_filter:
        query += f" {file_name_filter}"
    gmail_folder = user.get("gmail_folder")
    if gmail_folder:
        query += f" label:{gmail_folder}"
    results = gmail.users().messages().list(userId="me", q=query).execute()
    messages = results.get("messages", [])

    download_results = []
    for msg in messages:
        msg_id = msg["id"]
        msg_data = gmail.users().messages().get(userId="me", id=msg_id).execute()
        payload = msg_data.get("payload", {})
        parts = payload.get("parts", [])
        for part in parts:
            filename = part.get("filename")
            if not filename or not filename.lower().endswith(file_type.lower()):
                continue
            body = part.get("body", {})
            attachment_id = body.get("attachmentId")
            if not attachment_id:
                continue
            try:
                attachment = gmail.users().messages().attachments().get(
                    userId="me", messageId=msg_id, id=attachment_id
                ).execute()
                data = attachment.get("data")
                if not data:
                    raise Exception("No data in attachment")
                import base64
                file_bytes = base64.urlsafe_b64decode(data.encode("UTF-8"))

                if not file_bytes or len(file_bytes) == 0:
                    raise Exception(f"Attachment {filename} is empty or could not be decoded.")

                # 5. Upload to Google Drive
                from googleapiclient.http import MediaIoBaseUpload
                import io
                media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype="application/octet-stream")
                file_metadata = {
                    "name": filename,
                    "parents": [folder_id]
                }
                drive_file = drive.files().create(
                    body=file_metadata,
                    media_body=media,
                    fields="id,webViewLink"
                ).execute()
                if not drive_file.get("id"):
                    raise Exception(f"Failed to upload {filename} to Google Drive.")

                # 6. Log to Supabase
                supabase.table("logs").insert({
                    "user_email": user_email,
                    "file_name": filename,
                    "file_type": file_type,
                    "status": "success",
                    "drive_file_id": drive_file["id"],
                    "drive_link": drive_file["webViewLink"],
                    "created_at": datetime.utcnow().isoformat()
                }).execute()

                download_results.append({
                    "filename": filename,
                    "driveLink": drive_file["webViewLink"],
                    "status": "success"
                })
            except Exception as e:
                # Log failure
                supabase.table("logs").insert({
                    "user_email": user_email,
                    "file_name": filename,
                    "file_type": file_type,
                    "status": "failed",
                    "created_at": datetime.utcnow().isoformat(),
                    "error": str(e)
                }).execute()
                download_results.append({
                    "filename": filename,
                    "status": "failed",
                    "error": str(e)
                })

    return {
        "success": True,
        "downloaded": sum(1 for r in download_results if r["status"] == "success"),
        "failed": sum(1 for r in download_results if r["status"] == "failed"),
        "results": download_results
    }
