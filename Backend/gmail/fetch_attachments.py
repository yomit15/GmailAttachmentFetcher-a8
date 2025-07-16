import requests

def get_gmail_attachments(access_token: str):
    # Example: List messages with attachments in the user's inbox
    headers = {"Authorization": f"Bearer {access_token}"}
    messages_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=has:attachment"
    messages_resp = requests.get(messages_url, headers=headers)
    messages_resp.raise_for_status()
    messages = messages_resp.json().get("messages", [])

    attachments = []
    for msg in messages[:5]:  # Limit for demo
        msg_id = msg["id"]
        msg_url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}"
        msg_resp = requests.get(msg_url, headers=headers)
        msg_resp.raise_for_status()
        payload = msg_resp.json().get("payload", {})
        parts = payload.get("parts", [])
        for part in parts:
            if part.get("filename") and part.get("body", {}).get("attachmentId"):
                attachments.append({
                    "filename": part["filename"],
                    "attachmentId": part["body"]["attachmentId"],
                    "messageId": msg_id
                })
    return attachments
