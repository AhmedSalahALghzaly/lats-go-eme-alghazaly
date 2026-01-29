"""
Distributor Routes
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.security import get_current_user, get_user_role, serialize_doc
from ....models.schemas import DistributorCreate
from ....services.websocket import manager

router = APIRouter(prefix="/distributors")

@router.get("")
async def get_distributors(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin", "subscriber"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    distributors = await db.distributors.find({"deleted_at": None}).to_list(1000)
    return [serialize_doc(d) for d in distributors]

@router.get("/{distributor_id}")
async def get_distributor(distributor_id: str, request: Request):
    distributor = await db.distributors.find_one({"_id": distributor_id})
    if not distributor:
        raise HTTPException(status_code=404, detail="Distributor not found")
    return serialize_doc(distributor)

@router.post("")
async def create_distributor(data: DistributorCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    distributor = {
        "_id": str(uuid.uuid4()),
        **data.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.distributors.insert_one(distributor)
    
    if data.linked_car_brand_ids:
        await db.car_brands.update_many(
            {"_id": {"$in": data.linked_car_brand_ids}},
            {"$set": {"distributor_id": distributor["_id"]}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["distributors", "car_brands"]})
    return serialize_doc(distributor)

@router.put("/{distributor_id}")
async def update_distributor(distributor_id: str, data: DistributorCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.car_brands.update_many({"distributor_id": distributor_id}, {"$set": {"distributor_id": None}})
    await db.distributors.update_one(
        {"_id": distributor_id},
        {"$set": {**data.dict(), "updated_at": datetime.now(timezone.utc)}}
    )
    
    if data.linked_car_brand_ids:
        await db.car_brands.update_many(
            {"_id": {"$in": data.linked_car_brand_ids}},
            {"$set": {"distributor_id": distributor_id}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["distributors", "car_brands"]})
    
    # Return the updated distributor with all fields
    updated_distributor = await db.distributors.find_one({"_id": distributor_id})
    return serialize_doc(updated_distributor) if updated_distributor else {"message": "Updated"}

@router.delete("/{distributor_id}")
async def delete_distributor(distributor_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.car_brands.update_many({"distributor_id": distributor_id}, {"$set": {"distributor_id": None}})
    await db.distributors.update_one({"_id": distributor_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["distributors", "car_brands"]})
    return {"message": "Deleted"}
