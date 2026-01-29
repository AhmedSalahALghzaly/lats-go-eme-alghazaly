from fastapi import APIRouter
from .endpoints import (
    auth, partners, admins, suppliers, distributors, subscribers,
    notifications, analytics, car_brands, car_models, product_brands,
    categories, products, cart, orders, favorites, comments,
    promotions, bundle_offers, marketing, sync, health, customers,
    delta_sync, collections
)

api_router = APIRouter(prefix="/api")

# Include all endpoint routers
api_router.include_router(auth.router, tags=["Auth"])
api_router.include_router(partners.router, tags=["Partners"])
api_router.include_router(admins.router, tags=["Admins"])
api_router.include_router(suppliers.router, tags=["Suppliers"])
api_router.include_router(distributors.router, tags=["Distributors"])
api_router.include_router(subscribers.router, tags=["Subscribers"])
api_router.include_router(notifications.router, tags=["Notifications"])
api_router.include_router(analytics.router, tags=["Analytics"])
api_router.include_router(car_brands.router, tags=["Car Brands"])
api_router.include_router(car_models.router, tags=["Car Models"])
api_router.include_router(product_brands.router, tags=["Product Brands"])
api_router.include_router(categories.router, tags=["Categories"])
api_router.include_router(products.router, tags=["Products"])
api_router.include_router(cart.router, tags=["Cart"])
api_router.include_router(orders.router, tags=["Orders"])
api_router.include_router(customers.router, tags=["Customers"])
api_router.include_router(favorites.router, tags=["Favorites"])
api_router.include_router(comments.router, tags=["Comments"])
api_router.include_router(promotions.router, tags=["Promotions"])
api_router.include_router(bundle_offers.router, tags=["Bundle Offers"])
api_router.include_router(marketing.router, tags=["Marketing"])
api_router.include_router(sync.router, tags=["Sync"])
api_router.include_router(delta_sync.router, tags=["Delta Sync"])
api_router.include_router(collections.router, tags=["Collections"])
api_router.include_router(health.router, tags=["Health"])
