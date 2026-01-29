"""
Comments Routes
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.security import get_current_user, serialize_doc
from ....models.schemas import CommentCreate

router = APIRouter()

@router.get("/products/{product_id}/comments")
async def get_comments(product_id: str, request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request)
    user_id = user["id"] if user else None
    
    comments = await db.comments.find({"product_id": product_id, "deleted_at": None}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    pipeline = [
        {"$match": {"product_id": product_id, "deleted_at": None, "rating": {"$ne": None}}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "avg": {"$avg": "$rating"}}}
    ]
    stats = await db.comments.aggregate(pipeline).to_list(1)
    avg_rating = round(stats[0]["avg"], 1) if stats and stats[0].get("avg") else None
    rating_count = stats[0]["count"] if stats else 0
    
    return {
        "comments": [{**serialize_doc(c), "is_owner": c.get("user_id") == user_id} for c in comments],
        "total": len(comments),
        "avg_rating": avg_rating,
        "rating_count": rating_count
    }

@router.post("/products/{product_id}/comments")
async def add_comment(product_id: str, data: CommentCreate, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if data.rating and (data.rating < 1 or data.rating > 5):
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    
    comment = {
        "_id": str(uuid.uuid4()),
        "product_id": product_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "user_picture": user.get("picture"),
        "text": data.text,
        "rating": data.rating,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None
    }
    await db.comments.insert_one(comment)
    return {**serialize_doc(comment), "is_owner": True}
