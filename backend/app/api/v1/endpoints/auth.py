"""
Authentication Routes
"""
from fastapi import APIRouter, HTTPException, Response, Request
from datetime import datetime, timezone, timedelta
import httpx
import uuid

from ....core.database import db
from ....core.security import get_current_user, get_user_role, get_session_token, serialize_doc
from ....services.notification import notify_admins_new_user

router = APIRouter(prefix="/auth")

@router.post("/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client_http:
        try:
            auth_response = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            user_data = auth_response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail="Authentication service error")
    
    user = await db.users.find_one({"email": user_data["email"]})
    is_new_user = False
    if not user:
        is_new_user = True
        user = {
            "_id": str(uuid.uuid4()),
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "is_admin": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)
        
        # Notify admins about new user registration
        await notify_admins_new_user(
            user_email=user_data["email"],
            user_name=user_data.get("name")
        )
    
    session = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "session_token": user_data["session_token"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    }
    await db.sessions.insert_one(session)
    
    user_serialized = serialize_doc(user)
    role = await get_user_role(user_serialized)
    user_serialized["role"] = role
    
    response.set_cookie(
        key="session_token",
        value=session["session_token"],
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    return {"user": user_serialized, "session_token": session["session_token"]}

@router.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user["role"] = await get_user_role(user)
    return user

@router.post("/logout")
async def logout(request: Request, response: Response):
    token = await get_session_token(request)
    if token:
        await db.sessions.delete_one({"session_token": token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}
