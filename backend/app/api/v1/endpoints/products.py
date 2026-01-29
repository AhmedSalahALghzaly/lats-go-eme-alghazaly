"""
Product Routes with Cursor-Based Pagination
"""
from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional
from datetime import datetime, timezone
import uuid

from ....core.database import db
from ....core.security import get_current_user, serialize_doc, get_user_role
from ....models.schemas import ProductCreate
from ....services.websocket import manager
from ....services.notification import notify_admins_product_change

router = APIRouter(prefix="/products")

@router.get("")
async def get_products(
    category_id: Optional[str] = None,
    product_brand_id: Optional[str] = None,
    car_model_id: Optional[str] = None,
    car_brand_id: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    skip: int = 0,
    limit: int = 50,
    include_hidden: bool = False,
    cursor: Optional[str] = None,
    direction: str = "next"
):
    """
    Enhanced product listing with cursor-based pagination.
    - cursor: Product ID to start from (exclusive)
    - direction: "next" for newer items (default), "prev" for older items
    """
    query = {"deleted_at": None}
    if not include_hidden:
        query["$or"] = [{"hidden_status": False}, {"hidden_status": None}]
    if category_id:
        subcats = await db.categories.find({"parent_id": category_id}).to_list(100)
        cat_ids = [category_id] + [str(c["_id"]) for c in subcats]
        query["category_id"] = {"$in": cat_ids}
    if product_brand_id:
        query["product_brand_id"] = product_brand_id
    if car_model_id:
        query["car_model_ids"] = car_model_id
    if car_brand_id:
        models = await db.car_models.find({"brand_id": car_brand_id}).to_list(100)
        model_ids = [str(m["_id"]) for m in models]
        if model_ids:
            query["car_model_ids"] = {"$in": model_ids}
    if min_price is not None:
        query["price"] = {"$gte": min_price}
    if max_price is not None:
        query.setdefault("price", {})["$lte"] = max_price
    
    total = await db.products.count_documents(query)
    
    # Cursor-based pagination
    if cursor:
        cursor_doc = await db.products.find_one({"_id": cursor})
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
    products = await db.products.find(query).sort([("created_at", sort_direction), ("_id", sort_direction)]).limit(limit + 1).to_list(limit + 1)
    
    has_more = len(products) > limit
    if has_more:
        products = products[:limit]
    
    if direction == "prev":
        products = list(reversed(products))
    
    all_product_brands = await db.product_brands.find({"deleted_at": None}).to_list(1000)
    all_car_models = await db.car_models.find({"deleted_at": None}).to_list(1000)
    all_car_brands = await db.car_brands.find({"deleted_at": None}).to_list(1000)
    
    brand_map = {b["_id"]: serialize_doc(b) for b in all_product_brands}
    car_model_map = {m["_id"]: serialize_doc(m) for m in all_car_models}
    car_brand_map = {b["_id"]: serialize_doc(b) for b in all_car_brands}
    
    enriched_products = []
    for p in products:
        product_data = serialize_doc(p)
        
        if p.get("product_brand_id") and p["product_brand_id"] in brand_map:
            brand = brand_map[p["product_brand_id"]]
            product_data["product_brand_name"] = brand.get("name", "")
            product_data["product_brand_name_ar"] = brand.get("name_ar", "")
            product_data["manufacturer_country"] = brand.get("country_of_origin", "")
            product_data["manufacturer_country_ar"] = brand.get("country_of_origin_ar", "")
        
        if p.get("car_model_ids") and len(p["car_model_ids"]) > 0:
            first_model_id = p["car_model_ids"][0]
            if first_model_id in car_model_map:
                car_model = car_model_map[first_model_id]
                product_data["compatible_car_model"] = car_model.get("name", "")
                product_data["compatible_car_model_ar"] = car_model.get("name_ar", "")
                product_data["compatible_car_models_count"] = len(p["car_model_ids"])
                # Add car brand info
                car_brand_id = car_model.get("brand_id")
                if car_brand_id and car_brand_id in car_brand_map:
                    car_brand = car_brand_map[car_brand_id]
                    product_data["compatible_car_brand"] = car_brand.get("name", "")
                    product_data["compatible_car_brand_ar"] = car_brand.get("name_ar", "")
                # Add year range
                product_data["compatible_car_year_from"] = car_model.get("year_start")
                product_data["compatible_car_year_to"] = car_model.get("year_end")
        
        enriched_products.append(product_data)
    
    next_cursor = enriched_products[-1]["id"] if enriched_products and has_more else None
    prev_cursor = enriched_products[0]["id"] if enriched_products and cursor else None
    
    return {
        "products": enriched_products,
        "total": total,
        "next_cursor": next_cursor,
        "prev_cursor": prev_cursor,
        "has_more": has_more,
        "page_size": limit
    }

@router.get("/search")
async def search_products(q: str = Query(..., min_length=1), limit: int = 20):
    regex = {"$regex": q, "$options": "i"}
    products = await db.products.find({"$and": [{"deleted_at": None}, {"$or": [{"name": regex}, {"name_ar": regex}, {"sku": regex}]}]}).limit(limit).to_list(limit)
    car_brands = await db.car_brands.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    car_models = await db.car_models.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    product_brands = await db.product_brands.find({"deleted_at": None, "name": regex}).limit(5).to_list(5)
    categories = await db.categories.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    suppliers = await db.suppliers.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    distributors = await db.distributors.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    return {
        "products": [serialize_doc(p) for p in products],
        "car_brands": [serialize_doc(b) for b in car_brands],
        "car_models": [serialize_doc(m) for m in car_models],
        "product_brands": [serialize_doc(b) for b in product_brands],
        "categories": [serialize_doc(c) for c in categories],
        "suppliers": [serialize_doc(s) for s in suppliers],
        "distributors": [serialize_doc(d) for d in distributors],
    }

@router.get("/all")
async def get_all_products():
    products = await db.products.find({"deleted_at": None}).sort("created_at", -1).to_list(10000)
    
    all_product_brands = await db.product_brands.find({"deleted_at": None}).to_list(1000)
    all_car_models = await db.car_models.find({"deleted_at": None}).to_list(1000)
    all_car_brands = await db.car_brands.find({"deleted_at": None}).to_list(1000)
    
    brand_map = {b["_id"]: serialize_doc(b) for b in all_product_brands}
    car_model_map = {m["_id"]: serialize_doc(m) for m in all_car_models}
    car_brand_map = {b["_id"]: serialize_doc(b) for b in all_car_brands}
    
    enriched_products = []
    for p in products:
        product_data = serialize_doc(p)
        
        if p.get("product_brand_id") and p["product_brand_id"] in brand_map:
            brand = brand_map[p["product_brand_id"]]
            product_data["product_brand_name"] = brand.get("name", "")
            product_data["product_brand_name_ar"] = brand.get("name_ar", "")
            product_data["manufacturer_country"] = brand.get("country_of_origin", "")
            product_data["manufacturer_country_ar"] = brand.get("country_of_origin_ar", "")
        
        if p.get("car_model_ids") and len(p["car_model_ids"]) > 0:
            first_model_id = p["car_model_ids"][0]
            if first_model_id in car_model_map:
                car_model = car_model_map[first_model_id]
                product_data["compatible_car_model"] = car_model.get("name", "")
                product_data["compatible_car_model_ar"] = car_model.get("name_ar", "")
                product_data["compatible_car_models_count"] = len(p["car_model_ids"])
                # Add car brand info
                car_brand_id = car_model.get("brand_id")
                if car_brand_id and car_brand_id in car_brand_map:
                    car_brand = car_brand_map[car_brand_id]
                    product_data["compatible_car_brand"] = car_brand.get("name", "")
                    product_data["compatible_car_brand_ar"] = car_brand.get("name_ar", "")
                # Add year range
                product_data["compatible_car_year_from"] = car_model.get("year_start")
                product_data["compatible_car_year_to"] = car_model.get("year_end")
        
        enriched_products.append(product_data)
    
    return {"products": enriched_products, "total": len(enriched_products)}

@router.get("/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    p = serialize_doc(product)
    if p.get("product_brand_id"):
        brand = await db.product_brands.find_one({"_id": p["product_brand_id"]})
        p["product_brand"] = serialize_doc(brand)
        
        # Fetch supplier linked to this product brand
        if brand and brand.get("supplier_id"):
            supplier = await db.suppliers.find_one({
                "_id": brand["supplier_id"], 
                "deleted_at": None
            })
            if supplier:
                p["supplier"] = serialize_doc(supplier)
    
    if p.get("category_id"):
        cat = await db.categories.find_one({"_id": p["category_id"]})
        p["category"] = serialize_doc(cat)
    if p.get("car_model_ids"):
        models = await db.car_models.find({"_id": {"$in": p["car_model_ids"]}}).to_list(100)
        p["car_models"] = [serialize_doc(m) for m in models]
    return p

@router.post("")
async def create_product(product: ProductCreate, request: Request):
    user = await get_current_user(request)
    admin_id = None
    admin_name = None
    if user:
        admin = await db.admins.find_one({"email": user.get("email"), "deleted_at": None})
        if admin:
            admin_id = admin["_id"]
            admin_name = admin.get("name", user.get("name", user.get("email")))
    
    doc = {
        "_id": f"prod_{uuid.uuid4().hex[:8]}",
        **product.dict(),
        "added_by_admin_id": admin_id or product.added_by_admin_id,
        "settled": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None
    }
    await db.products.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    
    # Notify admins about new product
    await notify_admins_product_change(
        product_name=product.name or product.name_ar or "New Product",
        product_id=doc["_id"],
        action="created",
        admin_name=admin_name
    )
    
    return serialize_doc(doc)

@router.put("/{product_id}")
async def update_product(product_id: str, product: ProductCreate):
    await db.products.update_one(
        {"_id": product_id},
        {"$set": {**product.dict(), "updated_at": datetime.now(timezone.utc)}}
    )
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Updated"}

@router.patch("/{product_id}/price")
async def update_product_price(product_id: str, data: dict):
    await db.products.update_one(
        {"_id": product_id},
        {"$set": {"price": data.get("price"), "updated_at": datetime.now(timezone.utc)}}
    )
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Price updated"}

@router.patch("/{product_id}/hidden")
async def update_product_hidden(product_id: str, data: dict):
    await db.products.update_one(
        {"_id": product_id},
        {"$set": {"hidden_status": data.get("hidden_status"), "updated_at": datetime.now(timezone.utc)}}
    )
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Updated"}

@router.delete("/{product_id}")
async def delete_product(product_id: str):
    await db.products.update_one(
        {"_id": product_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}}
    )
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Deleted"}
