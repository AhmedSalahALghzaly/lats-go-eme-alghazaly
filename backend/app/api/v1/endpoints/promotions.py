"""
Promotion Routes
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

from ....core.database import db
from ....core.security import get_current_user, get_user_role, serialize_doc
from ....models.schemas import PromotionCreate
from ....services.websocket import manager
from ....services.notification import create_promotional_notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/promotions")

@router.get("")
async def get_promotions(promotion_type: Optional[str] = None, active_only: bool = True):
    query = {"deleted_at": None}
    if promotion_type:
        query["promotion_type"] = promotion_type
    if active_only:
        query["is_active"] = True
    promotions = await db.promotions.find(query).sort("sort_order", 1).to_list(100)
    return [serialize_doc(p) for p in promotions]

@router.get("/{promotion_id}")
async def get_promotion(promotion_id: str):
    promotion = await db.promotions.find_one({"_id": promotion_id})
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return serialize_doc(promotion)

@router.post("")
async def create_promotion(data: PromotionCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    doc = {
        "_id": f"promo_{uuid.uuid4().hex[:8]}",
        **data.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.promotions.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["promotions"]})
    
    # Send notification to all users about new promotion
    if data.is_active:
        await create_promotional_notification(
            title=f"New Offer: {data.title}",
            title_ar=f"عرض جديد: {data.title_ar or data.title}",
            message=data.description or "Check out our latest promotion!",
            message_ar=data.description_ar or "اطلع على أحدث عروضنا!",
            image_url=data.image,
            promotion_id=doc["_id"]
        )
    
    return serialize_doc(doc)

@router.put("/{promotion_id}")
async def update_promotion(promotion_id: str, data: PromotionCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.promotions.update_one(
        {"_id": promotion_id},
        {"$set": {**data.dict(), "updated_at": datetime.now(timezone.utc)}}
    )
    await manager.broadcast({"type": "sync", "tables": ["promotions"]})
    return {"message": "Updated"}

@router.patch("/{promotion_id}/reorder")
async def reorder_promotion(promotion_id: str, data: dict, request: Request):
    await db.promotions.update_one(
        {"_id": promotion_id},
        {"$set": {"sort_order": data.get("sort_order", 0), "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Reordered"}

@router.delete("/{promotion_id}")
async def delete_promotion(promotion_id: str, request: Request):
    logger.info(f"DELETE /promotions/{promotion_id} - Starting deletion request")
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    logger.info(f"DELETE /promotions/{promotion_id} - User: {user.get('email') if user else 'None'}, Role: {role}")
    
    if role not in ["owner", "partner", "admin"]:
        logger.warning(f"DELETE /promotions/{promotion_id} - Access denied for role: {role}")
        raise HTTPException(status_code=403, detail=f"Access denied. Role '{role}' is not authorized.")
    
    promotion = await db.promotions.find_one({"_id": promotion_id})
    if not promotion:
        logger.warning(f"DELETE /promotions/{promotion_id} - Promotion not found")
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    result = await db.promotions.delete_one({"_id": promotion_id})
    logger.info(f"DELETE /promotions/{promotion_id} - Deleted count: {result.deleted_count}")
    
    await manager.broadcast({"type": "sync", "tables": ["promotions"]})
    return {"message": "Promotion deleted permanently", "deleted_id": promotion_id}
