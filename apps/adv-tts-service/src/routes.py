"""API routes for advanced TTS service."""

import asyncio
import base64
import logging
import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, WebSocket
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

# Semaphore to limit concurrent synthesis to 1
synthesis_semaphore = asyncio.Semaphore(1)


def _get_gpu_details() -> dict:
    details = {
        "gpu_available": False,
        "gpu_name": None,
        "gpu_memory_total_mb": None,
        "gpu_memory_reserved_mb": None,
        "gpu_memory_allocated_mb": None,
        "gpu_memory_free_mb": None,
    }

    try:
        import torch
    except Exception:
        torch = None

    if torch is not None and torch.cuda.is_available():
        device_index = torch.cuda.current_device()
        props = torch.cuda.get_device_properties(device_index)
        details["gpu_available"] = True
        details["gpu_name"] = props.name
        details["gpu_memory_total_mb"] = int(props.total_memory / (1024 * 1024))
        details["gpu_memory_reserved_mb"] = int(torch.cuda.memory_reserved(device_index) / (1024 * 1024))
        details["gpu_memory_allocated_mb"] = int(torch.cuda.memory_allocated(device_index) / (1024 * 1024))
        try:
            free_bytes, total_bytes = torch.cuda.mem_get_info(device_index)
            details["gpu_memory_free_mb"] = int(free_bytes / (1024 * 1024))
            details["gpu_memory_total_mb"] = int(total_bytes / (1024 * 1024))
        except Exception:
            pass
        return details

    try:
        import onnxruntime as ort
        details["gpu_available"] = "CUDAExecutionProvider" in ort.get_available_providers()
    except Exception:
        pass

    return details

router = APIRouter(prefix="/api/tts", tags=["tts"])


@router.get("/health", response_model=HealthResponse)
async def health_check(
    settings: Annotated[Settings, Depends(get_settings)]
) -> HealthResponse:
    """Health check endpoint."""
    try:
        engine = get_engine()
        model_loaded = engine._initialized

        gpu_details = _get_gpu_details()

        return HealthResponse(
            status="healthy",
            version="1.0.0",
            model_loaded=model_loaded,
            gpu_available=gpu_details["gpu_available"],
            gpu_name=gpu_details["gpu_name"],
            gpu_memory_total_mb=gpu_details["gpu_memory_total_mb"],
            gpu_memory_reserved_mb=gpu_details["gpu_memory_reserved_mb"],
            gpu_memory_allocated_mb=gpu_details["gpu_memory_allocated_mb"],
            gpu_memory_free_mb=gpu_details["gpu_memory_free_mb"],
            engine=settings.model_type,
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


@router.get("/voices", response_model=VoicesResponse)
async def get_voices(settings: Annotated[Settings, Depends(get_settings)]) -> VoicesResponse:
    """Get list of available voices."""
    if settings.model_type == "piper":
        voices = [
            VoiceInfo(id="en_US-lessac-medium", name="Lessac (Medium)", language="en", gender=VoiceGender.FEMALE),
            VoiceInfo(id="en_US-amy-medium", name="Amy (Medium)", language="en", gender=VoiceGender.FEMALE),
            VoiceInfo(id="en_US-ryan-high", name="Ryan (High)", language="en", gender=VoiceGender.MALE),
        ]
    elif settings.model_type == "kokoro":
        voices = [
            VoiceInfo(id="af", name="Kokoro Female", language="en", gender=VoiceGender.FEMALE),
            VoiceInfo(id="am", name="Kokoro Male", language="en", gender=VoiceGender.MALE),
        ]
    else:
        engine = get_engine()
        speakers = engine.get_supported_speakers()
        voices = [
            VoiceInfo(id=speaker, name=speaker, language="multi", gender=VoiceGender.NEUTRAL)
            for speaker in speakers
        ]
        if not voices:
            voices = [
                VoiceInfo(id="default", name="Qwen3 Default", language="multi", gender=VoiceGender.NEUTRAL),
            ]

    return VoicesResponse(voices=voices)


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize_text(
    request: SynthesizeRequest,
    settings: Annotated[Settings, Depends(get_settings)]
) -> SynthesizeResponse:
    """Synthesize speech from text."""
    async with synthesis_semaphore:
        try:
            start_time = time.time()
            engine = get_engine()

            audio_data, sample_rate = engine.synthesize(
                text=request.text,
                speed=request.speed,
                sample_rate=settings.tts_sample_rate,
                voice=request.voice,
                language=request.language,
                instruct=request.instruct
            )

            audio_bytes = engine.audio_to_bytes(
                audio_data,
                sample_rate,
                format=request.format.value
            )

            audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
            duration = len(audio_data) / sample_rate if sample_rate else 0
            processing_time = time.time() - start_time

            logger.info(
                f"Synthesized {len(request.text)} chars in {processing_time:.2f}s "
                f"(duration: {duration:.2f}s)"
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
    async with synthesis_semaphore:
        try:
            engine = get_engine()

            audio_data, sample_rate = engine.synthesize(
                text=request.text,
                speed=request.speed,
                sample_rate=settings.tts_sample_rate,
                voice=request.voice,
                language=request.language,
                instruct=request.instruct
            )

            audio_bytes = engine.audio_to_bytes(
                audio_data,
                sample_rate,
                format=request.format.value
            )

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
        settings = get_settings()
        engine = get_engine()

        while True:
            data = await websocket.receive_json()

            message_type = data.get("type")
            if message_type != "synthesize":
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })
                continue

            text = data.get("text", "")
            speed = data.get("speed", 1.0)
            voice = data.get("voice", "default")
            language = data.get("language")
            instruct = data.get("instruct")

            async with synthesis_semaphore:
                sequence_id = 0
                for audio_chunk, sample_rate in engine.synthesize_streaming(
                    text,
                    speed,
                    settings.stream_chunk_size,
                    voice=voice,
                    language=language,
                    instruct=instruct
                ):
                    audio_bytes = engine.audio_to_bytes(audio_chunk, sample_rate, "wav")
                    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

                    await websocket.send_json({
                        "type": "audio_chunk",
                        "data": audio_base64,
                        "sequence_id": sequence_id,
                        "is_last": False
                    })
                    sequence_id += 1

                await websocket.send_json({
                    "type": "complete",
                    "sequence_id": sequence_id,
                    "is_last": True
                })

    except Exception as e:
        logger.error(f"WebSocket stream error: {e}")
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
