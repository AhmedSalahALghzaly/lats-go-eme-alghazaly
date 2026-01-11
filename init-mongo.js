// Al-Ghazaly Auto Parts - MongoDB Initialization Script
// This script runs when MongoDB container starts for the first time

// Switch to application database
db = db.getSiblingDB('alghazaly_autoparts');

// Create application user with read/write permissions
db.createUser({
    user: 'app_user',
    pwd: 'app_password_change_in_production',
    roles: [
        { role: 'readWrite', db: 'alghazaly_autoparts' }
    ]
});

print('✅ Created application user');

// Create indexes for products collection
db.products.createIndex({ "name": "text", "description": "text", "name_ar": "text" });
db.products.createIndex({ "category_id": 1 });
db.products.createIndex({ "brand_id": 1 });
db.products.createIndex({ "car_brand_id": 1 });
db.products.createIndex({ "car_model_id": 1 });
db.products.createIndex({ "price": 1 });
db.products.createIndex({ "is_active": 1 });
db.products.createIndex({ "created_at": -1 });
db.products.createIndex({ "stock_quantity": 1 });

print('✅ Created products indexes');

// Create indexes for users collection
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "phone": 1 });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "created_at": -1 });

print('✅ Created users indexes');

// Create indexes for orders collection
db.orders.createIndex({ "user_id": 1, "created_at": -1 });
db.orders.createIndex({ "status": 1 });
db.orders.createIndex({ "order_number": 1 }, { unique: true });
db.orders.createIndex({ "created_at": -1 });

print('✅ Created orders indexes');

// Create indexes for categories collection
db.categories.createIndex({ "name": 1 });
db.categories.createIndex({ "slug": 1 }, { unique: true });
db.categories.createIndex({ "parent_id": 1 });

print('✅ Created categories indexes');

// Create indexes for brands collection
db.brands.createIndex({ "name": 1 });
db.brands.createIndex({ "slug": 1 }, { unique: true });

print('✅ Created brands indexes');

// Create indexes for car_brands collection
db.car_brands.createIndex({ "name": 1 });
db.car_brands.createIndex({ "slug": 1 }, { unique: true });

print('✅ Created car_brands indexes');

// Create indexes for car_models collection
db.car_models.createIndex({ "name": 1 });
db.car_models.createIndex({ "brand_id": 1 });
db.car_models.createIndex({ "year_from": 1, "year_to": 1 });

print('✅ Created car_models indexes');

// Create indexes for favorites collection
db.favorites.createIndex({ "user_id": 1, "product_id": 1 }, { unique: true });
db.favorites.createIndex({ "user_id": 1, "created_at": -1 });

print('✅ Created favorites indexes');

// Create indexes for cart collection
db.cart.createIndex({ "user_id": 1 });
db.cart.createIndex({ "session_id": 1 });

print('✅ Created cart indexes');

// Create indexes for notifications collection
db.notifications.createIndex({ "user_id": 1, "created_at": -1 });
db.notifications.createIndex({ "user_id": 1, "is_read": 1 });

print('✅ Created notifications indexes');

// Create indexes for offers collection
db.offers.createIndex({ "is_active": 1, "end_date": 1 });
db.offers.createIndex({ "product_id": 1 });

print('✅ Created offers indexes');

print('\n🎉 Database initialization completed successfully!');
print('📊 All indexes have been created for optimal query performance.');
