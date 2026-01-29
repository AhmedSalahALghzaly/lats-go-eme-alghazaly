"""
Database Connection and Management
MongoDB with Motor async driver
"""
import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import settings
from datetime import datetime, timezone
import uuid

logger = logging.getLogger(__name__)

# Global database references
client: AsyncIOMotorClient = None
_db: AsyncIOMotorDatabase = None

class DatabaseProxy:
    """Proxy class that allows importing 'db' at module level but accessing the actual database at runtime"""
    def __getattr__(self, name):
        global _db
        if _db is None:
            raise RuntimeError("Database not connected. Call connect_to_mongo first.")
        return getattr(_db, name)
    
    def __getitem__(self, name):
        global _db
        if _db is None:
            raise RuntimeError("Database not connected. Call connect_to_mongo first.")
        return _db[name]

# This 'db' can be safely imported at module level
db = DatabaseProxy()

async def connect_to_mongo():
    """Connect to MongoDB and return database instance"""
    global client, _db
    client = AsyncIOMotorClient(settings.MONGO_URL)
    _db = client[settings.DB_NAME]
    logger.info(f"Connected to MongoDB - ALghazaly Auto Parts API v4.1")
    return _db

def get_database():
    """Get the database instance - for use in modules that need direct access"""
    return _db

async def close_mongo_connection():
    """Close MongoDB connection"""
    global client
    if client:
        client.close()
        logger.info("Closed MongoDB connection")

def get_db():
    """Get database instance"""
    return db

async def create_database_indexes():
    """
    Create indexes for frequently searched fields
    Improves query performance significantly
    """
    try:
        logger.info("Creating database indexes...")
        
        # Products indexes
        await db.products.create_index("deleted_at", background=True)
        await db.products.create_index("category_id", background=True)
        await db.products.create_index("product_brand_id", background=True)
        await db.products.create_index("car_model_ids", background=True)
        await db.products.create_index("price", background=True)
        await db.products.create_index("sku", background=True)
        await db.products.create_index("name", background=True)
        await db.products.create_index("hidden_status", background=True)
        await db.products.create_index([("deleted_at", 1), ("category_id", 1)], background=True)
        await db.products.create_index([("deleted_at", 1), ("product_brand_id", 1)], background=True)
        await db.products.create_index([("deleted_at", 1), ("car_model_ids", 1)], background=True)
        await db.products.create_index([("created_at", -1), ("_id", -1)], background=True)
        
        # Sessions indexes
        await db.sessions.create_index("session_token", background=True)
        await db.sessions.create_index("user_id", background=True)
        await db.sessions.create_index("expires_at", background=True)
        
        # Users indexes
        await db.users.create_index("email", background=True)
        
        # Orders indexes
        await db.orders.create_index("deleted_at", background=True)
        await db.orders.create_index("user_id", background=True)
        await db.orders.create_index("status", background=True)
        await db.orders.create_index("created_at", background=True)
        await db.orders.create_index([("deleted_at", 1), ("status", 1)], background=True)
        
        # Categories indexes
        await db.categories.create_index("deleted_at", background=True)
        await db.categories.create_index("parent_id", background=True)
        
        # Car Brands indexes
        await db.car_brands.create_index("deleted_at", background=True)
        await db.car_brands.create_index("name", background=True)
        
        # Car Models indexes
        await db.car_models.create_index("deleted_at", background=True)
        await db.car_models.create_index("brand_id", background=True)
        await db.car_models.create_index("chassis_number", background=True)
        await db.car_models.create_index([("deleted_at", 1), ("brand_id", 1)], background=True)
        await db.car_models.create_index([("deleted_at", 1), ("chassis_number", 1)], background=True)
        
        # Product Brands indexes
        await db.product_brands.create_index("deleted_at", background=True)
        await db.product_brands.create_index("name", background=True)
        
        # Partners, Admins, Subscribers indexes
        await db.partners.create_index("email", background=True)
        await db.partners.create_index("deleted_at", background=True)
        await db.admins.create_index("email", background=True)
        await db.admins.create_index("deleted_at", background=True)
        await db.subscribers.create_index("email", background=True)
        await db.subscribers.create_index("deleted_at", background=True)
        
        # Notifications indexes
        await db.notifications.create_index("user_id", background=True)
        await db.notifications.create_index("created_at", background=True)
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)], background=True)
        
        # Promotions indexes
        await db.promotions.create_index("deleted_at", background=True)
        await db.promotions.create_index("is_active", background=True)
        
        # Bundle offers indexes
        await db.bundle_offers.create_index("deleted_at", background=True)
        await db.bundle_offers.create_index("is_active", background=True)
        
        logger.info("Database indexes created successfully!")
        
    except Exception as e:
        logger.warning(f"Error creating some indexes: {e}")

async def seed_database():
    """Seed initial data for the application"""
    from datetime import datetime, timezone
    
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
        {"_id": "cm_corolla", "name": "Corolla", "name_ar": "كورولا", "brand_id": "cb_toyota", "year_from": 2015, "year_to": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_camry", "name": "Camry", "name_ar": "كامري", "brand_id": "cb_toyota", "year_from": 2015, "year_to": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_civic", "name": "Civic", "name_ar": "سيفيك", "brand_id": "cb_honda", "year_from": 2015, "year_to": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_accord", "name": "Accord", "name_ar": "أكورد", "brand_id": "cb_honda", "year_from": 2015, "year_to": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_elantra", "name": "Elantra", "name_ar": "النترا", "brand_id": "cb_hyundai", "year_from": 2015, "year_to": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
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
            "car_model_ids": ["cm_corolla", "cm_camry"],
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
            "car_model_ids": ["cm_corolla", "cm_civic", "cm_elantra"],
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
            "car_model_ids": ["cm_camry", "cm_accord"],
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
            "car_model_ids": ["cm_corolla", "cm_civic", "cm_elantra"],
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
            "car_model_ids": ["cm_camry", "cm_accord"],
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
            "car_model_ids": ["cm_corolla", "cm_civic"],
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
            "car_model_ids": ["cm_corolla", "cm_civic", "cm_elantra", "cm_camry"],
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
            "car_model_ids": ["cm_camry", "cm_accord"],
            "image_url": "https://images.unsplash.com/photo-1449130301044-6ecee2e1b47d?w=400",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted_at": None
        },
    ]
    await db.products.insert_many(products)
    
    # Seed promotions
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
    
    # Seed bundle offers
    bundle_offers = [
        {
            "_id": "bundle_1",
            "name": "Brake System Bundle",
            "name_ar": "حزمة نظام الفرامل",
            "description": "Complete brake system maintenance package",
            "description_ar": "حزمة صيانة نظام الفرامل الكاملة",
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
            "description": "Boost your engine performance",
            "description_ar": "عزز أداء محركك",
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
    
    logger.info("Database seeded successfully")
