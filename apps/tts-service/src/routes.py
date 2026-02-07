"""API routes for TTS service."""

import base64
import logging
import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import Response

from .config import Settings, get_settings
from .schemas import (
    HealthResponse,
    SynthesizeRequest,
    SynthesizeResponse,
    VoiceGender,
    VoiceInfo,
    VoicesResponse,
)
from .tts_engine import get_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["tts"])


@router.get("/health", response_model=HealthResponse)
async def health_check(
    settings: Annotated[Settings, Depends(get_settings)]
) -> HealthResponse:
    """Health check endpoint."""
    try:
        engine = get_engine()
        model_loaded = engine._initialized
        
        # Check GPU availability
        gpu_available = False
        try:
            import onnxruntime as ort
            gpu_available = "CUDAExecutionProvider" in ort.get_available_providers()
        except Exception:
            pass

        return HealthResponse(
            status="healthy",
            version="1.0.0",
            model_loaded=model_loaded,
            gpu_available=gpu_available
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


@router.get("/voices", response_model=VoicesResponse)
async def get_voices() -> VoicesResponse:
    """Get list of available voices."""
    # Hardcoded for now - would be loaded from config/models directory
    voices = [
        VoiceInfo(
            id="default",
            name="Lessac (Medium)",
            language="en",
            gender=VoiceGender.FEMALE
        ),
        VoiceInfo(
            id="assistant",
            name="Lessac (Fast)",
            language="en",
            gender=VoiceGender.FEMALE
        ),
        VoiceInfo(
            id="reader",
            name="Danny (Low)",
            language="en",
            gender=VoiceGender.MALE
        )
    ]
    
    return VoicesResponse(voices=voices)


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize_text(
    request: SynthesizeRequest,
    settings: Annotated[Settings, Depends(get_settings)]
) -> SynthesizeResponse:
    """Synthesize speech from text."""
    try:
        start_time = time.time()
        engine = get_engine()

        # Synthesize audio
        audio_data, sample_rate = engine.synthesize(
            text=request.text,
            speed=request.speed,
            sample_rate=22050
        )

        # Convert to bytes in requested format
        audio_bytes = engine.audio_to_bytes(
            audio_data,
            sample_rate,
            format=request.format.value
        )

        # Encode as base64
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

        # Calculate duration
        duration = len(audio_data) / sample_rate
        processing_time = time.time() - start_time

        logger.info(
            f"Synthesized {len(request.text)} chars in {processing_time:.2f}s "
            f"(duration: {duration:.2f}s, RTF: {processing_time/duration:.2f})"
        )

        return SynthesizeResponse(
            audio=audio_base64,
            duration=duration,
            format=request.format.value,
            sample_rate=sample_rate,
            processing_time=processing_time
        )

    except Exception as e:
        logger.error(f"Synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")


@router.post("/synthesize/binary")
async def synthesize_binary(
    request: SynthesizeRequest,
    settings: Annotated[Settings, Depends(get_settings)]
) -> Response:
    """Synthesize speech and return raw binary audio."""
    try:
        engine = get_engine()

        # Synthesize audio
        audio_data, sample_rate = engine.synthesize(
            text=request.text,
            speed=request.speed,
            sample_rate=22050
        )

        # Convert to bytes
        audio_bytes = engine.audio_to_bytes(
            audio_data,
            sample_rate,
            format=request.format.value
        )

        # Determine content type
        content_types = {
            "wav": "audio/wav",
            "mp3": "audio/mpeg",
            "webm": "audio/webm"
        }

        return Response(
            content=audio_bytes,
            media_type=content_types.get(request.format.value, "application/octet-stream")
        )

    except Exception as e:
        logger.error(f"Binary synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")


@router.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    """WebSocket endpoint for streaming TTS."""
    await websocket.accept()
    logger.info("WebSocket connection established")

    try:
        engine = get_engine()
        
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            message_type = data.get("type")
            if message_type != "synthesize":
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })
                continue

            text = data.get("text", "")
            voice = data.get("voice", "default")
            speed = data.get("speed", 1.0)

            # Stream synthesis
            sequence_id = 0
            for audio_chunk, sample_rate in engine.synthesize_streaming(text, speed):
                # Convert to bytes
                audio_bytes = engine.audio_to_bytes(audio_chunk, sample_rate, "wav")
                
                # Send chunk
                await websocket.send_json({
                    "type": "audio_chunk",
                    "data": base64.b64encode(audio_bytes).decode("utf-8"),
                    "sequence_id": sequence_id,
                    "is_last": False
                })
                sequence_id += 1

            # Send completion message
            await websocket.send_json({
                "type": "complete",
                "sequence_id": sequence_id,
                "is_last": True
            })

    except WebSocketDisconnect:
        logger.info("WebSocket connection closed")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
