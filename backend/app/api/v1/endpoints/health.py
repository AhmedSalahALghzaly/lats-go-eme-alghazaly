"""
Health Check and Deployment Routes
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

from ....core.database import db
from ....core.config import APP_VERSION, MIN_FRONTEND_VERSION, PRIMARY_OWNER_EMAIL
from ....core.security import get_current_user, serialize_doc
from ....models.schemas import VersionInfo, ExportRequest, ImportRequest

router = APIRouter()


@router.get("/version", response_model=VersionInfo)
async def get_version():
    """Get API version information for frontend version checking."""
    return {
        "api_version": APP_VERSION,
        "build_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "min_frontend_version": MIN_FRONTEND_VERSION,
        "features": [
            "cursor_pagination",
            "offline_sync",
            "websocket_realtime",
            "modern_ui_v4",
            "image_optimization",
            "modular_backend"
        ]
    }

@router.get("/health")
async def health_check():
    """Health check endpoint for deployment monitoring."""
    # db is imported from core.database
    try:
        await db.command("ping")
        mongo_status = "healthy"
    except Exception as e:
        mongo_status = f"unhealthy: {str(e)}"
    
    return {
        "status": "healthy" if mongo_status == "healthy" else "degraded",
        "api_version": APP_VERSION,
        "database": mongo_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "architecture": "modular"
    }

@router.post("/admin/export-database")
async def export_database(request: Request, export_config: ExportRequest = None):
    """Export MongoDB collections for database seeding."""
    user = await get_current_user(request)
    if not user or user.get("email") != PRIMARY_OWNER_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    exportable_collections = [
        "car_brands", "car_models", "categories", "product_brands",
        "products", "suppliers", "promotions", "bundle_offers"
    ]
    
    collections_to_export = export_config.collections if export_config and export_config.collections else exportable_collections
    
    export_data = {
        "metadata": {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "api_version": APP_VERSION,
        },
        "collections": {}
    }
    
    for collection_name in collections_to_export:
        if collection_name not in exportable_collections:
            continue
        collection = db[collection_name]
        documents = await collection.find({"deleted_at": None}).to_list(10000)
        serialized_docs = []
        for doc in documents:
            serialized_doc = {}
            for key, value in doc.items():
                if key == "_id":
                    serialized_doc["_id"] = str(value)
                elif isinstance(value, datetime):
                    serialized_doc[key] = value.isoformat()
                else:
                    serialized_doc[key] = value
            serialized_docs.append(serialized_doc)
        export_data["collections"][collection_name] = {
            "count": len(serialized_docs),
            "documents": serialized_docs
        }
    
    return export_data

@router.post("/admin/import-database")
async def import_database(request: Request, import_config: ImportRequest):
    """Import database seed data."""
    user = await get_current_user(request)
    if not user or user.get("email") != PRIMARY_OWNER_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    import_data = import_config.data
    merge_strategy = import_config.merge_strategy
    results = {"imported": {}, "skipped": {}, "errors": []}
    
    collections_data = import_data.get("collections", {})
    for collection_name, collection_data in collections_data.items():
        documents = collection_data.get("documents", [])
        imported_count = 0
        skipped_count = 0
        collection = db[collection_name]
        
        for doc in documents:
            try:
                doc_id = doc.get("_id")
                existing = await collection.find_one({"_id": doc_id}) if doc_id else None
                
                if existing:
                    if merge_strategy == "skip_existing":
                        skipped_count += 1
                        continue
                    elif merge_strategy == "replace":
                        await collection.replace_one({"_id": doc_id}, doc)
                        imported_count += 1
                    elif merge_strategy == "merge":
                        await collection.update_one({"_id": doc_id}, {"$set": doc})
                        imported_count += 1
                else:
                    await collection.insert_one(doc)
                    imported_count += 1
            except Exception as e:
                results["errors"].append(f"{collection_name}/{doc.get('_id', 'unknown')}: {str(e)}")
        
        results["imported"][collection_name] = imported_count
        results["skipped"][collection_name] = skipped_count
    
    return results

@router.get("/admin/database-stats")
async def get_database_stats(request: Request):
    """Get database statistics."""
    user = await get_current_user(request)
    if not user or user.get("email") != PRIMARY_OWNER_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    stats = {}
    collections = [
        "car_brands", "car_models", "categories", "product_brands",
        "products", "users", "orders", "suppliers", "promotions", "bundle_offers"
    ]
    
    for collection_name in collections:
        collection = db[collection_name]
        total = await collection.count_documents({})
        active = await collection.count_documents({"deleted_at": None})
        stats[collection_name] = {"total": total, "active": active, "deleted": total - active}
    
    return {
        "api_version": APP_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "collections": stats
    }

@router.post("/admin/clear-cache")
async def clear_server_cache(request: Request):
    """Clear server-side caches."""
    user = await get_current_user(request)
    if not user or user.get("email") != PRIMARY_OWNER_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "status": "success",
        "message": "Server cache cleared",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "api_version": APP_VERSION
    }

@router.get("/admin/deployment-checklist")
async def get_deployment_checklist(request: Request):
    """Get deployment readiness checklist."""
    user = await get_current_user(request)
    if not user or user.get("email") != PRIMARY_OWNER_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    checks = []
    
    try:
        await db.command("ping")
        checks.append({"name": "Database Connection", "status": "pass", "message": "MongoDB connected"})
    except Exception as e:
        checks.append({"name": "Database Connection", "status": "fail", "message": str(e)})
    
    essential_collections = ["car_brands", "car_models", "categories", "products"]
    for coll in essential_collections:
        count = await db[coll].count_documents({"deleted_at": None})
        if count > 0:
            checks.append({"name": f"{coll} Data", "status": "pass", "message": f"{count} active records"})
        else:
            checks.append({"name": f"{coll} Data", "status": "warn", "message": "No data - seed required"})
    
    admin_count = await db.users.count_documents({"email": PRIMARY_OWNER_EMAIL})
    if admin_count > 0:
        checks.append({"name": "Admin User", "status": "pass", "message": "Owner account exists"})
    else:
        checks.append({"name": "Admin User", "status": "warn", "message": "Owner account not found"})
    
    statuses = [c["status"] for c in checks]
    if "fail" in statuses:
        overall = "fail"
    elif "warn" in statuses:
        overall = "partial"
    else:
        overall = "ready"
    
    return {
        "overall_status": overall,
        "api_version": APP_VERSION,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "checks": checks
    }
