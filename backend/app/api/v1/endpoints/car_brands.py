"""
Car Brand Routes
"""
from fastapi import APIRouter
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.security import serialize_doc
from ....models.schemas import CarBrandCreate
from ....services.websocket import manager

router = APIRouter(prefix="/car-brands")

@router.get("")
async def get_car_brands():
    brands = await db.car_brands.find({"deleted_at": None}).sort("name", 1).to_list(1000)
    result = []
    for b in brands:
        b_data = serialize_doc(b)
        if b.get("distributor_id"):
            distributor = await db.distributors.find_one({"_id": b["distributor_id"]})
            b_data["distributor"] = serialize_doc(distributor) if distributor else None
        result.append(b_data)
    return result

@router.post("")
async def create_car_brand(brand: CarBrandCreate):
    doc = {
        "_id": f"cb_{uuid.uuid4().hex[:8]}",
        **brand.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None
    }
    await db.car_brands.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["car_brands"]})
    return serialize_doc(doc)

@router.put("/{brand_id}")
async def update_car_brand(brand_id: str, brand: CarBrandCreate):
    """Update an existing car brand"""
    existing = await db.car_brands.find_one({"_id": brand_id, "deleted_at": None})
    if not existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Car brand not found")
    
    update_data = {
        **brand.dict(exclude_unset=True),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.car_brands.update_one(
        {"_id": brand_id},
        {"$set": update_data}
    )
    
    updated = await db.car_brands.find_one({"_id": brand_id})
    await manager.broadcast({"type": "sync", "tables": ["car_brands"]})
    return serialize_doc(updated)

@router.delete("/{brand_id}")
async def delete_car_brand(brand_id: str):
    await db.car_brands.update_one(
        {"_id": brand_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}}
    )
    await manager.broadcast({"type": "sync", "tables": ["car_brands"]})
    return {"message": "Deleted"}
