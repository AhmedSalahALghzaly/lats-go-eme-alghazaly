"""
Marketing Routes (Home Slider)
"""
from fastapi import APIRouter

from ....core.database import db
from ....core.security import serialize_doc

router = APIRouter(prefix="/marketing")

@router.get("/home-slider")
async def get_home_slider():
    """Enhanced marketing slider endpoint that combines promotions and bundle offers"""
    slider_items = []
    
    # Get active promotions for slider
    promotions = await db.promotions.find({
        "deleted_at": None,
        "is_active": True,
        "promotion_type": "slider"
    }).sort("sort_order", 1).to_list(10)
    
    for idx, promo in enumerate(promotions):
        target_product = None
        if promo.get("target_product_id"):
            target_product = await db.products.find_one({"_id": promo["target_product_id"]})
        
        target_car_model = None
        if promo.get("target_car_model_id"):
            target_car_model = await db.car_models.find_one({"_id": promo["target_car_model_id"]})
        
        slider_items.append({
            "type": "promotion",
            "id": promo["_id"],
            "title": promo.get("title", ""),
            "title_ar": promo.get("title_ar", promo.get("title", "")),
            "subtitle": promo.get("subtitle", ""),
            "subtitle_ar": promo.get("subtitle_ar", promo.get("subtitle", "")),
            "image": promo.get("image", ""),
            "discount_percentage": promo.get("discount_percentage", 0),
            "target_product_id": promo.get("target_product_id"),
            "target_car_model_id": promo.get("target_car_model_id"),
            "target_product": serialize_doc(target_product) if target_product else None,
            "target_car_model": serialize_doc(target_car_model) if target_car_model else None,
            "sort_order": promo.get("sort_order", idx),
            "is_active": True,
        })
    
    # Get active bundle offers
    bundles = await db.bundle_offers.find({
        "deleted_at": None,
        "is_active": True
    }).to_list(10)
    
    for idx, bundle in enumerate(bundles):
        original_total = 0
        discounted_total = 0
        product_count = 0
        products_data = []
        
        if bundle.get("product_ids"):
            products = await db.products.find({"_id": {"$in": bundle["product_ids"]}}).to_list(100)
            product_count = len(products)
            
            for product in products:
                price = float(product.get("price", 0))
                original_total += price
                products_data.append(serialize_doc(product))
            
            discount_pct = float(bundle.get("discount_percentage", 0))
            discounted_total = original_total * (1 - discount_pct / 100)
        
        slider_items.append({
            "type": "bundle_offer",
            "id": bundle["_id"],
            "title": bundle.get("name", ""),
            "title_ar": bundle.get("name_ar", bundle.get("name", "")),
            "subtitle": bundle.get("description", ""),
            "subtitle_ar": bundle.get("description_ar", bundle.get("description", "")),
            "image": bundle.get("image", ""),
            "discount_percentage": bundle.get("discount_percentage", 0),
            "original_total": round(original_total, 2),
            "discounted_total": round(discounted_total, 2),
            "product_count": product_count,
            "product_ids": bundle.get("product_ids", []),
            "products": products_data,
            "sort_order": 100 + idx,
            "is_active": True,
        })
    
    slider_items.sort(key=lambda x: x.get("sort_order", 0))
    return slider_items
