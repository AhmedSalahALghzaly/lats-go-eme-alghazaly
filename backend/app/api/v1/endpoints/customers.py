"""
Customer Routes
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional

from ....core.database import db
from ....core.security import get_current_user, get_user_role, serialize_doc

router = APIRouter(prefix="/customers")

@router.get("")
async def get_customers(request: Request):
    """Get all customers (admin only)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    users = await db.users.find({}).sort("created_at", -1).to_list(10000)
    customers = []
    for u in users:
        user_data = serialize_doc(u)
        order_count = await db.orders.count_documents({"user_id": u["_id"], "deleted_at": None})
        total_spent = 0
        orders = await db.orders.find({"user_id": u["_id"], "status": "delivered"}).to_list(1000)
        for o in orders:
            total_spent += o.get("total", 0)
        user_data["order_count"] = order_count
        user_data["total_spent"] = total_spent
        customers.append(user_data)
    return {"customers": customers, "total": len(customers)}

@router.get("/{customer_id}")
async def get_customer(customer_id: str, request: Request):
    """Get customer details"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    customer = await db.users.find_one({"_id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return serialize_doc(customer)

# Admin customer data endpoints
@router.get("/admin/customer/{customer_id}/favorites")
async def get_customer_favorites(customer_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    favs = await db.favorites.find({"user_id": customer_id, "deleted_at": None}).to_list(1000)
    result = []
    for f in favs:
        product = await db.products.find_one({"_id": f["product_id"]})
        if product:
            result.append({**serialize_doc(f), "product": serialize_doc(product)})
    return {"favorites": result, "total": len(result)}

@router.get("/admin/customer/{customer_id}/cart")
async def get_customer_cart(customer_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    cart = await db.carts.find_one({"user_id": customer_id})
    if not cart:
        return {"items": [], "total": 0}
    
    items = []
    for item in cart.get("items", []):
        product = await db.products.find_one({"_id": item["product_id"]})
        if product:
            items.append({**item, "product": serialize_doc(product)})
    return {"items": items, "total": len(items)}

@router.get("/admin/customer/{customer_id}/orders")
async def get_customer_orders(customer_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    orders = await db.orders.find({"user_id": customer_id, "deleted_at": None}).sort("created_at", -1).to_list(1000)
    return {"orders": [serialize_doc(o) for o in orders], "total": len(orders)}

@router.patch("/admin/customer/{customer_id}/orders/mark-viewed")
async def mark_customer_orders_viewed(customer_id: str, request: Request):
    """Mark all customer orders as viewed by admin"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    from datetime import datetime, timezone
    
    result = await db.orders.update_many(
        {"user_id": customer_id, "admin_viewed": {"$ne": True}},
        {"$set": {"admin_viewed": True, "admin_viewed_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Orders marked as viewed", "modified_count": result.modified_count}

@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, request: Request):
    """Soft delete a customer"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    customer = await db.users.find_one({"_id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    from datetime import datetime, timezone
    await db.users.update_one(
        {"_id": customer_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Customer deleted"}
