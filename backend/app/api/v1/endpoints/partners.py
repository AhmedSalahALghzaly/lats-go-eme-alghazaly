"""
Partner Routes
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.config import PRIMARY_OWNER_EMAIL
from ....core.security import get_current_user, get_user_role, serialize_doc
from ....models.schemas import PartnerCreate
from ....services.websocket import manager

router = APIRouter(prefix="/partners")

@router.get("")
async def get_partners(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    partners = await db.partners.find({"deleted_at": None}).to_list(1000)
    owner_info = {"id": "owner", "email": PRIMARY_OWNER_EMAIL, "name": "Primary Owner", "is_owner": True}
    return [owner_info] + [serialize_doc(p) for p in partners]

@router.post("")
async def add_partner(data: PartnerCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can add partners")
    
    existing = await db.partners.find_one({"email": data.email, "deleted_at": None})
    if existing:
        raise HTTPException(status_code=400, detail="Partner already exists")
    
    partner = {
        "_id": str(uuid.uuid4()),
        "email": data.email,
        "name": data.email.split("@")[0],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.partners.insert_one(partner)
    await manager.broadcast({"type": "sync", "tables": ["partners"]})
    return serialize_doc(partner)

@router.delete("/{partner_id}")
async def delete_partner(partner_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can delete partners")
    
    await db.partners.update_one({"_id": partner_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["partners"]})
    return {"message": "Deleted"}
