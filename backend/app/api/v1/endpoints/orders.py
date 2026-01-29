"""
Order Routes with Cursor-Based Pagination
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.config import settings
from ....core.security import get_current_user, get_user_role, serialize_doc
from ....models.schemas import OrderCreate, AdminOrderCreate, AdminAssistedOrderCreate
from ....services.websocket import manager
from ....services.notification import (
    create_notification, 
    create_order_status_notification,
    notify_admins_order_cancelled
)

router = APIRouter(prefix="/orders")

def generate_order_number():
    import random
    return f"ORD-{datetime.now().strftime('%Y%m%d')}-{random.randint(10000, 99999)}"

@router.get("")
async def get_orders(
    request: Request,
    cursor: Optional[str] = None,
    limit: int = 20,
    direction: str = "next"
):
    """Get user's orders with cursor-based pagination"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    query = {"user_id": user["id"], "deleted_at": None}
    total = await db.orders.count_documents(query)
    
    # Cursor-based pagination
    if cursor:
        cursor_doc = await db.orders.find_one({"_id": cursor})
        if cursor_doc:
            cursor_created_at = cursor_doc.get("created_at")
            if direction == "next":
                query["$and"] = query.get("$and", []) + [
                    {"$or": [
                        {"created_at": {"$lt": cursor_created_at}},
                        {"created_at": cursor_created_at, "_id": {"$lt": cursor}}
                    ]}
                ]
            else:
                query["$and"] = query.get("$and", []) + [
                    {"$or": [
                        {"created_at": {"$gt": cursor_created_at}},
                        {"created_at": cursor_created_at, "_id": {"$gt": cursor}}
                    ]}
                ]
    
    sort_direction = -1 if direction == "next" else 1
    orders = await db.orders.find(query).sort([("created_at", sort_direction), ("_id", sort_direction)]).limit(limit + 1).to_list(limit + 1)
    
    has_more = len(orders) > limit
    if has_more:
        orders = orders[:limit]
    if direction == "prev":
        orders = list(reversed(orders))
    
    orders_data = [serialize_doc(o) for o in orders]
    next_cursor = orders_data[-1]["id"] if orders_data and has_more else None
    prev_cursor = orders_data[0]["id"] if orders_data and cursor else None
    
    return {
        "orders": orders_data,
        "total": total,
        "next_cursor": next_cursor,
        "prev_cursor": prev_cursor,
        "has_more": has_more
    }

@router.get("/admin")
async def get_all_orders(request: Request, status: Optional[str] = None):
    """Get all orders for admin"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {"deleted_at": None}
    if status:
        query["status"] = status
    
    orders = await db.orders.find(query).sort("created_at", -1).to_list(10000)
    return {"orders": [serialize_doc(o) for o in orders]}

@router.get("/{order_id}")
async def get_order(order_id: str, request: Request):
    """Get order details"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    is_admin_role = role in ["owner", "partner", "admin"]
    is_order_owner = user and order.get("user_id") == user.get("id")
    
    if not is_admin_role and not is_order_owner:
        raise HTTPException(status_code=403, detail="Access denied")
    
    enriched_items = []
    for item in order.get("items", []):
        if not item.get("image_url"):
            product = await db.products.find_one({"_id": item.get("product_id")})
            if product:
                item["image_url"] = product.get("image_url")
                item["product_name"] = item.get("product_name") or product.get("name")
                item["product_name_ar"] = item.get("product_name_ar") or product.get("name_ar")
        enriched_items.append(item)
    
    order["items"] = enriched_items
    return serialize_doc(order)

@router.post("")
async def create_order(data: OrderCreate, request: Request):
    """Create order from user's cart"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    items = []
    subtotal = 0
    total_discount = 0
    
    for item in cart.get("items", []):
        product = await db.products.find_one({"_id": item["product_id"]})
        if not product:
            continue
        
        original_price = item.get("original_unit_price", product["price"])
        final_price = item.get("final_unit_price", product["price"])
        quantity = item["quantity"]
        
        subtotal += original_price * quantity
        total_discount += (original_price - final_price) * quantity
        
        items.append({
            "product_id": item["product_id"],
            "product_name": product.get("name"),
            "product_name_ar": product.get("name_ar"),
            "sku": product.get("sku"),
            "quantity": quantity,
            "price": final_price,
            "original_unit_price": original_price,
            "final_unit_price": final_price,
            "discount_details": item.get("discount_details", {}),
            "bundle_group_id": item.get("bundle_group_id"),
            "image_url": product.get("image_url"),
        })
        
        if product.get("stock_quantity", 0) >= quantity:
            await db.products.update_one(
                {"_id": item["product_id"]},
                {"$inc": {"stock_quantity": -quantity}}
            )
    
    total = subtotal - total_discount + settings.SHIPPING_COST
    
    order_doc = {
        "_id": str(uuid.uuid4()),
        "order_number": generate_order_number(),
        "user_id": user["id"],
        "user_name": user.get("name", f"{data.first_name} {data.last_name}"),
        "user_email": user.get("email", data.email),
        "items": items,
        "subtotal": round(subtotal, 2),
        "discount": round(total_discount, 2),
        "shipping_cost": settings.SHIPPING_COST,
        "total": round(total, 2),
        "status": "pending",
        "order_source": "customer_app",
        "shipping_address": f"{data.street_address}, {data.city}, {data.state}, {data.country}",
        "delivery_address": {
            "street_address": data.street_address,
            "city": data.city,
            "state": data.state,
            "country": data.country,
            "delivery_instructions": data.delivery_instructions
        },
        "phone": data.phone,
        "payment_method": data.payment_method,
        "notes": data.notes,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None
    }
    
    await db.orders.insert_one(order_doc)
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    
    await create_notification(
        user["id"],
        "Order Placed!",
        f"Your order {order_doc['order_number']} has been placed successfully.",
        "success",
        {"order_id": order_doc["_id"]}
    )
    
    await manager.broadcast({"type": "order_created", "order_id": order_doc["_id"]})
    await manager.broadcast({"type": "sync", "tables": ["orders", "products"]})
    
    return serialize_doc(order_doc)

@router.patch("/{order_id}/status")
@router.put("/{order_id}/status")
async def update_order_status(order_id: str, status: str, request: Request):
    """Update order status (supports both PATCH and PUT)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if order.get("user_id"):
        # Use enhanced localized notification system
        await create_order_status_notification(
            user_id=order["user_id"],
            order_number=order.get('order_number', 'N/A'),
            status=status,
            order_id=order_id
        )
        
        # Also notify admins if order is cancelled
        if status == "cancelled":
            await notify_admins_order_cancelled(
                order_number=order.get('order_number', 'N/A'),
                order_id=order_id,
                customer_name=order.get('user_name'),
                cancelled_by="admin"
            )
    
    await manager.broadcast({"type": "sync", "tables": ["orders"]})
    return {"message": "Updated", "status": status}

@router.patch("/{order_id}/discount")
async def update_order_discount(order_id: str, request: Request):
    """Update order discount (OWNER ONLY)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can modify discounts")
    
    body = await request.json()
    discount = body.get("discount", 0)
    if discount < 0:
        raise HTTPException(status_code=400, detail="Discount cannot be negative")
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    subtotal = order.get("subtotal", 0)
    shipping = order.get("shipping_cost", settings.SHIPPING_COST)
    new_total = subtotal + shipping - discount
    
    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {"discount": discount, "total": new_total, "updated_at": datetime.now(timezone.utc)}}
    )
    
    await manager.broadcast({"type": "sync", "tables": ["orders"]})
    return {"message": "Discount updated", "discount": discount, "total": new_total}

@router.delete("/{order_id}")
async def delete_order(order_id: str, request: Request):
    """Delete order (OWNER ONLY)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can delete orders")
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    result = await db.orders.delete_one({"_id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await manager.broadcast({"type": "order_deleted", "order_id": order_id, "order_total": order.get("total", 0)})
    await manager.broadcast({"type": "sync", "tables": ["orders", "analytics"]})
    return {"success": True, "message": "Order permanently deleted"}

# Admin assisted order
@router.post("/admin/create")
async def create_admin_order(data: AdminOrderCreate, request: Request):
    """Admin creates order for a customer"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    items = []
    subtotal = 0
    
    for item_data in data.items:
        product = await db.products.find_one({"_id": item_data.get("product_id")})
        if not product:
            continue
        
        quantity = item_data.get("quantity", 1)
        price = product["price"]
        subtotal += price * quantity
        
        items.append({
            "product_id": item_data["product_id"],
            "product_name": product.get("name"),
            "product_name_ar": product.get("name_ar"),
            "sku": product.get("sku"),
            "quantity": quantity,
            "price": price,
            "original_unit_price": price,
            "final_unit_price": price,
            "image_url": product.get("image_url"),
        })
        
        if product.get("stock_quantity", 0) >= quantity:
            await db.products.update_one(
                {"_id": item_data["product_id"]},
                {"$inc": {"stock_quantity": -quantity}}
            )
    
    total = subtotal + settings.SHIPPING_COST
    
    order_doc = {
        "_id": str(uuid.uuid4()),
        "order_number": generate_order_number(),
        "user_id": data.user_id,
        "user_name": f"{data.first_name} {data.last_name}",
        "user_email": data.email,
        "items": items,
        "subtotal": round(subtotal, 2),
        "discount": 0,
        "shipping_cost": settings.SHIPPING_COST,
        "total": round(total, 2),
        "status": "pending",
        "order_source": "admin_assisted",
        "created_by_admin_id": user["id"] if user else None,
        "shipping_address": f"{data.street_address}, {data.city}, {data.state}, {data.country}",
        "delivery_address": {
            "street_address": data.street_address,
            "city": data.city,
            "state": data.state,
            "country": data.country,
            "delivery_instructions": data.delivery_instructions
        },
        "phone": data.phone,
        "payment_method": data.payment_method,
        "admin_viewed": True,
        "notes": data.notes,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None
    }
    
    await db.orders.insert_one(order_doc)
    await manager.broadcast({"type": "sync", "tables": ["orders", "products"]})
    
    return serialize_doc(order_doc)

@router.get("/admin/{order_id}")
async def get_admin_order_detail(order_id: str, request: Request):
    """Get order details - accessible by admin, owner, partner, and order owner"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    is_admin_role = role in ["owner", "partner", "admin"]
    is_order_owner = user and order.get("user_id") == user.get("id")
    
    if not is_admin_role and not is_order_owner:
        raise HTTPException(status_code=403, detail="Access denied")
    
    enriched_items = []
    for item in order.get("items", []):
        if not item.get("image_url"):
            product = await db.products.find_one({"_id": item.get("product_id")})
            if product:
                item["image_url"] = product.get("image_url")
                item["product_name"] = item.get("product_name") or product.get("name")
                item["product_name_ar"] = item.get("product_name_ar") or product.get("name_ar")
        enriched_items.append(item)
    
    order["items"] = enriched_items
    
    if "delivery_address" not in order and order.get("shipping_address"):
        parts = order.get("shipping_address", "").split(", ")
        order["delivery_address"] = {
            "street_address": parts[0] if len(parts) > 0 else "",
            "city": parts[1] if len(parts) > 1 else "",
            "state": parts[2] if len(parts) > 2 else "",
            "country": parts[3] if len(parts) > 3 else "Egypt",
            "delivery_instructions": order.get("delivery_instructions", "")
        }
    
    return serialize_doc(order)
