"""
Analytics Routes - Complete Sub-Endpoints
Al-Ghazaly Auto Parts API v4.1
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from ....core.database import db
from ....core.security import get_current_user, get_user_role, serialize_doc

router = APIRouter(prefix="/analytics")


# ==================== Analytics Overview Endpoint ====================
@router.get("/overview")
async def get_analytics_overview(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    date_filter = {}
    if start_date:
        date_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
    if end_date:
        date_filter["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    
    order_query = {}
    if date_filter:
        order_query["created_at"] = date_filter
    
    orders = await db.orders.find(order_query).to_list(100000)
    
    total_orders = len(orders)
    total_revenue = sum(o.get("total", 0) for o in orders)
    delivered_orders = [o for o in orders if o.get("status") == "delivered"]
    delivered_revenue = sum(o.get("total", 0) for o in delivered_orders)
    aov = total_revenue / total_orders if total_orders > 0 else 0
    
    status_counts = {}
    for status in ["pending", "preparing", "shipped", "out_for_delivery", "delivered", "cancelled"]:
        status_counts[status] = sum(1 for o in orders if o.get("status") == status)
    
    customer_app_orders = sum(1 for o in orders if o.get("order_source", "customer_app") == "customer_app")
    admin_assisted_orders = sum(1 for o in orders if o.get("order_source") == "admin_assisted")
    
    order_source_breakdown = {
        "customer_app": customer_app_orders,
        "admin_assisted": admin_assisted_orders,
        "customer_app_percentage": round((customer_app_orders / total_orders * 100) if total_orders > 0 else 0, 1),
        "admin_assisted_percentage": round((admin_assisted_orders / total_orders * 100) if total_orders > 0 else 0, 1),
    }
    
    total_discount_value = 0
    bundle_revenue = 0
    regular_revenue = 0
    bundle_orders = 0
    
    for order in orders:
        order_has_bundle = False
        for item in order.get("items", []):
            original_price = item.get("original_unit_price", item.get("price", 0))
            final_price = item.get("final_unit_price", item.get("price", 0))
            quantity = item.get("quantity", 1)
            discount = (original_price - final_price) * quantity
            total_discount_value += max(0, discount)
            
            if item.get("bundle_group_id") or item.get("discount_details", {}).get("discount_type") == "bundle":
                bundle_revenue += final_price * quantity
                order_has_bundle = True
            else:
                regular_revenue += final_price * quantity
        
        if order_has_bundle:
            bundle_orders += 1
    
    discount_performance = {
        "total_discount_value": round(total_discount_value, 2),
        "bundle_revenue": round(bundle_revenue, 2),
        "regular_revenue": round(regular_revenue, 2),
        "bundle_orders_count": bundle_orders,
        "bundle_revenue_percentage": round((bundle_revenue / total_revenue * 100) if total_revenue > 0 else 0, 1),
        "average_discount_per_order": round(total_discount_value / total_orders if total_orders > 0 else 0, 2),
    }
    
    product_sales = {}
    for order in orders:
        for item in order.get("items", []):
            pid = item.get("product_id")
            if pid:
                if pid not in product_sales:
                    product_sales[pid] = {"count": 0, "revenue": 0, "name": item.get("product_name", "Unknown")}
                product_sales[pid]["count"] += item.get("quantity", 1)
                product_sales[pid]["revenue"] += item.get("final_unit_price", item.get("price", 0)) * item.get("quantity", 1)
    
    top_products = sorted(product_sales.values(), key=lambda x: x["revenue"], reverse=True)[:10]
    
    revenue_by_day = {}
    for order in orders:
        day = order.get("created_at").strftime("%Y-%m-%d") if order.get("created_at") else "Unknown"
        revenue_by_day[day] = revenue_by_day.get(day, 0) + order.get("total", 0)
    
    products = await db.products.find({}).to_list(100000)
    product_admin_map = {p["_id"]: p.get("added_by_admin_id") for p in products}
    
    admin_sales = {}
    for order in orders:
        for item in order.get("items", []):
            admin_id = product_admin_map.get(item.get("product_id"))
            if admin_id:
                if admin_id not in admin_sales:
                    admin_sales[admin_id] = {"count": 0, "revenue": 0}
                admin_sales[admin_id]["count"] += item.get("quantity", 1)
                admin_sales[admin_id]["revenue"] += item.get("final_unit_price", item.get("price", 0)) * item.get("quantity", 1)
    
    admins = await db.admins.find({}).to_list(1000)
    admin_name_map = {a["_id"]: a.get("name", a.get("email", "Unknown")) for a in admins}
    
    sales_by_admin = [
        {"admin_id": aid, "name": admin_name_map.get(aid, "Unknown"), **data}
        for aid, data in admin_sales.items()
    ]
    
    recent_customers = await db.users.find({}).sort("created_at", -1).limit(5).to_list(5)
    low_stock = await db.products.find({"stock_quantity": {"$lt": 10}, "deleted_at": None}).limit(10).to_list(10)
    
    return {
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "delivered_revenue": delivered_revenue,
        "average_order_value": round(aov, 2),
        "orders_by_status": status_counts,
        "order_source_breakdown": order_source_breakdown,
        "discount_performance": discount_performance,
        "top_products": top_products,
        "revenue_by_day": [{"date": k, "revenue": v} for k, v in sorted(revenue_by_day.items())],
        "sales_by_admin": sales_by_admin,
        "recent_customers": [serialize_doc(c) for c in recent_customers],
        "low_stock_products": [serialize_doc(p) for p in low_stock],
    }

@router.get("/collections")
async def get_collections(request: Request, admin_id: Optional[str] = None):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {"settled": True}
    if admin_id:
        query["added_by_admin_id"] = admin_id
    
    products = await db.products.find(query).to_list(10000)
    admins = await db.admins.find({}).to_list(1000)
    admin_map = {a["_id"]: serialize_doc(a) for a in admins}
    
    result = []
    for p in products:
        p_data = serialize_doc(p)
        p_data["admin"] = admin_map.get(p.get("added_by_admin_id"))
        result.append(p_data)
    
    return result


# ==================== NEW: Customer Analytics Endpoint ====================
@router.get("/customers")
async def get_customer_analytics(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get customer analytics including growth, retention, and demographics"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    date_filter = {}
    if start_date:
        date_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
    if end_date:
        date_filter["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    
    user_query = {}
    if date_filter:
        user_query["created_at"] = date_filter
    
    # Get all users
    all_users = await db.users.find({"deleted_at": None}).to_list(100000)
    filtered_users = await db.users.find(user_query).to_list(100000) if date_filter else all_users
    
    # Customer growth over time (last 30 days)
    growth_data = []
    for i in range(30):
        day = datetime.now(timezone.utc) - timedelta(days=29-i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)
        count = sum(1 for u in all_users if u.get("created_at") and day_start <= u["created_at"] <= day_end)
        growth_data.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "new_customers": count
        })
    
    # Get orders for customer spending analysis
    orders = await db.orders.find({"deleted_at": None}).to_list(100000)
    
    # Customer spending tiers
    customer_spending = {}
    for order in orders:
        cid = order.get("user_id")
        if cid:
            customer_spending[cid] = customer_spending.get(cid, 0) + order.get("total", 0)
    
    spending_tiers = {
        "high": sum(1 for v in customer_spending.values() if v >= 5000),
        "medium": sum(1 for v in customer_spending.values() if 1000 <= v < 5000),
        "low": sum(1 for v in customer_spending.values() if v < 1000),
    }
    
    # Repeat customers (ordered more than once)
    order_counts = {}
    for order in orders:
        cid = order.get("user_id")
        if cid:
            order_counts[cid] = order_counts.get(cid, 0) + 1
    
    repeat_customers = sum(1 for v in order_counts.values() if v > 1)
    one_time_customers = sum(1 for v in order_counts.values() if v == 1)
    
    # Subscribers
    subscribers = await db.subscribers.find({"deleted_at": None}).to_list(10000)
    
    return {
        "total_customers": len(all_users),
        "new_customers_in_period": len(filtered_users),
        "growth_data": growth_data,
        "spending_tiers": spending_tiers,
        "repeat_customers": repeat_customers,
        "one_time_customers": one_time_customers,
        "retention_rate": round((repeat_customers / len(order_counts) * 100) if order_counts else 0, 1),
        "total_subscribers": len(subscribers),
        "average_customer_value": round(sum(customer_spending.values()) / len(customer_spending) if customer_spending else 0, 2),
    }


# ==================== NEW: Product Analytics Endpoint ====================
@router.get("/products")
async def get_product_analytics(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get product performance analytics including best sellers and stock alerts"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    date_filter = {}
    if start_date:
        date_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
    if end_date:
        date_filter["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    
    order_query = {"deleted_at": None}
    if date_filter:
        order_query["created_at"] = date_filter
    
    # Get orders and products
    orders = await db.orders.find(order_query).to_list(100000)
    products = await db.products.find({"deleted_at": None}).to_list(100000)
    categories = await db.categories.find({"deleted_at": None}).to_list(1000)
    
    # Product sales analysis
    product_sales = {}
    for order in orders:
        for item in order.get("items", []):
            pid = item.get("product_id")
            if pid:
                if pid not in product_sales:
                    product_sales[pid] = {
                        "product_id": pid,
                        "product_name": item.get("product_name", "Unknown"),
                        "quantity_sold": 0,
                        "revenue": 0,
                        "orders_count": 0
                    }
                product_sales[pid]["quantity_sold"] += item.get("quantity", 1)
                product_sales[pid]["revenue"] += item.get("final_unit_price", item.get("price", 0)) * item.get("quantity", 1)
                product_sales[pid]["orders_count"] += 1
    
    # Top selling products
    top_by_quantity = sorted(product_sales.values(), key=lambda x: x["quantity_sold"], reverse=True)[:10]
    top_by_revenue = sorted(product_sales.values(), key=lambda x: x["revenue"], reverse=True)[:10]
    
    # Category performance
    category_map = {c["_id"]: c for c in categories}
    category_sales = {}
    for order in orders:
        for item in order.get("items", []):
            # Find product to get category
            prod = next((p for p in products if p["_id"] == item.get("product_id")), None)
            if prod and prod.get("category_id"):
                cat_id = prod["category_id"]
                if cat_id not in category_sales:
                    cat = category_map.get(cat_id, {})
                    category_sales[cat_id] = {
                        "category_id": cat_id,
                        "category_name": cat.get("name", "Unknown"),
                        "category_name_ar": cat.get("name_ar", "غير معروف"),
                        "quantity_sold": 0,
                        "revenue": 0
                    }
                category_sales[cat_id]["quantity_sold"] += item.get("quantity", 1)
                category_sales[cat_id]["revenue"] += item.get("final_unit_price", item.get("price", 0)) * item.get("quantity", 1)
    
    # Stock alerts
    low_stock = [serialize_doc(p) for p in products if (p.get("stock_quantity") or 0) < 10]
    out_of_stock = [serialize_doc(p) for p in products if (p.get("stock_quantity") or 0) == 0]
    
    # Never sold products
    sold_product_ids = set(product_sales.keys())
    never_sold = [serialize_doc(p) for p in products if p["_id"] not in sold_product_ids][:20]
    
    return {
        "total_products": len(products),
        "products_with_sales": len(product_sales),
        "top_by_quantity": top_by_quantity,
        "top_by_revenue": top_by_revenue,
        "category_performance": list(category_sales.values()),
        "low_stock_count": len(low_stock),
        "low_stock_products": low_stock[:10],
        "out_of_stock_count": len(out_of_stock),
        "out_of_stock_products": out_of_stock[:10],
        "never_sold_products": never_sold,
    }


# ==================== NEW: Order Analytics Endpoint ====================
@router.get("/orders")
async def get_order_analytics(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get detailed order analytics with various breakdowns"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    date_filter = {}
    if start_date:
        date_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
    if end_date:
        date_filter["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    
    order_query = {"deleted_at": None}
    if date_filter:
        order_query["created_at"] = date_filter
    
    orders = await db.orders.find(order_query).to_list(100000)
    
    # Orders by status
    status_breakdown = {}
    for status in ["pending", "preparing", "shipped", "out_for_delivery", "delivered", "cancelled"]:
        status_orders = [o for o in orders if o.get("status") == status]
        status_breakdown[status] = {
            "count": len(status_orders),
            "revenue": sum(o.get("total", 0) for o in status_orders)
        }
    
    # Orders by day of week
    day_of_week_orders = {i: {"count": 0, "revenue": 0} for i in range(7)}
    for order in orders:
        if order.get("created_at"):
            dow = order["created_at"].weekday()
            day_of_week_orders[dow]["count"] += 1
            day_of_week_orders[dow]["revenue"] += order.get("total", 0)
    
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_breakdown = [{"day": days[i], "count": day_of_week_orders[i]["count"], "revenue": day_of_week_orders[i]["revenue"]} for i in range(7)]
    
    # Orders by hour
    hour_orders = {i: 0 for i in range(24)}
    for order in orders:
        if order.get("created_at"):
            hour = order["created_at"].hour
            hour_orders[hour] += 1
    
    hourly_breakdown = [{"hour": h, "count": c} for h, c in hour_orders.items()]
    
    # Average fulfillment time (pending to delivered)
    fulfillment_times = []
    for order in orders:
        if order.get("status") == "delivered" and order.get("created_at") and order.get("updated_at"):
            diff = (order["updated_at"] - order["created_at"]).total_seconds() / 3600  # hours
            fulfillment_times.append(diff)
    
    avg_fulfillment = sum(fulfillment_times) / len(fulfillment_times) if fulfillment_times else 0
    
    # Payment methods breakdown
    payment_methods = {}
    for order in orders:
        pm = order.get("payment_method", "cash_on_delivery")
        if pm not in payment_methods:
            payment_methods[pm] = {"count": 0, "revenue": 0}
        payment_methods[pm]["count"] += 1
        payment_methods[pm]["revenue"] += order.get("total", 0)
    
    # Order source breakdown
    order_sources = {}
    for order in orders:
        source = order.get("order_source", "customer_app")
        if source not in order_sources:
            order_sources[source] = {"count": 0, "revenue": 0}
        order_sources[source]["count"] += 1
        order_sources[source]["revenue"] += order.get("total", 0)
    
    return {
        "total_orders": len(orders),
        "total_revenue": sum(o.get("total", 0) for o in orders),
        "average_order_value": round(sum(o.get("total", 0) for o in orders) / len(orders) if orders else 0, 2),
        "status_breakdown": status_breakdown,
        "day_of_week_breakdown": day_breakdown,
        "hourly_breakdown": hourly_breakdown,
        "average_fulfillment_hours": round(avg_fulfillment, 1),
        "payment_methods": payment_methods,
        "order_sources": order_sources,
    }


# ==================== NEW: Revenue Analytics Endpoint ====================
@router.get("/revenue")
async def get_revenue_analytics(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get comprehensive revenue analytics"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    date_filter = {}
    if start_date:
        date_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
    if end_date:
        date_filter["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    
    order_query = {"deleted_at": None}
    if date_filter:
        order_query["created_at"] = date_filter
    
    orders = await db.orders.find(order_query).to_list(100000)
    
    # Daily revenue for the period
    daily_revenue = {}
    for order in orders:
        if order.get("created_at"):
            day = order["created_at"].strftime("%Y-%m-%d")
            daily_revenue[day] = daily_revenue.get(day, 0) + order.get("total", 0)
    
    # Monthly revenue
    monthly_revenue = {}
    for order in orders:
        if order.get("created_at"):
            month = order["created_at"].strftime("%Y-%m")
            monthly_revenue[month] = monthly_revenue.get(month, 0) + order.get("total", 0)
    
    # Revenue by delivery status
    delivered_revenue = sum(o.get("total", 0) for o in orders if o.get("status") == "delivered")
    pending_revenue = sum(o.get("total", 0) for o in orders if o.get("status") in ["pending", "preparing", "shipped", "out_for_delivery"])
    cancelled_revenue = sum(o.get("total", 0) for o in orders if o.get("status") == "cancelled")
    
    # Discount analysis
    total_discount = 0
    bundle_discount = 0
    for order in orders:
        for item in order.get("items", []):
            original = item.get("original_unit_price", item.get("price", 0))
            final = item.get("final_unit_price", item.get("price", 0))
            qty = item.get("quantity", 1)
            discount = (original - final) * qty
            total_discount += max(0, discount)
            if item.get("bundle_group_id"):
                bundle_discount += max(0, discount)
    
    # Projected monthly revenue (based on current pace)
    if orders:
        earliest = min(o.get("created_at", datetime.now(timezone.utc)) for o in orders)
        days_span = max((datetime.now(timezone.utc) - earliest).days, 1)
        total_rev = sum(o.get("total", 0) for o in orders)
        daily_avg = total_rev / days_span
        projected_monthly = daily_avg * 30
    else:
        daily_avg = 0
        projected_monthly = 0
    
    return {
        "total_revenue": sum(o.get("total", 0) for o in orders),
        "delivered_revenue": delivered_revenue,
        "pending_revenue": pending_revenue,
        "cancelled_revenue": cancelled_revenue,
        "daily_revenue": [{"date": k, "revenue": v} for k, v in sorted(daily_revenue.items())],
        "monthly_revenue": [{"month": k, "revenue": v} for k, v in sorted(monthly_revenue.items())],
        "total_discount_given": round(total_discount, 2),
        "bundle_discount_given": round(bundle_discount, 2),
        "average_daily_revenue": round(daily_avg, 2),
        "projected_monthly_revenue": round(projected_monthly, 2),
    }


# ==================== NEW: Admin Performance Analytics ====================
@router.get("/admin-performance")
async def get_admin_performance(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get detailed admin/staff performance metrics"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    date_filter = {}
    if start_date:
        date_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
    if end_date:
        date_filter["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    
    order_query = {"deleted_at": None}
    if date_filter:
        order_query["created_at"] = date_filter
    
    orders = await db.orders.find(order_query).to_list(100000)
    products = await db.products.find({"deleted_at": None}).to_list(100000)
    admins = await db.admins.find({"deleted_at": None}).to_list(1000)
    
    # Map products to admins
    product_admin_map = {p["_id"]: p.get("added_by_admin_id") for p in products}
    admin_name_map = {a["_id"]: {"name": a.get("name", a.get("email", "Unknown")), "email": a.get("email")} for a in admins}
    
    # Admin sales performance
    admin_performance = {}
    for order in orders:
        for item in order.get("items", []):
            admin_id = product_admin_map.get(item.get("product_id"))
            if admin_id:
                if admin_id not in admin_performance:
                    admin_info = admin_name_map.get(admin_id, {})
                    admin_performance[admin_id] = {
                        "admin_id": admin_id,
                        "name": admin_info.get("name", "Unknown"),
                        "email": admin_info.get("email", ""),
                        "items_sold": 0,
                        "revenue": 0,
                        "orders_contributed": set(),
                        "products_count": 0,
                    }
                admin_performance[admin_id]["items_sold"] += item.get("quantity", 1)
                admin_performance[admin_id]["revenue"] += item.get("final_unit_price", item.get("price", 0)) * item.get("quantity", 1)
                admin_performance[admin_id]["orders_contributed"].add(order["_id"])
    
    # Count products per admin
    for product in products:
        admin_id = product.get("added_by_admin_id")
        if admin_id and admin_id in admin_performance:
            admin_performance[admin_id]["products_count"] += 1
    
    # Convert sets to counts and sort
    admin_list = []
    for admin_id, data in admin_performance.items():
        admin_list.append({
            "admin_id": data["admin_id"],
            "name": data["name"],
            "email": data["email"],
            "items_sold": data["items_sold"],
            "revenue": round(data["revenue"], 2),
            "orders_count": len(data["orders_contributed"]),
            "products_count": data["products_count"],
            "avg_revenue_per_order": round(data["revenue"] / len(data["orders_contributed"]) if data["orders_contributed"] else 0, 2),
        })
    
    # Sort by revenue
    admin_list.sort(key=lambda x: x["revenue"], reverse=True)
    
    # Admin assisted orders
    admin_assisted_orders = [o for o in orders if o.get("order_source") == "admin_assisted"]
    
    return {
        "admins_count": len(admins),
        "admins_with_sales": len(admin_performance),
        "admin_performance": admin_list,
        "admin_assisted_orders_count": len(admin_assisted_orders),
        "admin_assisted_revenue": sum(o.get("total", 0) for o in admin_assisted_orders),
    }
