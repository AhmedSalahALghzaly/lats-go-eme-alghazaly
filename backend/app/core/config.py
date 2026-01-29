"""
Configuration and Settings
ALghazaly Auto Parts API v4.1
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / '.env')

# Primary Owner Email
PRIMARY_OWNER_EMAIL = "pc.2025.ai@gmail.com"

# App version information
APP_VERSION = "4.1.0"
MIN_FRONTEND_VERSION = "1.0.0"

class Settings:
    MONGO_URL: str = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME: str = os.environ.get('DB_NAME', 'test_database')
    
    # Session settings
    SESSION_EXPIRE_DAYS: int = 7
    
    # Shipping cost
    SHIPPING_COST: float = 150.0

settings = Settings()
