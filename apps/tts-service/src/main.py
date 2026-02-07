"""Main FastAPI application for TTS service."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import router
from .tts_engine import initialize_engine, shutdown_engine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    settings = get_settings()
    
    # Startup
    logger.info("Starting TTS service...")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Model: {settings.model_path}")
    
    # Set CUDA device
    if settings.cuda_visible_devices:
        os.environ["CUDA_VISIBLE_DEVICES"] = settings.cuda_visible_devices
        logger.info(f"CUDA_VISIBLE_DEVICES: {settings.cuda_visible_devices}")
    
    try:
        # Initialize TTS engine with quality settings
        initialize_engine(
            model_path=settings.model_path,
            config_path=settings.voice_config_path,
            use_cuda=True,
            noise_scale=settings.tts_noise_scale,
            length_scale=settings.tts_length_scale,
            enable_enhancement=settings.enable_audio_enhancement
        )
        logger.info("TTS engine initialized successfully")
        logger.info(f"Quality settings: noise_scale={settings.tts_noise_scale}, length_scale={settings.tts_length_scale}, enhancement={settings.enable_audio_enhancement}")
    except Exception as e:
        logger.error(f"Failed to initialize TTS engine: {e}")
        logger.warning("Service will start but TTS functionality will be unavailable")
    
    yield
    
    # Shutdown
    logger.info("Shutting down TTS service...")
    shutdown_engine()
    logger.info("TTS service stopped")


# Create FastAPI app
app = FastAPI(
    title="Second Brain TTS Service",
    description="Text-to-Speech service using Piper TTS",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Second Brain TTS",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/ping")
async def ping():
    """Simple ping endpoint."""
    return {"status": "pong"}


if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level
    )
