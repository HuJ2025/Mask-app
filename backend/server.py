import os
import shutil
import uuid
import asyncio
import logging
import tempfile
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from core import process_pdf

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS - Allow all for local development/electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

manager = ConnectionManager()

def run_redaction(client_id: str, input_path: str, output_path: str, literals: List[str]):
    """
    Wrapper to run process_pdf with a thread-safe callback.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def progress_callback(pct, msg):
        # This runs in a separate thread, so we need to schedule the async send
        # on the main event loop.
        # However, getting the main loop from here is tricky if we don't pass it.
        # Actually, since we are in a threadpool, we can't easily access the main loop directly 
        # without passing it or using a global.
        # A better approach for FastAPI background tasks is to just use a sync callback 
        # that puts messages into a queue, or use run_coroutine_threadsafe if we have the loop.
        pass

    # Re-thinking: FastAPI's run_in_threadpool runs in a separate thread.
    # We need to communicate back to the main thread where the websocket lives.
    # We can use a global loop reference if we set it on startup.
    
    # Let's try a simpler approach: 
    # The callback will use a helper to send to the websocket.
    # But wait, `process_pdf` is synchronous.
    pass

# We need a global reference to the main loop to schedule coroutines from threads
main_loop = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
    yield

app = FastAPI(lifespan=lifespan)

# Re-add middleware since I redefined app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def thread_safe_callback(client_id: str, pct: int, msg: str):
    if main_loop and manager.active_connections.get(client_id):
        asyncio.run_coroutine_threadsafe(
            manager.send_progress(client_id, pct, msg),
            main_loop
        )

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            await websocket.receive_text() # Keep connection open
    except WebSocketDisconnect:
        manager.disconnect(client_id)

@app.post("/api/redact")
async def redact_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    words: str = Form(...), # JSON string or comma separated? Let's assume comma separated for simplicity or handle multiple fields
    client_id: str = Form(...)
):
    # Parse words
    # If words is sent as a single string "word1,word2", split it.
    # Or if the frontend sends multiple "words" fields, FastAPI handles it as a list.
    # Let's assume the frontend sends a JSON string or we handle List[str] with proper form encoding.
    # For simplicity with FormData, let's assume comma-separated or multiple values.
    # Actually, `words` as Form(...) can be a list if defined as List[str] and sent correctly.
    # But simple text input is easier to parse.
    
    literals = [w.strip() for w in words.split(',') if w.strip()]
    
    # Save temp file
    temp_dir = tempfile.mkdtemp()
    input_path = os.path.join(temp_dir, file.filename)
    output_path = os.path.join(temp_dir, f"redacted_{file.filename}")
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Run in threadpool
    # We define a wrapper to call process_pdf with the callback
    def processing_wrapper():
        def progress_wrapper(*args):
            # Handle variable arguments to avoid TypeError
            # Expecting (pct, msg) but might get (self, pct, msg) or others
            try:
                if len(args) == 2:
                    pct, msg = args
                elif len(args) == 3:
                    # Assuming first arg is self or ignored
                    _, pct, msg = args
                else:
                    logger.warning(f"Unexpected args in progress_callback: {args}")
                    return
                
                thread_safe_callback(client_id, pct, msg)
            except Exception as e:
                logger.error(f"Error in progress_wrapper: {e}")

        try:
            process_pdf(
                input_path, 
                output_path, 
                literals, 
                progress_callback=progress_wrapper
            )
        except Exception as e:
            logger.error(f"Error processing PDF: {e}")
            thread_safe_callback(client_id, 0, f"Error: {str(e)}")
        
    # We want to await the processing so we can return the file?
    # No, that would timeout the request for large files.
    # But the user wants to download the file.
    # Strategy:
    # 1. Client uploads file -> Server starts processing (background) -> Returns "Processing started" + task_id (or just uses client_id).
    # 2. Client listens to WS for "Done".
    # 3. Client requests GET /download/{task_id}.
    
    # However, for simplicity in a local app, we can just wait if it's not TOO long.
    # But PDF OCR can take minutes.
    # So BackgroundTasks is better.
    
    # Let's change the return to just a status, and add a download endpoint.
    background_tasks.add_task(processing_wrapper)
    
    return {"status": "processing", "temp_dir": temp_dir, "filename": f"redacted_{file.filename}"}

@app.get("/api/download")
async def download_file(temp_dir: str, filename: str):
    file_path = os.path.join(temp_dir, filename)
    print(f"DEBUG: Download request for: {file_path}")
    print(f"DEBUG: temp_dir exists? {os.path.exists(temp_dir)}")
    if os.path.exists(temp_dir):
        print(f"DEBUG: Contents of {temp_dir}: {os.listdir(temp_dir)}")
    
    if os.path.exists(file_path):
        return FileResponse(file_path, filename=filename)
    
    print(f"DEBUG: File not found: {file_path}")
    return {"error": "File not found"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
