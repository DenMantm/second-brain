"""Main FastAPI application for advanced TTS service."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import router
from .tts_engine import initialize_engine, shutdown_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    settings = get_settings()

    logger.info("Starting advanced TTS service...")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Engine: {settings.model_type}")

    # GPU detection and logging
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        logger.info(f"PyTorch CUDA available: {cuda_available}")
        if cuda_available:
            device_count = torch.cuda.device_count()
            logger.info(f"CUDA device count: {device_count}")
            for i in range(device_count):
                device_name = torch.cuda.get_device_name(i)
                props = torch.cuda.get_device_properties(i)
                total_mem_gb = props.total_memory / (1024**3)
                logger.info(f"GPU {i}: {device_name} ({total_mem_gb:.1f} GB)")
        else:
            logger.warning("CUDA not available - running on CPU")
    except Exception as e:
        logger.warning(f"Could not detect GPU: {e}")

    if settings.cuda_visible_devices:
        os.environ["CUDA_VISIBLE_DEVICES"] = settings.cuda_visible_devices
        logger.info(f"CUDA_VISIBLE_DEVICES: {settings.cuda_visible_devices}")

    try:
        initialize_engine(settings)
        logger.info("TTS engine initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize TTS engine: {e}")
        logger.warning("Service will start but TTS functionality will be unavailable")

    yield

    logger.info("Shutting down TTS service...")
    shutdown_engine()
    logger.info("TTS service stopped")


app = FastAPI(
    title="Second Brain Advanced TTS Service",
    description="Multi-engine Text-to-Speech service",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Second Brain Advanced TTS",
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
