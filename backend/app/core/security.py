"""
Security and Authentication Helpers
"""
from fastapi import Request
from datetime import datetime, timezone
from .config import PRIMARY_OWNER_EMAIL
from .database import get_database

def get_db():
    return get_database()

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    doc = dict(doc)
    if '_id' in doc:
        doc['id'] = str(doc['_id'])
        del doc['_id']
    return doc

async def get_session_token(request: Request):
    """Extract session token from cookie or Authorization header"""
    token = request.cookies.get("session_token")
    if token:
        return token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None

async def get_current_user(request: Request):
    """Get current authenticated user from session"""
    db = get_db()
    token = await get_session_token(request)
    if not token:
        return None
    session = await db.sessions.find_one({"session_token": token})
    if not session:
        return None
    # Handle both timezone-aware and naive datetimes
    if session.get("expires_at"):
        expires_at = session["expires_at"]
        now = datetime.now(timezone.utc)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= now:
            return None
    user = await db.users.find_one({"_id": session["user_id"]})
    return serialize_doc(user) if user else None

async def get_user_role(user):
    """Determine user role: owner, partner, admin, subscriber, or user"""
    db = get_db()
    if not user:
        return "guest"
    
    email = user.get("email", "")
    
    # Check if primary owner
    if email == PRIMARY_OWNER_EMAIL:
        return "owner"
    
    # Check if partner
    partner = await db.partners.find_one({"email": email, "deleted_at": None})
    if partner:
        return "partner"
    
    # Check if admin
    admin = await db.admins.find_one({"email": email, "deleted_at": None})
    if admin:
        return "admin"
    
    # Check if subscriber
    subscriber = await db.subscribers.find_one({"email": email, "deleted_at": None})
    if subscriber:
        return "subscriber"
    
    return "user"
