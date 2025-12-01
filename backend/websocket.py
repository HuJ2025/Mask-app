from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_progress(self, client_id: str, percentage: int, message: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json({
                    "percentage": percentage,
                    "message": message
                })
            except Exception as e:
                logger.error(f"Error sending progress to {client_id}: {e}")
