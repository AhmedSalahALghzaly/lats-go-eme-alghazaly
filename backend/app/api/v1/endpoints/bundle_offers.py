"""
Bundle Offer Routes
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid
import logging

from ....core.database import db
from ....core.security import get_current_user, get_user_role, serialize_doc
from ....models.schemas import BundleOfferCreate
from ....services.websocket import manager
from ....services.notification import create_promotional_notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bundle-offers")

@router.get("")
async def get_bundle_offers(active_only: bool = True):
    query = {"deleted_at": None}
    if active_only:
        query["is_active"] = True
    offers = await db.bundle_offers.find(query).to_list(100)
    result = []
    for offer in offers:
        offer_data = serialize_doc(offer)
        if offer.get("product_ids"):
            products = await db.products.find({"_id": {"$in": offer["product_ids"]}}).to_list(100)
            offer_data["products"] = [serialize_doc(p) for p in products]
        result.append(offer_data)
    return result

@router.get("/{offer_id}")
async def get_bundle_offer(offer_id: str):
    offer = await db.bundle_offers.find_one({"_id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Bundle offer not found")
    offer_data = serialize_doc(offer)
    if offer.get("product_ids"):
        products = await db.products.find({"_id": {"$in": offer["product_ids"]}}).to_list(100)
        offer_data["products"] = [serialize_doc(p) for p in products]
    return offer_data

@router.post("")
async def create_bundle_offer(data: BundleOfferCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    doc = {
        "_id": f"bundle_{uuid.uuid4().hex[:8]}",
        **data.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.bundle_offers.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["bundle_offers"]})
    
    # Send notification to all users about new bundle offer
    if data.is_active:
        discount_text = f"{int(data.discount_percentage)}% off" if data.discount_percentage else ""
        discount_text_ar = f"خصم {int(data.discount_percentage)}%" if data.discount_percentage else ""
        
        await create_promotional_notification(
            title=f"New Bundle: {data.name}",
            title_ar=f"باقة جديدة: {data.name_ar or data.name}",
            message=f"{data.description or 'Check out our new bundle offer!'} {discount_text}".strip(),
            message_ar=f"{data.description_ar or 'اكتشف باقتنا الجديدة!'} {discount_text_ar}".strip(),
            image_url=data.image_url,
            bundle_id=doc["_id"]
        )
    
    return serialize_doc(doc)

@router.put("/{offer_id}")
async def update_bundle_offer(offer_id: str, data: BundleOfferCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.bundle_offers.update_one(
        {"_id": offer_id},
        {"$set": {**data.dict(), "updated_at": datetime.now(timezone.utc)}}
    )
    await manager.broadcast({"type": "sync", "tables": ["bundle_offers"]})
    return {"message": "Updated"}

@router.delete("/{offer_id}")
async def delete_bundle_offer(offer_id: str, request: Request):
    logger.info(f"DELETE /bundle-offers/{offer_id} - Starting deletion request")
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    logger.info(f"DELETE /bundle-offers/{offer_id} - User: {user.get('email') if user else 'None'}, Role: {role}")
    
    if role not in ["owner", "partner", "admin"]:
        logger.warning(f"DELETE /bundle-offers/{offer_id} - Access denied for role: {role}")
        raise HTTPException(status_code=403, detail=f"Access denied. Role '{role}' is not authorized.")
    
    offer = await db.bundle_offers.find_one({"_id": offer_id})
    if not offer:
        logger.warning(f"DELETE /bundle-offers/{offer_id} - Bundle offer not found")
        raise HTTPException(status_code=404, detail="Bundle offer not found")
    
    await db.carts.update_many(
        {"items.bundle_group_id": offer_id},
        {"$pull": {"items": {"bundle_group_id": offer_id}}}
    )
    
    result = await db.bundle_offers.delete_one({"_id": offer_id})
    logger.info(f"DELETE /bundle-offers/{offer_id} - Deleted count: {result.deleted_count}")
    
    await manager.broadcast({"type": "sync", "tables": ["bundle_offers", "carts"]})
    return {"message": "Bundle offer deleted permanently", "deleted_id": offer_id}
