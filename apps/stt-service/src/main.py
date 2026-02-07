"""STT Service - Speech-to-Text API using Faster Whisper."""
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .config import settings
from .stt_engine import stt_engine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    logger.info("=" * 50)
    logger.info("STT Service Starting")
    logger.info(f"Model: {settings.model_size}")
    logger.info(f"Device: {settings.device}")
    logger.info(f"Compute type: {settings.compute_type}")
    logger.info("=" * 50)
    
    # Load model on startup
    try:
        stt_engine.load_model()
    except Exception as e:
        logger.error(f"Failed to load model on startup: {e}")
        logger.warning("Model will be loaded on first request")
    
    yield
    
    # Shutdown
    logger.info("STT Service shutting down")


app = FastAPI(
    title="STT Service",
    description="Speech-to-Text API using Faster Whisper",
    version="1.0.0",
    lifespan=lifespan
)


class TranscriptionResponse(BaseModel):
    """Response model for transcription."""
    text: str
    segments: list
    language: str
    language_probability: float
    duration: float
    inference_time: float


@app.get("/ping")
async def ping():
    """Health check endpoint."""
    return {"status": "pong"}


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "model_loaded": stt_engine.model_loaded,
        "model_size": settings.model_size,
        "device": settings.device,
        "compute_type": settings.compute_type
    }


@app.post("/api/stt/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
    task: str = Form("transcribe")
):
    """
    Transcribe audio file.
    
    Args:
        audio: Audio file (WAV, MP3, M4A, etc.)
        language: Language code (e.g., 'en', 'es', 'fr'). None for auto-detection.
        task: "transcribe" or "translate" (translate to English)
        
    Returns:
        Transcription results
    """
    # Validate task
    if task not in ["transcribe", "translate"]:
        raise HTTPException(status_code=400, detail="Task must be 'transcribe' or 'translate'")
    
    # Save uploaded file temporarily
    temp_file = Path(f"/tmp/{audio.filename}")
    try:
        # Save file
        with open(temp_file, "wb") as f:
            content = await audio.read()
            f.write(content)
        
        logger.info(f"Received file: {audio.filename} ({len(content)} bytes)")
        
        # Transcribe
        result = stt_engine.transcribe(
            str(temp_file),
            language=language,
            task=task
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Clean up temp file
        if temp_file.exists():
            temp_file.unlink()


@app.post("/api/stt/transcribe-url")
async def transcribe_url(
    url: str,
    language: Optional[str] = None,
    task: str = "transcribe"
):
    """
    Transcribe audio from URL.
    
    Args:
        url: URL to audio file
        language: Language code. None for auto-detection.
        task: "transcribe" or "translate"
        
    Returns:
        Transcription results
    """
    # TODO: Implement URL-based transcription
    raise HTTPException(status_code=501, detail="URL transcription not yet implemented")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
