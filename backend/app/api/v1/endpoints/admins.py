"""
Admin Routes
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.security import get_current_user, get_user_role, serialize_doc
from ....models.schemas import AdminCreate, SettleRevenueRequest
from ....services.websocket import manager
from ....services.notification import create_notification

router = APIRouter(prefix="/admins")

@router.get("/check-access")
async def check_admin_access(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    admins = await db.admins.find({"deleted_at": None}).to_list(1000)
    return [{"id": a["_id"], "email": a.get("email", "")} for a in admins]

@router.get("")
async def get_admins(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    admins = await db.admins.find({"deleted_at": None}).to_list(1000)
    result = []
    for admin in admins:
        admin_data = serialize_doc(admin)
        products = await db.products.find({"added_by_admin_id": admin["_id"], "deleted_at": None}).to_list(10000)
        admin_data["products_added"] = len(products)
        
        product_ids = [p["_id"] for p in products]
        orders = await db.orders.find({"items.product_id": {"$in": product_ids}}).to_list(10000)
        delivered = sum(1 for o in orders if o.get("status") == "delivered")
        processing = sum(1 for o in orders if o.get("status") in ["pending", "preparing", "shipped", "out_for_delivery"])
        
        admin_data["products_delivered"] = delivered
        admin_data["products_processing"] = processing
        admin_data["revenue"] = admin.get("revenue", 0)
        
        assisted_orders = await db.orders.count_documents({"order_source": "admin_assisted", "created_by_admin_id": admin["_id"]})
        admin_data["assisted_orders"] = assisted_orders
        
        result.append(admin_data)
    return result

@router.post("")
async def add_admin(data: AdminCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    existing = await db.admins.find_one({"email": data.email, "deleted_at": None})
    if existing:
        raise HTTPException(status_code=400, detail="Admin already exists")
    
    admin = {
        "_id": str(uuid.uuid4()),
        "email": data.email,
        "name": data.name or data.email.split("@")[0],
        "revenue": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.admins.insert_one(admin)
    await manager.broadcast({"type": "sync", "tables": ["admins"]})
    return serialize_doc(admin)

@router.get("/{admin_id}")
async def get_admin(admin_id: str, request: Request):
    """Get a single admin by ID"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    admin = await db.admins.find_one({"_id": admin_id, "deleted_at": None})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    admin_data = serialize_doc(admin)
    # Include stats
    products = await db.products.find({"added_by_admin_id": admin_id, "deleted_at": None}).to_list(10000)
    admin_data["products_added"] = len(products)
    
    product_ids = [p["_id"] for p in products]
    orders = await db.orders.find({"items.product_id": {"$in": product_ids}}).to_list(10000)
    delivered = sum(1 for o in orders if o.get("status") == "delivered")
    processing = sum(1 for o in orders if o.get("status") in ["pending", "preparing", "shipped", "out_for_delivery"])
    
    admin_data["products_delivered"] = delivered
    admin_data["products_processing"] = processing
    admin_data["revenue"] = admin.get("revenue", 0)
    
    assisted_orders = await db.orders.count_documents({"order_source": "admin_assisted", "created_by_admin_id": admin_id})
    admin_data["assisted_orders"] = assisted_orders
    
    return admin_data

@router.put("/{admin_id}")
async def update_admin(admin_id: str, data: AdminCreate, request: Request):
    """Update an admin by ID"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    admin = await db.admins.find_one({"_id": admin_id, "deleted_at": None})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    # Check if email is already taken by another admin
    if data.email != admin.get("email"):
        existing = await db.admins.find_one({"email": data.email, "_id": {"$ne": admin_id}, "deleted_at": None})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use by another admin")
    
    update_data = {
        "email": data.email,
        "name": data.name or data.email.split("@")[0],
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.admins.update_one({"_id": admin_id}, {"$set": update_data})
    await manager.broadcast({"type": "sync", "tables": ["admins"]})
    
    updated_admin = await db.admins.find_one({"_id": admin_id})
    return serialize_doc(updated_admin)

@router.delete("/{admin_id}")
async def delete_admin(admin_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.admins.update_one({"_id": admin_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["admins"]})
    return {"message": "Deleted"}

@router.get("/{admin_id}/products")
async def get_admin_products(admin_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    products = await db.products.find({"added_by_admin_id": admin_id, "deleted_at": None}).to_list(10000)
    return [serialize_doc(p) for p in products]

@router.post("/{admin_id}/settle")
async def settle_admin_revenue(admin_id: str, data: SettleRevenueRequest, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.products.update_many(
        {"_id": {"$in": data.product_ids}},
        {"$set": {"settled": True, "settled_at": datetime.now(timezone.utc)}}
    )
    
    settlement = {
        "_id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "product_ids": data.product_ids,
        "amount": data.total_amount,
        "settled_by": user["id"] if user else None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.settlements.insert_one(settlement)
    await db.admins.update_one({"_id": admin_id}, {"$inc": {"revenue": data.total_amount}})
    
    admin = await db.admins.find_one({"_id": admin_id})
    if admin and user:
        await create_notification(
            user["id"],
            "Revenue Settled",
            f"Admin {admin.get('name', admin.get('email'))} settled revenue of {data.total_amount} EGP",
            "success"
        )
    
    await manager.broadcast({"type": "sync", "tables": ["admins", "products", "settlements"]})
    return {"message": "Settled", "amount": data.total_amount}

@router.post("/{admin_id}/clear-revenue")
async def clear_admin_revenue(admin_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.admins.update_one({"_id": admin_id}, {"$set": {"revenue": 0}})
    await manager.broadcast({"type": "sync", "tables": ["admins"]})
    return {"message": "Revenue cleared"}
