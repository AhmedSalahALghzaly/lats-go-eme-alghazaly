"""
Car Model Routes
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.security import serialize_doc
from ....models.schemas import CarModelCreate
from ....services.websocket import manager

router = APIRouter(prefix="/car-models")

@router.get("")
async def get_car_models(brand_id: Optional[str] = None, search: Optional[str] = None):
    """Get all car models, optionally filtered by brand_id or search query (name/chassis_number)"""
    query = {"deleted_at": None}
    if brand_id:
        query["brand_id"] = brand_id
    
    # If search is provided, search by name, name_ar, or chassis_number
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"name": search_regex},
            {"name_ar": search_regex},
            {"chassis_number": search_regex}
        ]
    
    models = await db.car_models.find(query).sort("name", 1).to_list(1000)
    return [serialize_doc(m) for m in models]

@router.get("/search-by-chassis")
async def search_by_chassis(chassis: str):
    """Search car models by chassis number (VIN)"""
    if not chassis or len(chassis) < 3:
        raise HTTPException(status_code=400, detail="Chassis number must be at least 3 characters")
    
    query = {
        "deleted_at": None,
        "chassis_number": {"$regex": chassis, "$options": "i"}
    }
    models = await db.car_models.find(query).sort("name", 1).to_list(100)
    return [serialize_doc(m) for m in models]

@router.get("/{model_id}")
async def get_car_model(model_id: str):
    model = await db.car_models.find_one({"_id": model_id})
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    model_data = serialize_doc(model)
    brand_id = model.get("brand_id") or model.get("car_brand_id")
    if brand_id:
        brand = await db.car_brands.find_one({"_id": brand_id})
        model_data["brand"] = serialize_doc(brand) if brand else None
        
        # Fetch distributor linked to this car brand
        if brand and brand.get("distributor_id"):
            distributor = await db.distributors.find_one({
                "_id": brand["distributor_id"], 
                "deleted_at": None
            })
            if distributor:
                model_data["distributor"] = serialize_doc(distributor)
    
    products = await db.products.find({
        "$or": [
            {"car_model_ids": model_id},
            {"compatible_car_models": model_id}
        ],
        "deleted_at": None
    }).to_list(100)
    model_data["compatible_products"] = [serialize_doc(p) for p in products]
    model_data["compatible_products_count"] = len(products)
    return model_data

@router.post("")
async def create_car_model(model: CarModelCreate):
    doc = {
        "_id": f"cm_{uuid.uuid4().hex[:8]}",
        **model.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None
    }
    await db.car_models.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return serialize_doc(doc)

@router.put("/{model_id}")
async def update_car_model(model_id: str, model: CarModelCreate):
    await db.car_models.update_one(
        {"_id": model_id},
        {"$set": {**model.dict(), "updated_at": datetime.now(timezone.utc)}}
    )
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return {"message": "Updated"}

@router.delete("/{model_id}")
async def delete_car_model(model_id: str):
    await db.car_models.update_one(
        {"_id": model_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}}
    )
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return {"message": "Deleted"}
