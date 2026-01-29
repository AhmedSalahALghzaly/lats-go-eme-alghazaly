"""
Sync Routes
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional
from datetime import datetime, timezone
import json

from ....core.database import db
from ....core.security import serialize_doc
from ....models.schemas import SyncPullRequest
from ....services.websocket import manager

router = APIRouter()

def get_timestamp_ms():
    return int(datetime.now(timezone.utc).timestamp() * 1000)

@router.post("/sync/pull")
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

@router.websocket("/ws")
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
