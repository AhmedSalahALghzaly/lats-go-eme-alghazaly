"""
Collections Routes
Separate endpoint for /collections to match frontend API calls
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional

from ....core.database import db
from ....core.security import get_current_user, get_user_role, serialize_doc

router = APIRouter(prefix="/collections")

@router.get("")
async def get_collections(request: Request, admin_id: Optional[str] = None):
    """Get all settled products (collections)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {"settled": True}
    if admin_id:
        query["added_by_admin_id"] = admin_id
    
    products = await db.products.find(query).to_list(10000)
    admins = await db.admins.find({}).to_list(1000)
    admin_map = {a["_id"]: serialize_doc(a) for a in admins}
    
    result = []
    for p in products:
        p_data = serialize_doc(p)
        p_data["admin"] = admin_map.get(p.get("added_by_admin_id"))
        result.append(p_data)
    
    return result

@router.get("/{collection_id}")
async def get_collection(collection_id: str, request: Request):
    """Get a single collection (settled product) by ID"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    product = await db.products.find_one({"_id": collection_id, "settled": True})
    if not product:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    p_data = serialize_doc(product)
    admin = await db.admins.find_one({"_id": product.get("added_by_admin_id")})
    if admin:
        p_data["admin"] = serialize_doc(admin)
    
    return p_data
