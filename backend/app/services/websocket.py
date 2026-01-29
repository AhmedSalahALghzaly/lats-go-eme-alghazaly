"""
WebSocket Manager for Real-time Updates
"""
from fastapi import WebSocket
from typing import Dict, Set

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

# Singleton instance
manager = ConnectionManager()
