"""
Pydantic Schemas for ALghazaly Auto Parts API
All request/response models
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# ==================== Car & Product Schemas ====================

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
    images: List[str] = []  # Multiple images support
    description: Optional[str] = None
    description_ar: Optional[str] = None
    variants: List[dict] = []
    chassis_number: Optional[str] = None  # VIN/Chassis Number for direct lookup
    catalog_pdf: Optional[str] = None  # Base64 encoded PDF or URL

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
    image_data: Optional[str] = None

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

# ==================== Cart Schemas ====================

class DiscountDetails(BaseModel):
    discount_type: str = "none"
    discount_value: float = 0
    discount_source_id: Optional[str] = None
    discount_source_name: Optional[str] = None

class CartItemAdd(BaseModel):
    product_id: str
    quantity: int = 1
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

# ==================== Order Schemas ====================

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

# ==================== User & Admin Schemas ====================

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
    contact_email: Optional[str] = None
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
    contact_email: Optional[str] = None
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
    email: str
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
    type: str = "info"

class SettleRevenueRequest(BaseModel):
    admin_id: str
    product_ids: List[str]
    total_amount: float

# ==================== Sync Schemas ====================

class SyncPullRequest(BaseModel):
    last_pulled_at: Optional[int] = None
    tables: List[str] = []

# ==================== Marketing Schemas ====================

class PromotionCreate(BaseModel):
    title: str
    title_ar: Optional[str] = None
    image: Optional[str] = None
    promotion_type: str = "slider"
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

# ==================== Admin/Deployment Schemas ====================

class VersionInfo(BaseModel):
    api_version: str
    build_date: str
    min_frontend_version: str
    features: List[str]

class ExportRequest(BaseModel):
    collections: Optional[List[str]] = None
    include_metadata: bool = True

class ImportRequest(BaseModel):
    data: Dict[str, Any]
    merge_strategy: str = "skip_existing"
