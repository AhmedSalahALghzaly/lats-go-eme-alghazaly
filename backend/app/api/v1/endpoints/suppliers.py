"""
Supplier Routes
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.security import get_current_user, get_user_role, serialize_doc
from ....models.schemas import SupplierCreate
from ....services.websocket import manager

router = APIRouter(prefix="/suppliers")

@router.get("")
async def get_suppliers(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin", "subscriber"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    suppliers = await db.suppliers.find({"deleted_at": None}).to_list(1000)
    return [serialize_doc(s) for s in suppliers]

@router.get("/{supplier_id}")
async def get_supplier(supplier_id: str, request: Request):
    supplier = await db.suppliers.find_one({"_id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return serialize_doc(supplier)

@router.post("")
async def create_supplier(data: SupplierCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    supplier = {
        "_id": str(uuid.uuid4()),
        **data.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.suppliers.insert_one(supplier)
    
    if data.linked_product_brand_ids:
        await db.product_brands.update_many(
            {"_id": {"$in": data.linked_product_brand_ids}},
            {"$set": {"supplier_id": supplier["_id"]}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["suppliers", "product_brands"]})
    return serialize_doc(supplier)

@router.put("/{supplier_id}")
async def update_supplier(supplier_id: str, data: SupplierCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.product_brands.update_many({"supplier_id": supplier_id}, {"$set": {"supplier_id": None}})
    await db.suppliers.update_one(
        {"_id": supplier_id},
        {"$set": {**data.dict(), "updated_at": datetime.now(timezone.utc)}}
    )
    
    if data.linked_product_brand_ids:
        await db.product_brands.update_many(
            {"_id": {"$in": data.linked_product_brand_ids}},
            {"$set": {"supplier_id": supplier_id}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["suppliers", "product_brands"]})
    
    # Return the updated supplier with all fields
    updated_supplier = await db.suppliers.find_one({"_id": supplier_id})
    return serialize_doc(updated_supplier) if updated_supplier else {"message": "Updated"}

@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.product_brands.update_many({"supplier_id": supplier_id}, {"$set": {"supplier_id": None}})
    await db.suppliers.update_one({"_id": supplier_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["suppliers", "product_brands"]})
    return {"message": "Deleted"}
