import os
import shutil
import asyncio
import logging
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager

from pdf_ops import process_pdf
from encryption import check_encryption, decrypt_pdf, verify_password
from websocket import ConnectionManager
from utils import cleanup_temp
from config import Config
from pydantic import BaseModel
from typing import List

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Config
config = Config()

# We need a global reference to the main loop to schedule coroutines from threads
main_loop = None
manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
    yield

app = FastAPI(lifespan=lifespan)

# CORS - Allow all for local development/electron
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

import threading

# ...

# Store cancellation events: client_id -> threading.Event
cancellation_events: dict[str, threading.Event] = {}

class ConfigModel(BaseModel):
    words: List[str]
    passwords: List[str]

@app.get("/api/config")
async def get_config():
    return config.get_all()

@app.post("/api/config")
async def update_config(new_config: ConfigModel):
    config.set_words(new_config.words)
    config.set_passwords(new_config.passwords)
    return {"status": "ok"}

@app.post("/api/redact")
def redact_endpoint(
    file: UploadFile = File(...),
    words: str = Form(...),
    client_id: str = Form(...)
):
    literals = [w.strip() for w in words.split(',') if w.strip()]
    
    # Create cancellation event
    cancel_event = threading.Event()
    cancellation_events[client_id] = cancel_event
    
    # Save temp file
    temp_dir = tempfile.mkdtemp()
    input_path = os.path.join(temp_dir, file.filename)
    output_path = os.path.join(temp_dir, f"redacted_{file.filename}")
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Progress wrapper
    def progress_wrapper(*args):
        try:
            if len(args) == 2:
                pct, msg = args
            elif len(args) == 3:
                _, pct, msg = args
            else:
                return
            
            thread_safe_callback(client_id, pct, msg)
        except Exception as e:
            logger.error(f"Error in progress_wrapper: {e}")

    def check_cancel():
        return cancel_event.is_set()

    try:
        # Run synchronously (in threadpool via FastAPI since it's a def)
        logger.info(f"Starting synchronous processing for {file.filename}")
        process_pdf(
            input_path, 
            output_path, 
            literals, 
            progress_callback=progress_wrapper,
            check_cancel=check_cancel
        )
        
        if not os.path.exists(output_path):
            raise Exception("Output file was not created")
            
        logger.info(f"Processing complete for {file.filename}, output at {output_path}")
        return {"status": "done", "temp_dir": temp_dir, "filename": f"redacted_{file.filename}"}
    except Exception as e:
        if str(e) == "Cancelled":
            logger.info(f"Task cancelled for {client_id}")
            thread_safe_callback(client_id, 0, "Cancelled")
            # Cleanup if cancelled
            cleanup_temp(temp_dir)
            return JSONResponse(status_code=400, content={"error": "Cancelled"})
        else:
            logger.error(f"Error processing PDF: {e}")
            thread_safe_callback(client_id, 0, f"Error: {str(e)}")
            cleanup_temp(temp_dir)
            return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        # Cleanup cancellation event
        if client_id in cancellation_events:
            del cancellation_events[client_id]

@app.post("/api/cancel")
async def cancel_endpoint(client_id: str = Form(...)):
    if client_id in cancellation_events:
        cancellation_events[client_id].set()
        return {"status": "cancelling"}
    return {"status": "no_active_task"}

@app.get("/api/download")
async def download_file(temp_dir: str, filename: str):
    file_path = os.path.join(temp_dir, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, filename=filename)
    return {"error": "File not found"}

@app.post("/api/check_encryption")
async def check_encryption_endpoint(file: UploadFile = File(...)):
    temp_dir = tempfile.mkdtemp()
    input_path = os.path.join(temp_dir, file.filename)
    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        is_encrypted = check_encryption(input_path)
        
        auto_password = None
        if is_encrypted:
            # Try passwords from config
            saved_passwords = config.get_passwords()
            logger.info(f"Checking {len(saved_passwords)} saved passwords for {file.filename}")
            for pwd in saved_passwords:
                if verify_password(input_path, pwd):
                    logger.info(f"Found matching password for {file.filename}")
                    auto_password = pwd
                    break
            
            if not auto_password:
                logger.info(f"No matching password found for {file.filename}")
        
        return {"encrypted": is_encrypted, "auto_password": auto_password}
    finally:
        shutil.rmtree(temp_dir)

@app.post("/api/decrypt")
async def decrypt_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(...), password: str = Form(...)):
    temp_dir = tempfile.mkdtemp()
    input_path = os.path.join(temp_dir, file.filename)
    output_path = os.path.join(temp_dir, f"decrypted_{file.filename}")
    
    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        success = decrypt_pdf(input_path, output_path, password)
        if success:
            background_tasks.add_task(cleanup_temp, output_path)
            return FileResponse(output_path, filename=file.filename)
        else:
            cleanup_temp(output_path)
            return JSONResponse(status_code=400, content={"error": "Incorrect password. Please try again."})
    except Exception as e:
        cleanup_temp(output_path)
        return JSONResponse(status_code=400, content={"error": str(e)})

@app.get("/health")
def health_check():
    return {"status": "ok"}

class BatchFile(BaseModel):
    temp_dir: str
    filename: str

@app.post("/api/batch_zip")
async def batch_zip_endpoint(files: List[BatchFile], background_tasks: BackgroundTasks):
    import zipfile
    
    zip_path = tempfile.mktemp(suffix='.zip')
    
    try:
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            seen_names = {}
            for f in files:
                file_path = os.path.join(f.temp_dir, f.filename)
                if os.path.exists(file_path):
                    # Handle duplicate names
                    arcname = f.filename
                    if arcname in seen_names:
                        seen_names[arcname] += 1
                        name, ext = os.path.splitext(arcname)
                        arcname = f"{name}_{seen_names[arcname]}{ext}"
                    else:
                        seen_names[arcname] = 0
                        
                    zipf.write(file_path, arcname=arcname)
                else:
                    logger.warning(f"File not found for zip: {file_path}")
                    
        background_tasks.add_task(cleanup_temp, zip_path)
        return FileResponse(zip_path, filename="redacted_batch.zip")
    except Exception as e:
        logger.error(f"Error creating zip: {e}")
        cleanup_temp(zip_path)
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
