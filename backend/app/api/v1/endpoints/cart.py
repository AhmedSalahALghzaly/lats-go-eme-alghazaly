"""
Cart Routes - Server-Side Cart System
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.security import get_current_user, serialize_doc
from ....models.schemas import CartItemAdd, CartItemAddEnhanced

router = APIRouter(prefix="/cart")

@router.get("")
async def get_cart(request: Request):
    """Get cart with full pricing details from server-side storage"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        return {
            "user_id": user["id"],
            "items": [],
            "subtotal": 0,
            "total_discount": 0,
            "total": 0
        }
    
    items = []
    subtotal = 0
    total_discount = 0
    
    for item in cart.get("items", []):
        product = await db.products.find_one({"_id": item["product_id"]})
        if product:
            product_data = serialize_doc(product)
            original_price = item.get("original_unit_price", product["price"])
            final_price = item.get("final_unit_price", product["price"])
            quantity = item["quantity"]
            
            item_discount = (original_price - final_price) * quantity
            item_subtotal = final_price * quantity
            
            subtotal += original_price * quantity
            total_discount += item_discount
            
            items.append({
                "product_id": item["product_id"],
                "quantity": quantity,
                "original_unit_price": original_price,
                "final_unit_price": final_price,
                "discount_details": item.get("discount_details", {}),
                "bundle_group_id": item.get("bundle_group_id"),
                "added_by_admin_id": item.get("added_by_admin_id"),
                "item_subtotal": item_subtotal,
                "item_discount": item_discount,
                "product": product_data
            })
    
    return {
        "user_id": user["id"],
        "items": items,
        "subtotal": round(subtotal, 2),
        "total_discount": round(total_discount, 2),
        "total": round(subtotal - total_discount, 2)
    }

@router.post("/add")
async def add_to_cart(item: CartItemAdd, request: Request):
    """Add item to cart with full pricing stored server-side"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    product = await db.products.find_one({"_id": item.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    original_price = product["price"]
    final_price = original_price
    discount_details = {"discount_type": "none", "discount_value": 0}
    
    if item.bundle_discount_percentage and item.bundle_discount_percentage > 0:
        final_price = original_price * (1 - item.bundle_discount_percentage / 100)
        discount_details = {
            "discount_type": "bundle",
            "discount_value": item.bundle_discount_percentage,
            "discount_source_id": item.bundle_offer_id,
        }
    
    cart_item = {
        "product_id": item.product_id,
        "quantity": item.quantity,
        "original_unit_price": original_price,
        "final_unit_price": round(final_price, 2),
        "discount_details": discount_details,
        "bundle_group_id": item.bundle_group_id,
        "added_at": datetime.now(timezone.utc)
    }
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        await db.carts.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": user["id"],
            "items": [cart_item],
            "updated_at": datetime.now(timezone.utc)
        })
    else:
        existing_idx = None
        for idx, existing_item in enumerate(cart.get("items", [])):
            if existing_item["product_id"] == item.product_id:
                if item.bundle_group_id:
                    if existing_item.get("bundle_group_id") == item.bundle_group_id:
                        existing_idx = idx
                        break
                elif not existing_item.get("bundle_group_id"):
                    existing_idx = idx
                    break
        
        if existing_idx is not None:
            await db.carts.update_one(
                {"user_id": user["id"]},
                {
                    "$inc": {f"items.{existing_idx}.quantity": item.quantity},
                    "$set": {"updated_at": datetime.now(timezone.utc)}
                }
            )
        else:
            await db.carts.update_one(
                {"user_id": user["id"]},
                {
                    "$push": {"items": cart_item},
                    "$set": {"updated_at": datetime.now(timezone.utc)}
                }
            )
    
    return {"message": "Added", "item": cart_item}

@router.put("/update")
async def update_cart(item: CartItemAdd, request: Request):
    """Update cart item quantity"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if item.quantity <= 0:
        await db.carts.update_one(
            {"user_id": user["id"]},
            {
                "$pull": {"items": {"product_id": item.product_id}},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
    else:
        await db.carts.update_one(
            {"user_id": user["id"], "items.product_id": item.product_id},
            {
                "$set": {
                    "items.$.quantity": item.quantity,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
    return {"message": "Updated"}

@router.post("/add-enhanced")
async def add_to_cart_enhanced(item: CartItemAddEnhanced, request: Request):
    """Add item to cart with all pricing pre-calculated"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    product = await db.products.find_one({"_id": item.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    cart_item = {
        "product_id": item.product_id,
        "quantity": item.quantity,
        "original_unit_price": item.original_unit_price or product["price"],
        "final_unit_price": item.final_unit_price or product["price"],
        "discount_details": item.discount_details or {},
        "bundle_group_id": item.bundle_group_id,
        "added_by_admin_id": item.added_by_admin_id,
        "added_at": datetime.now(timezone.utc)
    }
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        await db.carts.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": user["id"],
            "items": [cart_item],
            "updated_at": datetime.now(timezone.utc)
        })
    else:
        await db.carts.update_one(
            {"user_id": user["id"]},
            {
                "$push": {"items": cart_item},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
    
    return {"message": "Added", "item": cart_item}

@router.delete("/clear")
async def clear_cart(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"items": [], "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Cleared"}

@router.delete("/remove/{product_id}")
async def remove_from_cart(product_id: str, request: Request):
    """Remove a specific item from the cart"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.carts.update_one(
        {"user_id": user["id"]},
        {
            "$pull": {"items": {"product_id": product_id}},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    return {"message": "Removed", "product_id": product_id}

@router.delete("/void-bundle/{bundle_group_id}")
async def void_bundle_discount(bundle_group_id: str, request: Request):
    """Remove bundle discount from all items in a bundle group"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        return {"message": "Cart not found"}
    
    updated_items = []
    for item in cart.get("items", []):
        if item.get("bundle_group_id") == bundle_group_id:
            item["final_unit_price"] = item.get("original_unit_price", item["final_unit_price"])
            item["discount_details"] = {"discount_type": "none", "discount_value": 0}
            item["bundle_group_id"] = None
        updated_items.append(item)
    
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"items": updated_items, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Bundle voided"}

@router.post("/validate-stock")
async def validate_cart_stock(request: Request):
    """Validate cart items against real-time stock"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart or not cart.get("items"):
        return {"valid": True, "invalid_items": [], "message": "Cart is empty"}
    
    invalid_items = []
    valid_items = []
    
    for item in cart.get("items", []):
        product = await db.products.find_one({"_id": item["product_id"]})
        if not product:
            invalid_items.append({
                "product_id": item["product_id"],
                "reason": "product_not_found",
                "requested_quantity": item["quantity"],
                "available_stock": 0
            })
        elif product.get("stock_quantity", 0) < item["quantity"]:
            invalid_items.append({
                "product_id": item["product_id"],
                "product_name": product.get("name"),
                "reason": "insufficient_stock",
                "requested_quantity": item["quantity"],
                "available_stock": product.get("stock_quantity", 0)
            })
        else:
            valid_items.append({
                "product_id": item["product_id"],
                "product_name": product.get("name"),
                "requested_quantity": item["quantity"],
                "available_stock": product.get("stock_quantity", 0)
            })
    
    is_valid = len(invalid_items) == 0
    
    return {
        "valid": is_valid,
        "invalid_items": invalid_items,
        "valid_items": valid_items,
        "total_items": len(cart.get("items", [])),
        "message": "All items available" if is_valid else f"{len(invalid_items)} item(s) have stock issues"
    }
