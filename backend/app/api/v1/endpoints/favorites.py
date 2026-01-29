"""
Favorites Routes
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.security import get_current_user, serialize_doc
from ....models.schemas import FavoriteAdd

router = APIRouter(prefix="/favorites")

@router.get("")
async def get_favorites(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    favs = await db.favorites.find({"user_id": user["id"], "deleted_at": None}).to_list(1000)
    result = []
    for f in favs:
        product = await db.products.find_one({"_id": f["product_id"]})
        if product:
            result.append({**serialize_doc(f), "product": serialize_doc(product)})
    return {"favorites": result, "total": len(result)}

@router.get("/check/{product_id}")
async def check_favorite(product_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    fav = await db.favorites.find_one({"user_id": user["id"], "product_id": product_id, "deleted_at": None})
    return {"is_favorite": fav is not None}

@router.post("/toggle")
async def toggle_favorite(data: FavoriteAdd, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    existing = await db.favorites.find_one({"user_id": user["id"], "product_id": data.product_id})
    if existing:
        if existing.get("deleted_at"):
            await db.favorites.update_one(
                {"_id": existing["_id"]},
                {"$set": {"deleted_at": None, "updated_at": datetime.now(timezone.utc)}}
            )
            return {"is_favorite": True}
        else:
            await db.favorites.update_one(
                {"_id": existing["_id"]},
                {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}}
            )
            return {"is_favorite": False}
    else:
        await db.favorites.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": user["id"],
            "product_id": data.product_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        })
        return {"is_favorite": True}
