"""
Al-Ghazaly Auto Parts API - Advanced Owner Interface Backend
FastAPI + MongoDB + WebSockets
Unified Server-Side Cart System v4.0
"""
from fastapi import FastAPI, APIRouter, HTTPException, Response, Request, Query, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import json
import time

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="Al-Ghazaly Auto Parts API", version="4.0.0")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')
client: AsyncIOMotorClient = None
db = None

# Primary Owner Email
PRIMARY_OWNER_EMAIL = "pc.2025.ai@gmail.com"

# WebSocket Manager with notification support
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.anonymous_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket, user_id: str = None):
        await websocket.accept()
        if user_id:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)
        else:
            self.anonymous_connections.add(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: str = None):
        if user_id and user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
        else:
            self.anonymous_connections.discard(websocket)
    
    async def broadcast(self, message: dict):
        for connections in self.active_connections.values():
            for conn in connections:
                try:
                    await conn.send_json(message)
                except:
                    pass
        for conn in self.anonymous_connections:
            try:
                await conn.send_json(message)
            except:
                pass
    
    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for conn in self.active_connections[user_id]:
                try:
                    await conn.send_json(message)
                except:
                    pass
    
    async def send_notification(self, user_id: str, notification: dict):
        """Send real-time notification to specific user"""
        await self.send_to_user(user_id, {"type": "notification", "data": notification})

manager = ConnectionManager()

# ==================== Pydantic Schemas ====================

class CarBrandCreate(BaseModel):
    name: str
    name_ar: str
    logo: Optional[str] = None
    distributor_id: Optional[str] = None

class CarModelCreate(BaseModel):
    brand_id: str
    name: str
    name_ar: str
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    variants: List[dict] = []

class ProductBrandCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    logo: Optional[str] = None
    country_of_origin: Optional[str] = None
    country_of_origin_ar: Optional[str] = None
    supplier_id: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str
    name_ar: str
    parent_id: Optional[str] = None
    icon: Optional[str] = None
    image_data: Optional[str] = None  # Base64 image data for category

class ProductCreate(BaseModel):
    name: str
    name_ar: str
    description: Optional[str] = None
    description_ar: Optional[str] = None
    price: float
    sku: str
    product_brand_id: Optional[str] = None
    category_id: Optional[str] = None
    image_url: Optional[str] = None
    images: List[str] = []
    car_model_ids: List[str] = []
    stock_quantity: int = 0
    hidden_status: bool = False
    added_by_admin_id: Optional[str] = None

# ==================== Enhanced Cart Schema ====================

class DiscountDetails(BaseModel):
    discount_type: str = "none"  # none, bundle, promotion, admin_discount
    discount_value: float = 0  # Percentage or fixed amount
    discount_source_id: Optional[str] = None  # Bundle offer ID, Promotion ID, etc.
    discount_source_name: Optional[str] = None

class CartItemAdd(BaseModel):
    product_id: str
    quantity: int = 1
    # Enhanced fields for unified cart
    bundle_group_id: Optional[str] = None
    bundle_offer_id: Optional[str] = None
    bundle_discount_percentage: Optional[float] = None

class CartItemAddEnhanced(BaseModel):
    product_id: str
    quantity: int = 1
    original_unit_price: Optional[float] = None
    final_unit_price: Optional[float] = None
    discount_details: Optional[Dict[str, Any]] = None
    bundle_group_id: Optional[str] = None
    added_by_admin_id: Optional[str] = None

class OrderCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    street_address: str
    city: str
    state: str
    country: str = "Egypt"
    delivery_instructions: Optional[str] = None
    payment_method: str = "cash_on_delivery"
    notes: Optional[str] = None

class AdminAssistedOrderCreate(BaseModel):
    customer_id: str
    items: List[Dict[str, Any]]
    shipping_address: str
    phone: str
    notes: Optional[str] = None

class CommentCreate(BaseModel):
    text: str
    rating: Optional[int] = None

class FavoriteAdd(BaseModel):
    product_id: str

class PartnerCreate(BaseModel):
    email: str

class AdminCreate(BaseModel):
    email: str
    name: Optional[str] = None

class SupplierCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    profile_image: Optional[str] = None
    phone_numbers: List[str] = []
    address: Optional[str] = None
    address_ar: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    slider_images: List[str] = []
    website_url: Optional[str] = None
    linked_product_brand_ids: List[str] = []

class DistributorCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    profile_image: Optional[str] = None
    phone_numbers: List[str] = []
    address: Optional[str] = None
    address_ar: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    slider_images: List[str] = []
    website_url: Optional[str] = None
    linked_car_brand_ids: List[str] = []

class SubscriberCreate(BaseModel):
    email: str

class SubscriptionRequestCreate(BaseModel):
    customer_name: str
    phone: str
    governorate: str
    village: str
    address: str
    car_model: str
    description: Optional[str] = None

class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    type: str = "info"  # info, success, warning, error

class SettleRevenueRequest(BaseModel):
    admin_id: str
    product_ids: List[str]
    total_amount: float

class SyncPullRequest(BaseModel):
    last_pulled_at: Optional[int] = None
    tables: List[str] = []

# ==================== Marketing System Schemas ====================

class PromotionCreate(BaseModel):
    title: str
    title_ar: Optional[str] = None
    image: Optional[str] = None
    promotion_type: str = "slider"  # slider or banner
    is_active: bool = True
    target_product_id: Optional[str] = None
    target_car_model_id: Optional[str] = None
    sort_order: int = 0

class BundleOfferCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    discount_percentage: float
    target_car_model_id: Optional[str] = None
    product_ids: List[str] = []
    image: Optional[str] = None
    is_active: bool = True

# ==================== Helpers ====================

def get_timestamp_ms() -> int:
    return int(time.time() * 1000)

def serialize_doc(doc):
    if doc is None:
        return None
    doc = dict(doc)
    if '_id' in doc:
        doc['id'] = str(doc['_id'])
        del doc['_id']
    return doc

async def get_session_token(request: Request) -> Optional[str]:
    token = request.cookies.get("session_token")
    if token:
        return token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None

async def get_current_user(request: Request):
    token = await get_session_token(request)
    if not token:
        return None
    session = await db.sessions.find_one({"session_token": token})
    if not session:
        return None
    # Handle both timezone-aware and naive datetimes for expires_at comparison
    if session.get("expires_at"):
        expires_at = session["expires_at"]
        now = datetime.now(timezone.utc)
        # If expires_at is naive, make it timezone-aware (assume UTC)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= now:
            return None
    user = await db.users.find_one({"_id": session["user_id"]})
    return serialize_doc(user) if user else None

async def get_user_role(user):
    """Determine user role: owner, partner, admin, subscriber, or user"""
    if not user:
        return "guest"
    
    email = user.get("email", "")
    
    # Check if primary owner
    if email == PRIMARY_OWNER_EMAIL:
        return "owner"
    
    # Check if partner
    partner = await db.partners.find_one({"email": email, "deleted_at": None})
    if partner:
        return "partner"
    
    # Check if admin
    admin = await db.admins.find_one({"email": email, "deleted_at": None})
    if admin:
        return "admin"
    
    # Check if subscriber
    subscriber = await db.subscribers.find_one({"email": email, "deleted_at": None})
    if subscriber:
        return "subscriber"
    
    return "user"

async def create_notification(user_id: str, title: str, message: str, notif_type: str = "info"):
    """Create and broadcast a notification"""
    notification = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.notifications.insert_one(notification)
    await manager.send_notification(user_id, serialize_doc(notification))
    return notification

# ==================== Auth Routes ====================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client_http:
        try:
            auth_response = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            user_data = auth_response.json()
        except Exception as e:
            logger.error(f"Auth API error: {e}")
            raise HTTPException(status_code=500, detail="Authentication service error")
    
    user = await db.users.find_one({"email": user_data["email"]})
    if not user:
        user = {
            "_id": str(uuid.uuid4()),
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "is_admin": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)
    
    session = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "session_token": user_data["session_token"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    }
    await db.sessions.insert_one(session)
    
    # Get user role
    user_serialized = serialize_doc(user)
    role = await get_user_role(user_serialized)
    user_serialized["role"] = role
    
    response.set_cookie(key="session_token", value=session["session_token"], httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60)
    return {"user": user_serialized, "session_token": session["session_token"]}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user["role"] = await get_user_role(user)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = await get_session_token(request)
    if token:
        await db.sessions.delete_one({"session_token": token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ==================== Partner Routes ====================

@api_router.get("/partners")
async def get_partners(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    partners = await db.partners.find({"deleted_at": None}).to_list(1000)
    # Include primary owner in list
    owner_info = {"id": "owner", "email": PRIMARY_OWNER_EMAIL, "name": "Primary Owner", "is_owner": True}
    return [owner_info] + [serialize_doc(p) for p in partners]

@api_router.post("/partners")
async def add_partner(data: PartnerCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can add partners")
    
    existing = await db.partners.find_one({"email": data.email, "deleted_at": None})
    if existing:
        raise HTTPException(status_code=400, detail="Partner already exists")
    
    partner = {
        "_id": str(uuid.uuid4()),
        "email": data.email,
        "name": data.email.split("@")[0],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.partners.insert_one(partner)
    await manager.broadcast({"type": "sync", "tables": ["partners"]})
    return serialize_doc(partner)

@api_router.delete("/partners/{partner_id}")
async def delete_partner(partner_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can delete partners")
    
    await db.partners.update_one({"_id": partner_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["partners"]})
    return {"message": "Deleted"}

# ==================== Admin Routes ====================

@api_router.get("/admins/check-access")
async def check_admin_access(request: Request):
    """
    Bug Fix #3: Returns a list of admin emails for access control checks.
    This allows any authenticated user to verify if they are an admin.
    Only returns email addresses, not full admin data.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    admins = await db.admins.find({"deleted_at": None}).to_list(1000)
    # Return just the essential info for access checking
    return [{"id": a["_id"], "email": a.get("email", "")} for a in admins]

@api_router.get("/admins")
async def get_admins(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    admins = await db.admins.find({"deleted_at": None}).to_list(1000)
    result = []
    for admin in admins:
        admin_data = serialize_doc(admin)
        # Calculate stats for this admin
        products = await db.products.find({"added_by_admin_id": admin["_id"], "deleted_at": None}).to_list(10000)
        admin_data["products_added"] = len(products)
        
        product_ids = [p["_id"] for p in products]
        orders = await db.orders.find({"items.product_id": {"$in": product_ids}}).to_list(10000)
        delivered = sum(1 for o in orders if o.get("status") == "delivered")
        processing = sum(1 for o in orders if o.get("status") in ["pending", "preparing", "shipped", "out_for_delivery"])
        
        admin_data["products_delivered"] = delivered
        admin_data["products_processing"] = processing
        admin_data["revenue"] = admin.get("revenue", 0)
        
        # Count admin-assisted orders
        assisted_orders = await db.orders.count_documents({"order_source": "admin_assisted", "created_by_admin_id": admin["_id"]})
        admin_data["assisted_orders"] = assisted_orders
        
        result.append(admin_data)
    return result

@api_router.post("/admins")
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

@api_router.delete("/admins/{admin_id}")
async def delete_admin(admin_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.admins.update_one({"_id": admin_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["admins"]})
    return {"message": "Deleted"}

@api_router.get("/admins/{admin_id}/products")
async def get_admin_products(admin_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    products = await db.products.find({"added_by_admin_id": admin_id, "deleted_at": None}).to_list(10000)
    return [serialize_doc(p) for p in products]

@api_router.post("/admins/{admin_id}/settle")
async def settle_admin_revenue(admin_id: str, data: SettleRevenueRequest, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Mark products as settled
    await db.products.update_many(
        {"_id": {"$in": data.product_ids}},
        {"$set": {"settled": True, "settled_at": datetime.now(timezone.utc)}}
    )
    
    # Add to settled collection
    settlement = {
        "_id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "product_ids": data.product_ids,
        "amount": data.total_amount,
        "settled_by": user["id"] if user else None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.settlements.insert_one(settlement)
    
    # Update admin revenue
    await db.admins.update_one({"_id": admin_id}, {"$inc": {"revenue": data.total_amount}})
    
    # Create notification
    admin = await db.admins.find_one({"_id": admin_id})
    if admin:
        await create_notification(
            user["id"] if user else "system",
            "Revenue Settled",
            f"Admin {admin.get('name', admin.get('email'))} settled revenue of {data.total_amount} EGP",
            "success"
        )
    
    await manager.broadcast({"type": "sync", "tables": ["admins", "products", "settlements"]})
    return {"message": "Settled", "amount": data.total_amount}

@api_router.post("/admins/{admin_id}/clear-revenue")
async def clear_admin_revenue(admin_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.admins.update_one({"_id": admin_id}, {"$set": {"revenue": 0}})
    await manager.broadcast({"type": "sync", "tables": ["admins"]})
    return {"message": "Revenue cleared"}

# ==================== Supplier Routes ====================

@api_router.get("/suppliers")
async def get_suppliers(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    # Subscribers and above can view suppliers
    if role not in ["owner", "partner", "admin", "subscriber"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    suppliers = await db.suppliers.find({"deleted_at": None}).to_list(1000)
    return [serialize_doc(s) for s in suppliers]

@api_router.get("/suppliers/{supplier_id}")
async def get_supplier(supplier_id: str, request: Request):
    supplier = await db.suppliers.find_one({"_id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return serialize_doc(supplier)

@api_router.post("/suppliers")
async def create_supplier(data: SupplierCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    supplier = {
        "_id": str(uuid.uuid4()),
        **data.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.suppliers.insert_one(supplier)
    
    # Update linked product brands
    if data.linked_product_brand_ids:
        await db.product_brands.update_many(
            {"_id": {"$in": data.linked_product_brand_ids}},
            {"$set": {"supplier_id": supplier["_id"]}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["suppliers", "product_brands"]})
    return serialize_doc(supplier)

@api_router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, data: SupplierCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Clear old brand links
    await db.product_brands.update_many({"supplier_id": supplier_id}, {"$set": {"supplier_id": None}})
    
    # Update supplier
    await db.suppliers.update_one(
        {"_id": supplier_id},
        {"$set": {**data.dict(), "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Set new brand links
    if data.linked_product_brand_ids:
        await db.product_brands.update_many(
            {"_id": {"$in": data.linked_product_brand_ids}},
            {"$set": {"supplier_id": supplier_id}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["suppliers", "product_brands"]})
    return {"message": "Updated"}

@api_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Clear brand links
    await db.product_brands.update_many({"supplier_id": supplier_id}, {"$set": {"supplier_id": None}})
    
    await db.suppliers.update_one({"_id": supplier_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["suppliers", "product_brands"]})
    return {"message": "Deleted"}

# ==================== Distributor Routes ====================

@api_router.get("/distributors")
async def get_distributors(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin", "subscriber"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    distributors = await db.distributors.find({"deleted_at": None}).to_list(1000)
    return [serialize_doc(d) for d in distributors]

@api_router.get("/distributors/{distributor_id}")
async def get_distributor(distributor_id: str, request: Request):
    distributor = await db.distributors.find_one({"_id": distributor_id})
    if not distributor:
        raise HTTPException(status_code=404, detail="Distributor not found")
    return serialize_doc(distributor)

@api_router.post("/distributors")
async def create_distributor(data: DistributorCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    distributor = {
        "_id": str(uuid.uuid4()),
        **data.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.distributors.insert_one(distributor)
    
    # Update linked car brands
    if data.linked_car_brand_ids:
        await db.car_brands.update_many(
            {"_id": {"$in": data.linked_car_brand_ids}},
            {"$set": {"distributor_id": distributor["_id"]}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["distributors", "car_brands"]})
    return serialize_doc(distributor)

@api_router.put("/distributors/{distributor_id}")
async def update_distributor(distributor_id: str, data: DistributorCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.car_brands.update_many({"distributor_id": distributor_id}, {"$set": {"distributor_id": None}})
    
    await db.distributors.update_one(
        {"_id": distributor_id},
        {"$set": {**data.dict(), "updated_at": datetime.now(timezone.utc)}}
    )
    
    if data.linked_car_brand_ids:
        await db.car_brands.update_many(
            {"_id": {"$in": data.linked_car_brand_ids}},
            {"$set": {"distributor_id": distributor_id}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["distributors", "car_brands"]})
    return {"message": "Updated"}

@api_router.delete("/distributors/{distributor_id}")
async def delete_distributor(distributor_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.car_brands.update_many({"distributor_id": distributor_id}, {"$set": {"distributor_id": None}})
    await db.distributors.update_one({"_id": distributor_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["distributors", "car_brands"]})
    return {"message": "Deleted"}

# ==================== Subscriber Routes ====================

@api_router.get("/subscribers")
async def get_subscribers(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    subscribers = await db.subscribers.find({"deleted_at": None}).to_list(1000)
    return [serialize_doc(s) for s in subscribers]

@api_router.post("/subscribers")
async def add_subscriber(data: SubscriberCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    existing = await db.subscribers.find_one({"email": data.email, "deleted_at": None})
    if existing:
        raise HTTPException(status_code=400, detail="Subscriber already exists")
    
    subscriber = {
        "_id": str(uuid.uuid4()),
        "email": data.email,
        "name": data.email.split("@")[0],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.subscribers.insert_one(subscriber)
    await manager.broadcast({"type": "sync", "tables": ["subscribers"]})
    return serialize_doc(subscriber)

@api_router.delete("/subscribers/{subscriber_id}")
async def delete_subscriber(subscriber_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.subscribers.update_one({"_id": subscriber_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["subscribers"]})
    return {"message": "Deleted"}

# ==================== Subscription Request Routes ====================

@api_router.get("/subscription-requests")
async def get_subscription_requests(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    requests = await db.subscription_requests.find({"deleted_at": None}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(r) for r in requests]

@api_router.post("/subscription-requests")
async def create_subscription_request(data: SubscriptionRequestCreate):
    """Public endpoint for users to submit subscription requests"""
    request_doc = {
        "_id": str(uuid.uuid4()),
        **data.dict(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.subscription_requests.insert_one(request_doc)
    
    # Send notification to owner
    owner = await db.users.find_one({"email": PRIMARY_OWNER_EMAIL})
    if owner:
        await create_notification(
            str(owner["_id"]),
            "New Subscription Request",
            f"New subscription request from {data.customer_name}",
            "info"
        )
    
    await manager.broadcast({"type": "sync", "tables": ["subscription_requests"]})
    return serialize_doc(request_doc)

@api_router.patch("/subscription-requests/{request_id}/approve")
async def approve_subscription_request(request_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.subscription_requests.update_one(
        {"_id": request_id},
        {"$set": {"status": "approved", "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Approved"}

@api_router.delete("/subscription-requests/{request_id}")
async def delete_subscription_request(request_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.subscription_requests.update_one({"_id": request_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    return {"message": "Deleted"}

# ==================== Notification Routes ====================

@api_router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    notifications = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(50).to_list(50)
    return [serialize_doc(n) for n in notifications]

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.notifications.update_one(
        {"_id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Marked as read"}

@api_router.post("/notifications/mark-all-read")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All marked as read"}

# ==================== Enhanced Analytics Routes ====================

@api_router.get("/analytics/overview")
async def get_analytics_overview(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Build date filter
    date_filter = {}
    if start_date:
        date_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
    if end_date:
        date_filter["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    
    order_query = {}
    if date_filter:
        order_query["created_at"] = date_filter
    
    # Get orders
    orders = await db.orders.find(order_query).to_list(100000)
    
    # Calculate metrics
    total_orders = len(orders)
    total_revenue = sum(o.get("total", 0) for o in orders)
    delivered_orders = [o for o in orders if o.get("status") == "delivered"]
    delivered_revenue = sum(o.get("total", 0) for o in delivered_orders)
    aov = total_revenue / total_orders if total_orders > 0 else 0
    
    # Orders by status
    status_counts = {}
    for status in ["pending", "preparing", "shipped", "out_for_delivery", "delivered", "cancelled"]:
        status_counts[status] = sum(1 for o in orders if o.get("status") == status)
    
    # ==================== NEW: Order Source Analytics ====================
    customer_app_orders = sum(1 for o in orders if o.get("order_source", "customer_app") == "customer_app")
    admin_assisted_orders = sum(1 for o in orders if o.get("order_source") == "admin_assisted")
    
    order_source_breakdown = {
        "customer_app": customer_app_orders,
        "admin_assisted": admin_assisted_orders,
        "customer_app_percentage": round((customer_app_orders / total_orders * 100) if total_orders > 0 else 0, 1),
        "admin_assisted_percentage": round((admin_assisted_orders / total_orders * 100) if total_orders > 0 else 0, 1),
    }
    
    # ==================== NEW: Discount & Bundle Performance ====================
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
            
            # Calculate discount
            discount = (original_price - final_price) * quantity
            total_discount_value += max(0, discount)
            
            # Check if bundle item
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
    
    # Top products
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
    
    # Revenue over time (last 30 days)
    revenue_by_day = {}
    for order in orders:
        day = order.get("created_at").strftime("%Y-%m-%d") if order.get("created_at") else "Unknown"
        revenue_by_day[day] = revenue_by_day.get(day, 0) + order.get("total", 0)
    
    # Sales by admin
    admin_sales = {}
    products = await db.products.find({}).to_list(100000)
    product_admin_map = {p["_id"]: p.get("added_by_admin_id") for p in products}
    
    for order in orders:
        for item in order.get("items", []):
            admin_id = product_admin_map.get(item.get("product_id"))
            if admin_id:
                if admin_id not in admin_sales:
                    admin_sales[admin_id] = {"count": 0, "revenue": 0}
                admin_sales[admin_id]["count"] += item.get("quantity", 1)
                admin_sales[admin_id]["revenue"] += item.get("final_unit_price", item.get("price", 0)) * item.get("quantity", 1)
    
    # Get admin names
    admins = await db.admins.find({}).to_list(1000)
    admin_name_map = {a["_id"]: a.get("name", a.get("email", "Unknown")) for a in admins}
    
    sales_by_admin = [
        {"admin_id": aid, "name": admin_name_map.get(aid, "Unknown"), **data}
        for aid, data in admin_sales.items()
    ]
    
    # Recent customers
    recent_customers = await db.users.find({}).sort("created_at", -1).limit(5).to_list(5)
    
    # Low stock products
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

# ==================== Collection Routes ====================

@api_router.get("/collections")
async def get_collections(request: Request, admin_id: Optional[str] = None):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {"settled": True}
    if admin_id:
        query["added_by_admin_id"] = admin_id
    
    products = await db.products.find(query).to_list(10000)
    
    # Add admin info to each product
    admins = await db.admins.find({}).to_list(1000)
    admin_map = {a["_id"]: serialize_doc(a) for a in admins}
    
    result = []
    for p in products:
        p_data = serialize_doc(p)
        p_data["admin"] = admin_map.get(p.get("added_by_admin_id"))
        result.append(p_data)
    
    return result

# ==================== Car Brand Routes ====================

@api_router.get("/car-brands")
async def get_car_brands():
    brands = await db.car_brands.find({"deleted_at": None}).sort("name", 1).to_list(1000)
    result = []
    for b in brands:
        b_data = serialize_doc(b)
        # Include distributor info if linked
        if b.get("distributor_id"):
            distributor = await db.distributors.find_one({"_id": b["distributor_id"]})
            b_data["distributor"] = serialize_doc(distributor) if distributor else None
        result.append(b_data)
    return result

@api_router.post("/car-brands")
async def create_car_brand(brand: CarBrandCreate):
    doc = {"_id": f"cb_{uuid.uuid4().hex[:8]}", **brand.dict(), "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.car_brands.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["car_brands"]})
    return serialize_doc(doc)

@api_router.delete("/car-brands/{brand_id}")
async def delete_car_brand(brand_id: str):
    await db.car_brands.update_one({"_id": brand_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["car_brands"]})
    return {"message": "Deleted"}

# ==================== Car Model Routes ====================

@api_router.get("/car-models")
async def get_car_models(brand_id: Optional[str] = None):
    query = {"deleted_at": None}
    if brand_id:
        query["brand_id"] = brand_id
    models = await db.car_models.find(query).sort("name", 1).to_list(1000)
    return [serialize_doc(m) for m in models]

@api_router.get("/car-models/{model_id}")
async def get_car_model(model_id: str):
    model = await db.car_models.find_one({"_id": model_id})
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    model_data = serialize_doc(model)
    # Check for both brand_id and car_brand_id for compatibility
    brand_id = model.get("brand_id") or model.get("car_brand_id")
    if brand_id:
        brand = await db.car_brands.find_one({"_id": brand_id})
        model_data["brand"] = serialize_doc(brand) if brand else None
    # Search for products with this car model in both field names for compatibility
    products = await db.products.find({
        "$or": [
            {"car_model_ids": model_id},
            {"compatible_car_models": model_id}
        ],
        "deleted_at": None
    }).to_list(100)
    model_data["compatible_products"] = [serialize_doc(p) for p in products]
    model_data["compatible_products_count"] = len(products)
    return model_data

@api_router.post("/car-models")
async def create_car_model(model: CarModelCreate):
    doc = {"_id": f"cm_{uuid.uuid4().hex[:8]}", **model.dict(), "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.car_models.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return serialize_doc(doc)

@api_router.put("/car-models/{model_id}")
async def update_car_model(model_id: str, model: CarModelCreate):
    await db.car_models.update_one({"_id": model_id}, {"$set": {**model.dict(), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return {"message": "Updated"}

@api_router.delete("/car-models/{model_id}")
async def delete_car_model(model_id: str):
    await db.car_models.update_one({"_id": model_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return {"message": "Deleted"}

# ==================== Product Brand Routes ====================

@api_router.get("/product-brands")
async def get_product_brands():
    brands = await db.product_brands.find({"deleted_at": None}).sort("name", 1).to_list(1000)
    result = []
    for b in brands:
        b_data = serialize_doc(b)
        if b.get("supplier_id"):
            supplier = await db.suppliers.find_one({"_id": b["supplier_id"]})
            b_data["supplier"] = serialize_doc(supplier) if supplier else None
        result.append(b_data)
    return result

@api_router.post("/product-brands")
async def create_product_brand(brand: ProductBrandCreate):
    doc = {"_id": f"pb_{uuid.uuid4().hex[:8]}", **brand.dict(), "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.product_brands.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["product_brands"]})
    return serialize_doc(doc)

@api_router.delete("/product-brands/{brand_id}")
async def delete_product_brand(brand_id: str):
    await db.product_brands.update_one({"_id": brand_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["product_brands"]})
    return {"message": "Deleted"}

# ==================== Category Routes ====================

@api_router.get("/categories")
async def get_categories(parent_id: Optional[str] = None):
    query = {"deleted_at": None}
    if parent_id is None:
        query["parent_id"] = None
    else:
        query["parent_id"] = parent_id
    categories = await db.categories.find(query).sort([("sort_order", 1), ("name", 1)]).to_list(1000)
    return [serialize_doc(c) for c in categories]

@api_router.get("/categories/all")
async def get_all_categories():
    categories = await db.categories.find({"deleted_at": None}).sort([("sort_order", 1), ("name", 1)]).to_list(1000)
    return [serialize_doc(c) for c in categories]

@api_router.get("/categories/tree")
async def get_categories_tree():
    categories = await db.categories.find({"deleted_at": None}).sort([("sort_order", 1), ("name", 1)]).to_list(1000)
    all_cats = [serialize_doc(c) for c in categories]
    cats_by_id = {c["id"]: {**c, "children": []} for c in all_cats}
    root = []
    for c in all_cats:
        if c.get("parent_id") and c["parent_id"] in cats_by_id:
            cats_by_id[c["parent_id"]]["children"].append(cats_by_id[c["id"]])
        elif not c.get("parent_id"):
            root.append(cats_by_id[c["id"]])
    return root

@api_router.post("/categories")
async def create_category(category: CategoryCreate):
    logger.info(f"Creating category: {category.name}, image_data present: {bool(category.image_data)}")
    doc = {"_id": f"cat_{uuid.uuid4().hex[:8]}", **category.dict(), "sort_order": 0, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.categories.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["categories"]})
    return serialize_doc(doc)

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str):
    await db.categories.update_one({"_id": cat_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["categories"]})
    return {"message": "Deleted"}

# ==================== Product Routes ====================

@api_router.get("/products")
async def get_products(category_id: Optional[str] = None, product_brand_id: Optional[str] = None, car_model_id: Optional[str] = None, car_brand_id: Optional[str] = None, min_price: Optional[float] = None, max_price: Optional[float] = None, skip: int = 0, limit: int = 50, include_hidden: bool = False):
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
    products = await db.products.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Fetch all product brands and car models for enrichment
    all_product_brands = await db.product_brands.find({"deleted_at": None}).to_list(1000)
    all_car_models = await db.car_models.find({"deleted_at": None}).to_list(1000)
    
    # Create lookup maps
    brand_map = {b["_id"]: serialize_doc(b) for b in all_product_brands}
    car_model_map = {m["_id"]: serialize_doc(m) for m in all_car_models}
    
    # Enrich products with brand and car model details
    enriched_products = []
    for p in products:
        product_data = serialize_doc(p)
        
        # Add product brand details
        if p.get("product_brand_id") and p["product_brand_id"] in brand_map:
            brand = brand_map[p["product_brand_id"]]
            product_data["product_brand_name"] = brand.get("name", "")
            product_data["product_brand_name_ar"] = brand.get("name_ar", "")
            product_data["manufacturer_country"] = brand.get("country_of_origin", "")
            product_data["manufacturer_country_ar"] = brand.get("country_of_origin_ar", "")
        
        # Add first compatible car model details
        if p.get("car_model_ids") and len(p["car_model_ids"]) > 0:
            first_model_id = p["car_model_ids"][0]
            if first_model_id in car_model_map:
                car_model = car_model_map[first_model_id]
                product_data["compatible_car_model"] = car_model.get("name", "")
                product_data["compatible_car_model_ar"] = car_model.get("name_ar", "")
                product_data["compatible_car_models_count"] = len(p["car_model_ids"])
        
        enriched_products.append(product_data)
    
    return {"products": enriched_products, "total": total}

@api_router.get("/products/search")
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

@api_router.get("/products/all")
async def get_all_products():
    products = await db.products.find({"deleted_at": None}).sort("created_at", -1).to_list(10000)
    
    # Fetch all product brands and car models for enrichment
    all_product_brands = await db.product_brands.find({"deleted_at": None}).to_list(1000)
    all_car_models = await db.car_models.find({"deleted_at": None}).to_list(1000)
    
    # Create lookup maps
    brand_map = {b["_id"]: serialize_doc(b) for b in all_product_brands}
    car_model_map = {m["_id"]: serialize_doc(m) for m in all_car_models}
    
    # Enrich products with brand and car model details
    enriched_products = []
    for p in products:
        product_data = serialize_doc(p)
        
        # Add product brand details
        if p.get("product_brand_id") and p["product_brand_id"] in brand_map:
            brand = brand_map[p["product_brand_id"]]
            product_data["product_brand_name"] = brand.get("name", "")
            product_data["product_brand_name_ar"] = brand.get("name_ar", "")
            product_data["manufacturer_country"] = brand.get("country_of_origin", "")
            product_data["manufacturer_country_ar"] = brand.get("country_of_origin_ar", "")
        
        # Add first compatible car model details
        if p.get("car_model_ids") and len(p["car_model_ids"]) > 0:
            first_model_id = p["car_model_ids"][0]
            if first_model_id in car_model_map:
                car_model = car_model_map[first_model_id]
                product_data["compatible_car_model"] = car_model.get("name", "")
                product_data["compatible_car_model_ar"] = car_model.get("name_ar", "")
                product_data["compatible_car_models_count"] = len(p["car_model_ids"])
        
        enriched_products.append(product_data)
    
    return {"products": enriched_products, "total": len(enriched_products)}

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    p = serialize_doc(product)
    if p.get("product_brand_id"):
        brand = await db.product_brands.find_one({"_id": p["product_brand_id"]})
        p["product_brand"] = serialize_doc(brand)
    if p.get("category_id"):
        cat = await db.categories.find_one({"_id": p["category_id"]})
        p["category"] = serialize_doc(cat)
    if p.get("car_model_ids"):
        models = await db.car_models.find({"_id": {"$in": p["car_model_ids"]}}).to_list(100)
        p["car_models"] = [serialize_doc(m) for m in models]
    return p

@api_router.post("/products")
async def create_product(product: ProductCreate, request: Request):
    user = await get_current_user(request)
    admin_id = None
    if user:
        admin = await db.admins.find_one({"email": user.get("email"), "deleted_at": None})
        if admin:
            admin_id = admin["_id"]
    
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
    return serialize_doc(doc)

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, product: ProductCreate):
    await db.products.update_one({"_id": product_id}, {"$set": {**product.dict(), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Updated"}

@api_router.patch("/products/{product_id}/price")
async def update_product_price(product_id: str, data: dict):
    await db.products.update_one({"_id": product_id}, {"$set": {"price": data.get("price"), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Price updated"}

@api_router.patch("/products/{product_id}/hidden")
async def update_product_hidden(product_id: str, data: dict):
    await db.products.update_one({"_id": product_id}, {"$set": {"hidden_status": data.get("hidden_status"), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Updated"}

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    await db.products.update_one({"_id": product_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Deleted"}

# ==================== Enhanced Cart Routes (Server-Side Cart) ====================

@api_router.get("/cart")
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
            
            # Get pricing from cart item (server-side source of truth)
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

@api_router.post("/cart/add")
async def add_to_cart(item: CartItemAdd, request: Request):
    """Add item to cart with full pricing stored server-side"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get product details for pricing
    product = await db.products.find_one({"_id": item.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Calculate pricing
    original_price = product["price"]
    final_price = original_price
    discount_details = {"discount_type": "none", "discount_value": 0}
    
    # Apply bundle discount if provided
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
        # Check if item exists (same product and bundle group)
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
            # Update quantity
            await db.carts.update_one(
                {"user_id": user["id"]},
                {
                    "$inc": {f"items.{existing_idx}.quantity": item.quantity},
                    "$set": {"updated_at": datetime.now(timezone.utc)}
                }
            )
        else:
            # Add new item
            await db.carts.update_one(
                {"user_id": user["id"]},
                {
                    "$push": {"items": cart_item},
                    "$set": {"updated_at": datetime.now(timezone.utc)}
                }
            )
    
    return {"message": "Added", "item": cart_item}

@api_router.put("/cart/update")
async def update_cart(item: CartItemAdd, request: Request):
    """Update cart item quantity"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if item.quantity <= 0:
        # Remove item
        await db.carts.update_one(
            {"user_id": user["id"]},
            {
                "$pull": {"items": {"product_id": item.product_id}},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
    else:
        # Update quantity
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

@api_router.post("/cart/add-enhanced")
async def add_to_cart_enhanced(item: CartItemAddEnhanced, request: Request):
    """Add item to cart with all pricing pre-calculated (for admin-assisted orders)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get product to validate
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

@api_router.delete("/cart/clear")
async def clear_cart(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"items": [], "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Cleared"}

@api_router.delete("/cart/void-bundle/{bundle_group_id}")
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
            # Remove bundle info, restore original price
            item["final_unit_price"] = item.get("original_unit_price", item["final_unit_price"])
            item["discount_details"] = {"discount_type": "none", "discount_value": 0}
            item["bundle_group_id"] = None
        updated_items.append(item)
    
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"items": updated_items, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Bundle voided"}

# ==================== Enhanced Order Routes ====================

@api_router.get("/orders")
async def get_orders(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    orders = await db.orders.find({"user_id": user["id"]}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(o) for o in orders]

@api_router.get("/orders/all")
async def get_all_orders(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    orders = await db.orders.find({}).sort("created_at", -1).to_list(10000)
    return {"orders": [serialize_doc(o) for o in orders], "total": len(orders)}

@api_router.post("/orders")
async def create_order(order_data: OrderCreate, request: Request):
    """Create order using server-side cart prices (Unified Cart System)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart empty")
    
    # IMPORTANT: Use prices from cart, not from products collection
    subtotal = 0
    total_discount = 0
    order_items = []
    
    for item in cart["items"]:
        product = await db.products.find_one({"_id": item["product_id"]})
        if product:
            # Use cart prices (server-side source of truth)
            original_price = item.get("original_unit_price", product["price"])
            final_price = item.get("final_unit_price", product["price"])
            quantity = item["quantity"]
            
            item_original_total = original_price * quantity
            item_final_total = final_price * quantity
            item_discount = item_original_total - item_final_total
            
            subtotal += item_original_total
            total_discount += item_discount
            
            order_items.append({
                "product_id": item["product_id"],
                "product_name": product["name"],
                "product_name_ar": product.get("name_ar"),
                "quantity": quantity,
                # Enhanced pricing fields
                "original_unit_price": original_price,
                "final_unit_price": final_price,
                "price": final_price,  # Legacy field for compatibility
                "discount_details": item.get("discount_details", {}),
                "bundle_group_id": item.get("bundle_group_id"),
                "added_by_admin_id": item.get("added_by_admin_id"),
                "image_url": product.get("image_url")
            })
    
    shipping = 150.0
    final_total = (subtotal - total_discount) + shipping
    
    order = {
        "_id": str(uuid.uuid4()),
        "order_number": f"ORD-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}",
        "user_id": user["id"],
        "customer_name": f"{order_data.first_name} {order_data.last_name}",
        "customer_email": order_data.email,
        "phone": order_data.phone,
        # Enhanced financial fields
        "subtotal": round(subtotal, 2),
        "total_discount": round(total_discount, 2),
        "shipping_cost": shipping,
        "total": round(final_total, 2),
        "status": "pending",
        "payment_method": order_data.payment_method,
        "notes": order_data.notes,
        # Order source tracking
        "order_source": "customer_app",
        "created_by_admin_id": None,
        "delivery_address": {
            "street_address": order_data.street_address,
            "city": order_data.city,
            "state": order_data.state,
            "country": order_data.country,
            "delivery_instructions": order_data.delivery_instructions
        },
        "items": order_items,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.orders.insert_one(order)
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    
    # Notify owner about new order
    owner = await db.users.find_one({"email": PRIMARY_OWNER_EMAIL})
    if owner:
        await create_notification(
            str(owner["_id"]),
            "New Order",
            f"New order #{order['order_number'][:20]} from {order['customer_name']}",
            "info"
        )
    
    await manager.broadcast({"type": "sync", "tables": ["orders"]})
    return serialize_doc(order)

@api_router.post("/orders/admin-assisted")
async def create_admin_assisted_order(data: AdminAssistedOrderCreate, request: Request):
    """Create order on behalf of a customer (Admin-Assisted Order)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get customer
    customer = await db.users.find_one({"_id": data.customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get admin info
    admin = await db.admins.find_one({"email": user.get("email")})
    admin_id = admin["_id"] if admin else user["id"]
    
    # Build order items
    subtotal = 0
    total_discount = 0
    order_items = []
    
    for item_data in data.items:
        product = await db.products.find_one({"_id": item_data["product_id"]})
        if product:
            original_price = item_data.get("original_unit_price", product["price"])
            final_price = item_data.get("final_unit_price", product["price"])
            quantity = item_data.get("quantity", 1)
            
            item_original_total = original_price * quantity
            item_final_total = final_price * quantity
            item_discount = item_original_total - item_final_total
            
            subtotal += item_original_total
            total_discount += item_discount
            
            order_items.append({
                "product_id": item_data["product_id"],
                "product_name": product["name"],
                "product_name_ar": product.get("name_ar"),
                "quantity": quantity,
                "original_unit_price": original_price,
                "final_unit_price": final_price,
                "price": final_price,
                "discount_details": item_data.get("discount_details", {}),
                "bundle_group_id": item_data.get("bundle_group_id"),
                "added_by_admin_id": admin_id,
                "image_url": product.get("image_url")
            })
    
    shipping = 150.0
    final_total = (subtotal - total_discount) + shipping
    
    order = {
        "_id": str(uuid.uuid4()),
        "order_number": f"ADM-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}",
        "user_id": data.customer_id,
        "customer_name": customer.get("name", customer.get("email")),
        "customer_email": customer.get("email"),
        "phone": data.phone,
        "subtotal": round(subtotal, 2),
        "total_discount": round(total_discount, 2),
        "shipping_cost": shipping,
        "total": round(final_total, 2),
        "status": "pending",
        "payment_method": "cash_on_delivery",
        "notes": data.notes,
        # Admin-assisted order tracking
        "order_source": "admin_assisted",
        "created_by_admin_id": admin_id,
        "delivery_address": {
            "street_address": data.shipping_address,
            "city": "",
            "state": "",
            "country": "Egypt",
        },
        "items": order_items,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    
    await db.orders.insert_one(order)
    
    # Notify owner
    owner = await db.users.find_one({"email": PRIMARY_OWNER_EMAIL})
    if owner:
        await create_notification(
            str(owner["_id"]),
            "Admin-Assisted Order",
            f"New admin-assisted order #{order['order_number'][:20]} created by {user.get('name', user.get('email'))}",
            "info"
        )
    
    await manager.broadcast({"type": "sync", "tables": ["orders"]})
    return serialize_doc(order)

@api_router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, request: Request):
    # Authentication check
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    valid = ["pending", "preparing", "shipped", "out_for_delivery", "delivered", "cancelled", "complete"]
    if status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.orders.update_one({"_id": order_id}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}})
    
    # Send notification to customer about order status change
    customer_id = order.get("user_id")
    order_number = order.get("order_number", order_id)[:20]
    
    status_messages = {
        "pending": {"en": "Your order has been received", "ar": "تم استلام طلبك"},
        "preparing": {"en": "Your order is being prepared", "ar": "جاري تحضير طلبك"},
        "shipped": {"en": "Your order has been shipped", "ar": "تم شحن طلبك"},
        "out_for_delivery": {"en": "Your order is out for delivery", "ar": "طلبك في الطريق إليك"},
        "delivered": {"en": "Your order has been delivered", "ar": "تم توصيل طلبك بنجاح"},
        "cancelled": {"en": "Your order has been cancelled", "ar": "تم إلغاء طلبك"},
    }
    
    msg = status_messages.get(status, {"en": f"Order status: {status}", "ar": f"حالة الطلب: {status}"})
    
    if customer_id:
        await create_notification(
            customer_id,
            f"طلب #{order_number}",
            msg["ar"],
            "info" if status not in ["delivered", "cancelled"] else ("success" if status == "delivered" else "warning"),
            {"order_id": order_id, "status": status, "type": "order_status"}
        )
    
    # Send notification for delivered orders to owner
    if status == "delivered":
        owner = await db.users.find_one({"email": PRIMARY_OWNER_EMAIL})
        if owner:
            await create_notification(
                str(owner["_id"]),
                "Order Delivered",
                f"Order #{order_number} has been delivered",
                "success"
            )
    
    await manager.broadcast({"type": "order_update", "order_id": order_id, "status": status, "user_id": customer_id})
    return {"message": "Updated", "status": status}

# ==================== Customers Routes ====================

@api_router.get("/customers")
async def get_customers(request: Request, sort_by: str = "created_at"):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    # Allow owners, partners, and admins to access customer data
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    customers = await db.users.find({"deleted_at": None}).to_list(10000)
    result = []
    
    for customer in customers:
        c_data = serialize_doc(customer)
        # Get order stats
        orders = await db.orders.find({"user_id": customer["_id"]}).to_list(10000)
        c_data["total_orders"] = len(orders)
        c_data["total_spent"] = sum(o.get("total", 0) for o in orders)
        c_data["total_items"] = sum(sum(i.get("quantity", 1) for i in o.get("items", [])) for o in orders)
        
        # Status indicators
        c_data["has_processing"] = any(o.get("status") in ["pending", "preparing"] for o in orders)
        c_data["has_shipped"] = any(o.get("status") in ["shipped", "out_for_delivery"] for o in orders)
        c_data["has_cancelled"] = any(o.get("status") == "cancelled" for o in orders)
        
        result.append(c_data)
    
    # Sort
    if sort_by == "total_items":
        result.sort(key=lambda x: x["total_items"], reverse=True)
    elif sort_by == "total_spent":
        result.sort(key=lambda x: x["total_spent"], reverse=True)
    else:
        result.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {"customers": result, "total": len(result)}

@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    # Allow owners, partners, and admins to access customer data
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    customer = await db.users.find_one({"_id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Not found")
    
    c_data = serialize_doc(customer)
    orders = await db.orders.find({"user_id": customer_id}).sort("created_at", -1).to_list(10000)
    c_data["orders"] = [serialize_doc(o) for o in orders]
    c_data["total_spent"] = sum(o.get("total", 0) for o in orders)
    c_data["total_orders"] = len(orders)
    
    return c_data

# ==================== Admin Customer Management Routes ====================

@api_router.get("/admin/customer/{user_id}/favorites")
async def get_customer_favorites_admin(user_id: str, request: Request):
    """Get customer's favorites (admin view)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    favs = await db.favorites.find({"user_id": user_id, "deleted_at": None}).to_list(1000)
    result = []
    for f in favs:
        product = await db.products.find_one({"_id": f["product_id"]})
        if product:
            result.append({**serialize_doc(f), "product": serialize_doc(product)})
    return {"favorites": result, "total": len(result)}

@api_router.get("/admin/customer/{user_id}/cart")
async def get_customer_cart_admin(user_id: str, request: Request):
    """Get customer's cart (admin view)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    cart = await db.carts.find_one({"user_id": user_id})
    if not cart:
        return {"items": [], "total": 0}
    
    items = cart.get("items", [])
    result_items = []
    for item in items:
        product = await db.products.find_one({"_id": item.get("product_id")})
        if product:
            result_items.append({
                **item,
                "product": serialize_doc(product)
            })
    
    return {"items": result_items, "total": len(result_items)}

@api_router.get("/admin/customer/{user_id}/orders")
async def get_customer_orders_admin(user_id: str, request: Request):
    """Get customer's orders (admin view)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    orders = await db.orders.find({"user_id": user_id}).sort("created_at", -1).to_list(10000)
    result = []
    for o in orders:
        order_data = serialize_doc(o)
        # Get order items with product details
        items = order_data.get("items", [])
        enriched_items = []
        for item in items:
            product = await db.products.find_one({"_id": item.get("product_id")})
            if product:
                enriched_items.append({**item, "product": serialize_doc(product)})
            else:
                enriched_items.append(item)
        order_data["items"] = enriched_items
        result.append(order_data)
    
    return {"orders": result, "total": len(result)}

@api_router.patch("/admin/customer/{user_id}/orders/mark-viewed")
async def mark_customer_orders_viewed(user_id: str, request: Request):
    """Mark all customer orders as viewed by admin"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.orders.update_many(
        {"user_id": user_id, "admin_viewed": {"$ne": True}},
        {"$set": {"admin_viewed": True, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"success": True}

@api_router.get("/orders/pending-count/{user_id}")
async def get_pending_order_count(user_id: str, request: Request):
    """Get count of pending orders for a customer"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    count = await db.orders.count_documents({
        "user_id": user_id,
        "status": {"$in": ["pending", "preparing"]},
        "admin_viewed": {"$ne": True}
    })
    return {"count": count}

class AdminOrderCreate(BaseModel):
    user_id: str
    first_name: str
    last_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: str
    street_address: str
    city: str
    state: Optional[str] = ""
    country: Optional[str] = "Egypt"
    delivery_instructions: Optional[str] = ""
    payment_method: Optional[str] = "cash_on_delivery"
    notes: Optional[str] = ""
    items: List[dict]

@api_router.post("/admin/orders/create")
async def create_admin_order(data: AdminOrderCreate, request: Request):
    """Create order on behalf of a customer (admin)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not data.items or len(data.items) == 0:
        raise HTTPException(status_code=400, detail="No items in order")
    
    # Get customer info
    customer = await db.users.find_one({"_id": data.user_id})
    customer_name = f"{data.first_name} {data.last_name}".strip() or (customer.get("name") if customer else "Unknown")
    
    # Build order items with pricing
    order_items = []
    subtotal = 0
    for item in data.items:
        product = await db.products.find_one({"_id": item.get("product_id")})
        if product:
            price = product.get("price", 0)
            quantity = item.get("quantity", 1)
            line_total = price * quantity
            subtotal += line_total
            order_items.append({
                "product_id": product["_id"],
                "product_name": product.get("name"),
                "product_name_ar": product.get("name_ar"),
                "sku": product.get("sku"),
                "quantity": quantity,
                "original_unit_price": price,
                "final_unit_price": price,
                "line_total": line_total
            })
    
    shipping_cost = 150  # Fixed shipping cost
    total = subtotal + shipping_cost
    
    # Generate order number
    order_count = await db.orders.count_documents({})
    order_number = f"ORD-{order_count + 1:06d}"
    
    order_doc = {
        "_id": str(uuid.uuid4()),
        "order_number": order_number,
        "user_id": data.user_id,
        "customer_name": customer_name,
        "customer_email": data.email or (customer.get("email") if customer else ""),
        "customer_phone": data.phone,
        "shipping_address": f"{data.street_address}, {data.city}, {data.state}, {data.country}".strip(", "),
        "delivery_instructions": data.delivery_instructions,
        "payment_method": data.payment_method,
        "items": order_items,
        "subtotal": subtotal,
        "shipping_cost": shipping_cost,
        "discount": 0,
        "total": total,
        "status": "pending",
        "order_source": "admin_assisted",
        "created_by_admin_id": user["id"],
        "admin_viewed": True,
        "notes": data.notes,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.orders.insert_one(order_doc)
    
    return serialize_doc(order_doc)

@api_router.get("/admin/orders/{order_id}")
async def get_admin_order_detail(order_id: str, request: Request):
    """Get order details - accessible by admin, owner, partner, and order owner"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Allow access if user is admin/owner/partner OR if user owns this order
    is_admin_role = role in ["owner", "partner", "admin"]
    is_order_owner = user and order.get("user_id") == user.get("id")
    
    if not is_admin_role and not is_order_owner:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Enrich items with product details if not present
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
    
    # Add delivery_address structure if needed
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


@api_router.patch("/orders/{order_id}/discount")
async def update_order_discount(order_id: str, request: Request):
    """Update order discount (OWNER ONLY)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    
    # Only owner can modify discounts
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can modify discounts")
    
    body = await request.json()
    discount = body.get("discount", 0)
    
    if discount < 0:
        raise HTTPException(status_code=400, detail="Discount cannot be negative")
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Calculate new total
    subtotal = order.get("subtotal", 0)
    shipping = order.get("shipping_cost", 150)
    new_total = subtotal + shipping - discount
    
    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {
            "discount": discount,
            "total": new_total,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    await manager.broadcast({"type": "sync", "tables": ["orders"]})
    return {"message": "Discount updated", "discount": discount, "total": new_total}


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, request: Request):
    """Delete an order (OWNER ONLY - hard delete)"""
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    # Only owner can permanently delete orders
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can delete orders")
    
    # Get order details before deletion for analytics update
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    result = await db.orders.delete_one({"_id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Broadcast to update analytics in real-time
    await manager.broadcast({"type": "order_deleted", "order_id": order_id, "order_total": order.get("total", 0)})
    await manager.broadcast({"type": "sync", "tables": ["orders", "analytics"]})
    
    return {"success": True, "message": "Order permanently deleted"}

# ==================== Favorites Routes ====================

@api_router.get("/favorites")
async def get_favorites(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    favs = await db.favorites.find({"user_id": user["id"], "deleted_at": None}).to_list(1000)
    result = []
    for f in favs:
        product = await db.products.find_one({"_id": f["product_id"]})
        if product:
            result.append({**serialize_doc(f), "product": serialize_doc(product)})
    return {"favorites": result, "total": len(result)}

@api_router.get("/favorites/check/{product_id}")
async def check_favorite(product_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    fav = await db.favorites.find_one({"user_id": user["id"], "product_id": product_id, "deleted_at": None})
    return {"is_favorite": fav is not None}

@api_router.post("/favorites/toggle")
async def toggle_favorite(data: FavoriteAdd, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    existing = await db.favorites.find_one({"user_id": user["id"], "product_id": data.product_id})
    if existing:
        if existing.get("deleted_at"):
            await db.favorites.update_one({"_id": existing["_id"]}, {"$set": {"deleted_at": None, "updated_at": datetime.now(timezone.utc)}})
            return {"is_favorite": True}
        else:
            await db.favorites.update_one({"_id": existing["_id"]}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
            return {"is_favorite": False}
    else:
        await db.favorites.insert_one({"_id": str(uuid.uuid4()), "user_id": user["id"], "product_id": data.product_id, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None})
        return {"is_favorite": True}

# ==================== Comments Routes ====================

@api_router.get("/products/{product_id}/comments")
async def get_comments(product_id: str, request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request)
    user_id = user["id"] if user else None
    comments = await db.comments.find({"product_id": product_id, "deleted_at": None}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    pipeline = [{"$match": {"product_id": product_id, "deleted_at": None, "rating": {"$ne": None}}}, {"$group": {"_id": None, "count": {"$sum": 1}, "avg": {"$avg": "$rating"}}}]
    stats = await db.comments.aggregate(pipeline).to_list(1)
    avg_rating = round(stats[0]["avg"], 1) if stats and stats[0].get("avg") else None
    rating_count = stats[0]["count"] if stats else 0
    return {"comments": [{**serialize_doc(c), "is_owner": c.get("user_id") == user_id} for c in comments], "total": len(comments), "avg_rating": avg_rating, "rating_count": rating_count}

@api_router.post("/products/{product_id}/comments")
async def add_comment(product_id: str, data: CommentCreate, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if data.rating and (data.rating < 1 or data.rating > 5):
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    comment = {"_id": str(uuid.uuid4()), "product_id": product_id, "user_id": user["id"], "user_name": user["name"], "user_picture": user.get("picture"), "text": data.text, "rating": data.rating, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.comments.insert_one(comment)
    return {**serialize_doc(comment), "is_owner": True}

# ==================== Promotion Routes (Marketing System) ====================

@api_router.get("/promotions")
async def get_promotions(promotion_type: Optional[str] = None, active_only: bool = True):
    query = {"deleted_at": None}
    if promotion_type:
        query["promotion_type"] = promotion_type
    if active_only:
        query["is_active"] = True
    promotions = await db.promotions.find(query).sort("sort_order", 1).to_list(100)
    return [serialize_doc(p) for p in promotions]

@api_router.get("/promotions/{promotion_id}")
async def get_promotion(promotion_id: str):
    promotion = await db.promotions.find_one({"_id": promotion_id})
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return serialize_doc(promotion)

@api_router.post("/promotions")
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
    return serialize_doc(doc)

@api_router.put("/promotions/{promotion_id}")
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

@api_router.patch("/promotions/{promotion_id}/reorder")
async def reorder_promotion(promotion_id: str, data: dict, request: Request):
    await db.promotions.update_one(
        {"_id": promotion_id},
        {"$set": {"sort_order": data.get("sort_order", 0), "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Reordered"}

@api_router.delete("/promotions/{promotion_id}")
async def delete_promotion(promotion_id: str, request: Request):
    logger.info(f"DELETE /promotions/{promotion_id} - Starting deletion request")
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    logger.info(f"DELETE /promotions/{promotion_id} - User: {user.get('email') if user else 'None'}, Role: {role}")
    
    if role not in ["owner", "partner", "admin"]:
        logger.warning(f"DELETE /promotions/{promotion_id} - Access denied for role: {role}")
        raise HTTPException(status_code=403, detail=f"Access denied. Role '{role}' is not authorized.")
    
    # Permanent deletion with cascading
    promotion = await db.promotions.find_one({"_id": promotion_id})
    if not promotion:
        logger.warning(f"DELETE /promotions/{promotion_id} - Promotion not found")
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    # Delete the promotion permanently
    result = await db.promotions.delete_one({"_id": promotion_id})
    logger.info(f"DELETE /promotions/{promotion_id} - Deleted count: {result.deleted_count}")
    
    await manager.broadcast({"type": "sync", "tables": ["promotions"]})
    return {"message": "Promotion deleted permanently", "deleted_id": promotion_id}

# ==================== Bundle Offer Routes ====================

@api_router.get("/bundle-offers")
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

@api_router.get("/bundle-offers/{offer_id}")
async def get_bundle_offer(offer_id: str):
    offer = await db.bundle_offers.find_one({"_id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Bundle offer not found")
    offer_data = serialize_doc(offer)
    if offer.get("product_ids"):
        products = await db.products.find({"_id": {"$in": offer["product_ids"]}}).to_list(100)
        offer_data["products"] = [serialize_doc(p) for p in products]
    return offer_data

@api_router.post("/bundle-offers")
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
    return serialize_doc(doc)

@api_router.put("/bundle-offers/{offer_id}")
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

@api_router.delete("/bundle-offers/{offer_id}")
async def delete_bundle_offer(offer_id: str, request: Request):
    logger.info(f"DELETE /bundle-offers/{offer_id} - Starting deletion request")
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    logger.info(f"DELETE /bundle-offers/{offer_id} - User: {user.get('email') if user else 'None'}, Role: {role}")
    
    if role not in ["owner", "partner", "admin"]:
        logger.warning(f"DELETE /bundle-offers/{offer_id} - Access denied for role: {role}")
        raise HTTPException(status_code=403, detail=f"Access denied. Role '{role}' is not authorized.")
    
    # Check if bundle offer exists
    offer = await db.bundle_offers.find_one({"_id": offer_id})
    if not offer:
        logger.warning(f"DELETE /bundle-offers/{offer_id} - Bundle offer not found")
        raise HTTPException(status_code=404, detail="Bundle offer not found")
    
    # Cascading deletion: Remove any cart items that reference this bundle
    # Remove bundle group references from cart items
    await db.carts.update_many(
        {"items.bundle_group_id": offer_id},
        {"$pull": {"items": {"bundle_group_id": offer_id}}}
    )
    
    # Delete the bundle offer permanently
    result = await db.bundle_offers.delete_one({"_id": offer_id})
    logger.info(f"DELETE /bundle-offers/{offer_id} - Deleted count: {result.deleted_count}")
    
    await manager.broadcast({"type": "sync", "tables": ["bundle_offers", "carts"]})
    return {"message": "Bundle offer deleted permanently", "deleted_id": offer_id}

# ==================== Marketing Home Slider ====================

@api_router.get("/marketing/home-slider")
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
        # Get target product details if specified
        target_product = None
        if promo.get("target_product_id"):
            target_product = await db.products.find_one({"_id": promo["target_product_id"]})
        
        # Get target car model details if specified
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
        # Calculate bundle totals from associated products
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
    
    # Sort by sort_order
    slider_items.sort(key=lambda x: x.get("sort_order", 0))
    return slider_items

# ==================== Sync Routes ====================

@api_router.post("/sync/pull")
async def sync_pull(data: SyncPullRequest):
    result = {}
    tables = data.tables or ["car_brands", "car_models", "product_brands", "categories", "products"]
    
    for table in tables:
        collection = db[table]
        query = {"deleted_at": None}
        if data.last_pulled_at:
            query["updated_at"] = {"$gt": datetime.fromtimestamp(data.last_pulled_at / 1000, tz=timezone.utc)}
        
        docs = await collection.find(query).to_list(10000)
        result[table] = [serialize_doc(d) for d in docs]
    
    return {
        "data": result,
        "timestamp": get_timestamp_ms()
    }

# ==================== WebSocket ====================

@api_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, user_id: Optional[str] = None):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

# ==================== Health Check ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "database": "mongodb", "version": "4.0.0"}

# ==================== App Setup ====================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.on_event("startup")
async def startup_db_client():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    logger.info(f"Connected to MongoDB - Unified Cart System Backend v4.0")
    
    # Seed initial data if needed
    existing_brands = await db.car_brands.count_documents({})
    if existing_brands == 0:
        logger.info("Seeding database...")
        await seed_database()
        logger.info("Database seeded successfully")
    
    # Seed promotions and bundle offers if needed (may need to seed separately)
    existing_promotions = await db.promotions.count_documents({})
    existing_bundles = await db.bundle_offers.count_documents({})
    if existing_promotions == 0:
        logger.info("Seeding promotions...")
        promotions = [
            {
                "_id": "promo_1",
                "title": "Summer Brake Special",
                "title_ar": "عرض فرامل الصيف",
                "image": "https://customer-assets.emergentagent.com/job_run-al-project/artifacts/04kxu3h3_car-brake-parts-and-components-displayed-on-a-whit-2025-12-08-16-53-24-utc.jpg",
                "promotion_type": "slider",
                "is_active": True,
                "target_product_id": "prod_2",
                "target_car_model_id": None,
                "sort_order": 0,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "deleted_at": None,
            },
            {
                "_id": "promo_2",
                "title": "Engine Parts Sale",
                "title_ar": "تخفيضات قطع المحرك",
                "image": "https://customer-assets.emergentagent.com/job_run-al-project/artifacts/e0wpx2r9_car-parts-2025-02-25-15-02-08-utc.jpg",
                "promotion_type": "slider",
                "is_active": True,
                "target_product_id": None,
                "target_car_model_id": "cm_corolla",
                "sort_order": 1,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "deleted_at": None,
            },
        ]
        await db.promotions.insert_many(promotions)
    
    if existing_bundles == 0:
        logger.info("Seeding bundle offers...")
        bundle_offers = [
            {
                "_id": "bundle_1",
                "name": "Brake System Bundle",
                "name_ar": "حزمة نظام الفرامل",
                "description": "Complete brake system maintenance package - includes brake pads and disc rotor",
                "description_ar": "حزمة صيانة نظام الفرامل الكاملة - تشمل تيل الفرامل والطارة",
                "discount_percentage": 15,
                "target_car_model_id": "cm_corolla",
                "product_ids": ["prod_2", "prod_8"],
                "image": "https://customer-assets.emergentagent.com/job_run-al-project/artifacts/04kxu3h3_car-brake-parts-and-components-displayed-on-a-whit-2025-12-08-16-53-24-utc.jpg",
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "deleted_at": None,
            },
            {
                "_id": "bundle_2",
                "name": "Engine Performance Pack",
                "name_ar": "حزمة أداء المحرك",
                "description": "Boost your engine performance with this essential combo",
                "description_ar": "عزز أداء محركك مع هذه الحزمة الأساسية",
                "discount_percentage": 12,
                "target_car_model_id": "cm_camry",
                "product_ids": ["prod_1", "prod_4", "prod_6"],
                "image": "https://customer-assets.emergentagent.com/job_run-al-project/artifacts/e0wpx2r9_car-parts-2025-02-25-15-02-08-utc.jpg",
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "deleted_at": None,
            },
            {
                "_id": "bundle_3",
                "name": "Electrical Essentials",
                "name_ar": "أساسيات الكهرباء",
                "description": "Keep your electrical system running smoothly",
                "description_ar": "حافظ على عمل نظامك الكهربائي بسلاسة",
                "discount_percentage": 10,
                "target_car_model_id": "cm_civic",
                "product_ids": ["prod_5", "prod_7"],
                "image": "https://customer-assets.emergentagent.com/job_run-al-project/artifacts/yt3zfrnf_car-parts-2025-02-24-20-10-48-utc%20%282%29.jpg",
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "deleted_at": None,
            },
        ]
        await db.bundle_offers.insert_many(bundle_offers)

@app.on_event("shutdown")
async def shutdown_db_client():
    global client
    if client:
        client.close()

async def seed_database():
    """Seed initial data for the application"""
    # Seed car brands
    car_brands = [
        {"_id": "cb_toyota", "name": "Toyota", "name_ar": "تويوتا", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cb_honda", "name": "Honda", "name_ar": "هوندا", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cb_nissan", "name": "Nissan", "name_ar": "نيسان", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cb_hyundai", "name": "Hyundai", "name_ar": "هيونداي", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cb_kia", "name": "Kia", "name_ar": "كيا", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ]
    await db.car_brands.insert_many(car_brands)
    
    # Seed categories
    categories = [
        {"_id": "cat_engine", "name": "Engine Parts", "name_ar": "قطع المحرك", "icon": "engine", "parent_id": None, "sort_order": 1, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_brakes", "name": "Brakes", "name_ar": "الفرامل", "icon": "disc", "parent_id": None, "sort_order": 2, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_suspension", "name": "Suspension", "name_ar": "نظام التعليق", "icon": "car", "parent_id": None, "sort_order": 3, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_electrical", "name": "Electrical", "name_ar": "الكهربائيات", "icon": "flash", "parent_id": None, "sort_order": 4, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_body", "name": "Body Parts", "name_ar": "قطع الهيكل", "icon": "car-sport", "parent_id": None, "sort_order": 5, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ]
    await db.categories.insert_many(categories)

    # Seed product brands
    product_brands = [
        {"_id": "pb_denso", "name": "Denso", "name_ar": "دينسو", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "pb_bosch", "name": "Bosch", "name_ar": "بوش", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "pb_aisin", "name": "Aisin", "name_ar": "آيسن", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "pb_ngk", "name": "NGK", "name_ar": "إن جي كي", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ]
    await db.product_brands.insert_many(product_brands)

    # Seed car models
    car_models = [
        {"_id": "cm_corolla", "name": "Corolla", "name_ar": "كورولا", "car_brand_id": "cb_toyota", "year_from": 2015, "year_to": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_camry", "name": "Camry", "name_ar": "كامري", "car_brand_id": "cb_toyota", "year_from": 2015, "year_to": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_civic", "name": "Civic", "name_ar": "سيفيك", "car_brand_id": "cb_honda", "year_from": 2015, "year_to": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_accord", "name": "Accord", "name_ar": "أكورد", "car_brand_id": "cb_honda", "year_from": 2015, "year_to": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_elantra", "name": "Elantra", "name_ar": "النترا", "car_brand_id": "cb_hyundai", "year_from": 2015, "year_to": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ]
    await db.car_models.insert_many(car_models)

    # Seed sample products
    products = [
        {
            "_id": "prod_1",
            "name": "Premium Oil Filter",
            "name_ar": "فلتر زيت ممتاز",
            "description": "High-quality oil filter for Toyota Corolla",
            "description_ar": "فلتر زيت عالي الجودة لسيارة تويوتا كورولا",
            "price": 85.00,
            "stock_quantity": 50,
            "sku": "OIL-FLT-001",
            "category_id": "cat_engine",
            "product_brand_id": "pb_denso",
            "compatible_car_models": ["cm_corolla", "cm_camry"],
            "image_url": "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        },
        {
            "_id": "prod_2",
            "name": "Brake Pads Set",
            "name_ar": "طقم تيل فرامل",
            "description": "Ceramic brake pads for safe stopping",
            "description_ar": "تيل فرامل سيراميك للتوقف الآمن",
            "price": 250.00,
            "stock_quantity": 30,
            "sku": "BRK-PAD-001",
            "category_id": "cat_brakes",
            "product_brand_id": "pb_bosch",
            "compatible_car_models": ["cm_corolla", "cm_civic", "cm_elantra"],
            "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        },
        {
            "_id": "prod_3",
            "name": "Shock Absorber",
            "name_ar": "ممتص صدمات",
            "description": "Heavy-duty shock absorber for smooth ride",
            "description_ar": "ممتص صدمات قوي لقيادة سلسة",
            "price": 450.00,
            "stock_quantity": 20,
            "sku": "SUS-SHK-001",
            "category_id": "cat_suspension",
            "product_brand_id": "pb_aisin",
            "compatible_car_models": ["cm_camry", "cm_accord"],
            "image_url": "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        },
        {
            "_id": "prod_4",
            "name": "Spark Plugs (4 Pack)",
            "name_ar": "بوجيهات (عدد 4)",
            "description": "Iridium spark plugs for better performance",
            "description_ar": "بوجيهات إيريديوم لأداء أفضل",
            "price": 180.00,
            "stock_quantity": 100,
            "sku": "ENG-SPK-001",
            "category_id": "cat_engine",
            "product_brand_id": "pb_ngk",
            "compatible_car_models": ["cm_corolla", "cm_civic", "cm_elantra"],
            "image_url": "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=400",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        },
        {
            "_id": "prod_5",
            "name": "Alternator",
            "name_ar": "دينامو",
            "description": "High-output alternator for electrical system",
            "description_ar": "دينامو عالي الإنتاج للنظام الكهربائي",
            "price": 850.00,
            "stock_quantity": 15,
            "sku": "ELC-ALT-001",
            "category_id": "cat_electrical",
            "product_brand_id": "pb_denso",
            "compatible_car_models": ["cm_camry", "cm_accord"],
            "image_url": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        },
        {
            "_id": "prod_6",
            "name": "Air Filter",
            "name_ar": "فلتر هواء",
            "description": "High-flow air filter for better engine breathing",
            "description_ar": "فلتر هواء عالي التدفق لتنفس أفضل للمحرك",
            "price": 65.00,
            "stock_quantity": 75,
            "sku": "ENG-AIR-001",
            "category_id": "cat_engine",
            "product_brand_id": "pb_bosch",
            "compatible_car_models": ["cm_corolla", "cm_civic"],
            "image_url": "https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=400",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        },
        {
            "_id": "prod_7",
            "name": "Headlight Bulb LED",
            "name_ar": "لمبة فانوس LED",
            "description": "Bright LED headlight bulbs",
            "description_ar": "لمبات فانوس LED ساطعة",
            "price": 120.00,
            "stock_quantity": 60,
            "sku": "ELC-LED-001",
            "category_id": "cat_electrical",
            "product_brand_id": "pb_bosch",
            "compatible_car_models": ["cm_corolla", "cm_civic", "cm_elantra", "cm_camry"],
            "image_url": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        },
        {
            "_id": "prod_8",
            "name": "Brake Disc Rotor",
            "name_ar": "طارة فرامل",
            "description": "Ventilated brake disc rotor",
            "description_ar": "طارة فرامل مهواة",
            "price": 320.00,
            "stock_quantity": 25,
            "sku": "BRK-DSC-001",
            "category_id": "cat_brakes",
            "product_brand_id": "pb_aisin",
            "compatible_car_models": ["cm_camry", "cm_accord"],
            "image_url": "https://images.unsplash.com/photo-1449130301044-6ecee2e1b47d?w=400",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        },
    ]
    await db.products.insert_many(products)

async def seed_marketing_data():
    """Seed promotions and bundle offers"""
    # Seed promotions if not exist
    existing_promotions = await db.promotions.count_documents({})
    if existing_promotions == 0:
        promotions = [
            {
                "_id": "promo_1",
                "title": "Summer Brake Special",
                "title_ar": "عرض فرامل الصيف",
                "image": "https://customer-assets.emergentagent.com/job_run-al-project/artifacts/04kxu3h3_car-brake-parts-and-components-displayed-on-a-whit-2025-12-08-16-53-24-utc.jpg",
                "promotion_type": "slider",
                "is_active": True,
                "target_product_id": "prod_2",
                "target_car_model_id": None,
                "sort_order": 0,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "deleted_at": None,
            },
            {
                "_id": "promo_2",
                "title": "Engine Parts Sale",
                "title_ar": "تخفيضات قطع المحرك",
                "image": "https://customer-assets.emergentagent.com/job_run-al-project/artifacts/e0wpx2r9_car-parts-2025-02-25-15-02-08-utc.jpg",
                "promotion_type": "slider",
                "is_active": True,
                "target_product_id": None,
                "target_car_model_id": "cm_corolla",
                "sort_order": 1,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "deleted_at": None,
            },
        ]
        await db.promotions.insert_many(promotions)

    # Seed bundle offers if not exist
    existing_bundles = await db.bundle_offers.count_documents({})
    if existing_bundles == 0:
        bundle_offers = [
            {
                "_id": "bundle_1",
                "name": "Brake System Bundle",
                "name_ar": "حزمة نظام الفرامل",
                "description": "Complete brake system maintenance package - includes brake pads and disc rotor",
                "description_ar": "حزمة صيانة نظام الفرامل الكاملة - تشمل تيل الفرامل والطارة",
                "discount_percentage": 15,
                "target_car_model_id": "cm_corolla",
                "product_ids": ["prod_2", "prod_8"],
                "image": "https://customer-assets.emergentagent.com/job_run-al-project/artifacts/04kxu3h3_car-brake-parts-and-components-displayed-on-a-whit-2025-12-08-16-53-24-utc.jpg",
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "deleted_at": None,
            },
            {
                "_id": "bundle_2",
                "name": "Engine Performance Pack",
                "name_ar": "حزمة أداء المحرك",
                "description": "Boost your engine performance with this essential combo",
                "description_ar": "عزز أداء محركك مع هذه الحزمة الأساسية",
                "discount_percentage": 12,
                "target_car_model_id": "cm_camry",
                "product_ids": ["prod_1", "prod_4", "prod_6"],
                "image": "https://customer-assets.emergentagent.com/job_run-al-project/artifacts/e0wpx2r9_car-parts-2025-02-25-15-02-08-utc.jpg",
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "deleted_at": None,
            },
            {
                "_id": "bundle_3",
                "name": "Electrical Essentials",
                "name_ar": "أساسيات الكهرباء",
                "description": "Keep your electrical system running smoothly",
                "description_ar": "حافظ على عمل نظامك الكهربائي بسلاسة",
                "discount_percentage": 10,
                "target_car_model_id": "cm_civic",
                "product_ids": ["prod_5", "prod_7"],
                "image": "https://customer-assets.emergentagent.com/job_run-al-project/artifacts/yt3zfrnf_car-parts-2025-02-24-20-10-48-utc%20%282%29.jpg",
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "deleted_at": None,
            },
        ]
        await db.bundle_offers.insert_many(bundle_offers)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
