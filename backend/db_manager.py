#!/usr/bin/env python3
"""
Al-Ghazaly Database Management CLI
Export and import database for deployment to new environments
v1.0.0
"""

import asyncio
import json
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Collections to export (business data only)
EXPORTABLE_COLLECTIONS = [
    "car_brands",
    "car_models", 
    "categories",
    "product_brands",
    "products",
    "suppliers",
    "promotions",
    "bundle_offers",
    "home_slider",
    "marketing_settings"
]

class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder for datetime objects"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


async def export_database(output_file: str, collections: list = None):
    """Export database collections to JSON file"""
    print(f"Connecting to MongoDB at {MONGO_URL}...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    collections_to_export = collections or EXPORTABLE_COLLECTIONS
    
    export_data = {
        "metadata": {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "api_version": "4.1.0",
            "source_db": DB_NAME,
            "collections_exported": collections_to_export
        },
        "collections": {}
    }
    
    total_docs = 0
    
    for collection_name in collections_to_export:
        print(f"  Exporting {collection_name}...", end=" ")
        
        collection = db[collection_name]
        documents = await collection.find({"deleted_at": None}).to_list(10000)
        
        # Convert ObjectIds to strings
        serialized_docs = []
        for doc in documents:
            serialized_doc = {}
            for key, value in doc.items():
                if key == "_id":
                    serialized_doc["_id"] = str(value) if hasattr(value, '__str__') else value
                elif isinstance(value, datetime):
                    serialized_doc[key] = value.isoformat()
                else:
                    serialized_doc[key] = value
            serialized_docs.append(serialized_doc)
        
        export_data["collections"][collection_name] = {
            "count": len(serialized_docs),
            "documents": serialized_docs
        }
        
        print(f"{len(serialized_docs)} documents")
        total_docs += len(serialized_docs)
    
    # Write to file
    output_path = Path(output_file)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Export complete!")
    print(f"   Total documents: {total_docs}")
    print(f"   Output file: {output_path.absolute()}")
    
    client.close()
    return export_data


async def import_database(input_file: str, merge_strategy: str = "skip_existing"):
    """Import database from JSON file"""
    input_path = Path(input_file)
    
    if not input_path.exists():
        print(f"❌ Error: File not found: {input_path}")
        return False
    
    print(f"Loading data from {input_path}...")
    with open(input_path, 'r', encoding='utf-8') as f:
        import_data = json.load(f)
    
    print(f"Connecting to MongoDB at {MONGO_URL}...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    metadata = import_data.get("metadata", {})
    print(f"  Source: {metadata.get('source_db', 'unknown')}")
    print(f"  Exported at: {metadata.get('exported_at', 'unknown')}")
    print(f"  Merge strategy: {merge_strategy}")
    print()
    
    results = {
        "imported": 0,
        "skipped": 0,
        "errors": []
    }
    
    collections_data = import_data.get("collections", {})
    
    for collection_name, collection_data in collections_data.items():
        documents = collection_data.get("documents", [])
        print(f"  Importing {collection_name} ({len(documents)} documents)...", end=" ")
        
        collection = db[collection_name]
        imported = 0
        skipped = 0
        
        for doc in documents:
            try:
                doc_id = doc.get("_id")
                
                # Check if exists
                existing = await collection.find_one({"_id": doc_id}) if doc_id else None
                
                if existing:
                    if merge_strategy == "skip_existing":
                        skipped += 1
                        continue
                    elif merge_strategy == "replace":
                        await collection.replace_one({"_id": doc_id}, doc)
                        imported += 1
                    elif merge_strategy == "merge":
                        await collection.update_one({"_id": doc_id}, {"$set": doc})
                        imported += 1
                else:
                    # Convert ISO date strings back to datetime
                    for key, value in doc.items():
                        if isinstance(value, str) and "T" in value:
                            try:
                                if value.endswith("+00:00") or value.endswith("Z"):
                                    doc[key] = datetime.fromisoformat(value.replace("Z", "+00:00"))
                            except:
                                pass
                    
                    await collection.insert_one(doc)
                    imported += 1
                    
            except Exception as e:
                results["errors"].append(f"{collection_name}/{doc.get('_id', 'unknown')}: {str(e)}")
        
        print(f"✓ {imported} imported, {skipped} skipped")
        results["imported"] += imported
        results["skipped"] += skipped
    
    print(f"\n✅ Import complete!")
    print(f"   Total imported: {results['imported']}")
    print(f"   Total skipped: {results['skipped']}")
    
    if results["errors"]:
        print(f"   Errors: {len(results['errors'])}")
        for error in results["errors"][:5]:
            print(f"     - {error}")
    
    client.close()
    return True


async def show_stats():
    """Show database statistics"""
    print(f"Connecting to MongoDB at {MONGO_URL}...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"\n📊 Database Statistics for '{DB_NAME}'")
    print("=" * 50)
    
    collections = EXPORTABLE_COLLECTIONS + ["users", "orders", "cart_items", "distributors", "customers"]
    
    for collection_name in collections:
        collection = db[collection_name]
        total = await collection.count_documents({})
        active = await collection.count_documents({"deleted_at": None})
        deleted = total - active
        
        status = "✓" if active > 0 else "○"
        print(f"  {status} {collection_name}: {active} active ({deleted} deleted)")
    
    print("=" * 50)
    
    client.close()


async def verify_deployment():
    """Verify deployment readiness"""
    print(f"🔍 Deployment Verification")
    print("=" * 50)
    
    checks = []
    
    # 1. Database connection
    try:
        client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        await client.admin.command("ping")
        checks.append(("Database Connection", "✅ PASS", "MongoDB connected"))
        db = client[DB_NAME]
    except Exception as e:
        checks.append(("Database Connection", "❌ FAIL", str(e)))
        print("\n".join([f"{c[0]}: {c[1]} - {c[2]}" for c in checks]))
        return False
    
    # 2. Essential data
    essential = [
        ("car_brands", 1),
        ("car_models", 1),
        ("categories", 1),
        ("products", 1),
    ]
    
    for coll_name, min_count in essential:
        count = await db[coll_name].count_documents({"deleted_at": None})
        if count >= min_count:
            checks.append((f"{coll_name} Data", "✅ PASS", f"{count} records"))
        else:
            checks.append((f"{coll_name} Data", "⚠️ WARN", f"Only {count} records (min: {min_count})"))
    
    # 3. Indexes
    try:
        indexes = await db.products.index_information()
        if len(indexes) > 1:
            checks.append(("Database Indexes", "✅ PASS", f"{len(indexes)} indexes"))
        else:
            checks.append(("Database Indexes", "⚠️ WARN", "Limited indexes"))
    except:
        checks.append(("Database Indexes", "⚠️ WARN", "Could not verify"))
    
    # Print results
    for name, status, message in checks:
        print(f"  {status} {name}: {message}")
    
    print("=" * 50)
    
    # Overall status
    has_fail = any("FAIL" in c[1] for c in checks)
    has_warn = any("WARN" in c[1] for c in checks)
    
    if has_fail:
        print("❌ DEPLOYMENT NOT READY - Fix failures before deploying")
        return False
    elif has_warn:
        print("⚠️ DEPLOYMENT READY WITH WARNINGS")
        return True
    else:
        print("✅ DEPLOYMENT READY")
        return True


def main():
    parser = argparse.ArgumentParser(
        description="Al-Ghazaly Database Management CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Export database:
    python db_manager.py export --output seed_data.json
    
  Import database:
    python db_manager.py import --input seed_data.json --strategy skip_existing
    
  Show statistics:
    python db_manager.py stats
    
  Verify deployment:
    python db_manager.py verify
"""
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Export command
    export_parser = subparsers.add_parser("export", help="Export database to JSON")
    export_parser.add_argument("--output", "-o", default="seed_data.json", help="Output file path")
    export_parser.add_argument("--collections", "-c", nargs="+", help="Specific collections to export")
    
    # Import command
    import_parser = subparsers.add_parser("import", help="Import database from JSON")
    import_parser.add_argument("--input", "-i", required=True, help="Input file path")
    import_parser.add_argument(
        "--strategy", "-s",
        choices=["skip_existing", "replace", "merge"],
        default="skip_existing",
        help="Merge strategy for existing documents"
    )
    
    # Stats command
    subparsers.add_parser("stats", help="Show database statistics")
    
    # Verify command
    subparsers.add_parser("verify", help="Verify deployment readiness")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    if args.command == "export":
        asyncio.run(export_database(args.output, args.collections))
    elif args.command == "import":
        asyncio.run(import_database(args.input, args.strategy))
    elif args.command == "stats":
        asyncio.run(show_stats())
    elif args.command == "verify":
        success = asyncio.run(verify_deployment())
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
