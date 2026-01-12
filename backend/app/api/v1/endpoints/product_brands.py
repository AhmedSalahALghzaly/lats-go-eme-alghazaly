"""
Product Brand Routes
"""
from fastapi import APIRouter
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.security import serialize_doc
from ....models.schemas import ProductBrandCreate
from ....services.websocket import manager

router = APIRouter(prefix="/product-brands")

@router.get("")
async def get_product_brands():
    brands = await db.product_brands.find({"deleted_at": None}).sort("name", 1).to_list(1000)
    result = []
    for b in brands:
        b_data = serialize_doc(b)
        if b.get("supplier_id"):
            supplier = await db.suppliers.find_one({"_id": b["supplier_id"]})
            b_data["supplier"] = serialize_doc(supplier) if supplier else None
        result.append(b_data)
    return result

@router.post("")
async def create_product_brand(brand: ProductBrandCreate):
    doc = {
        "_id": f"pb_{uuid.uuid4().hex[:8]}",
        **brand.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None
    }
    await db.product_brands.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["product_brands"]})
    return serialize_doc(doc)

@router.put("/{brand_id}")
async def update_product_brand(brand_id: str, brand: ProductBrandCreate):
    await db.product_brands.update_one(
        {"_id": brand_id},
        {"$set": {**brand.dict(), "updated_at": datetime.now(timezone.utc)}}
    )
    updated = await db.product_brands.find_one({"_id": brand_id})
    await manager.broadcast({"type": "sync", "tables": ["product_brands"]})
    return serialize_doc(updated)

@router.delete("/{brand_id}")
async def delete_product_brand(brand_id: str):
    await db.product_brands.update_one(
        {"_id": brand_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}}
    )
    await manager.broadcast({"type": "sync", "tables": ["product_brands"]})
    return {"message": "Deleted"}
