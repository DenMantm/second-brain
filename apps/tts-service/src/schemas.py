"""Pydantic models for request/response validation."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class AudioFormat(str, Enum):
    """Supported audio output formats."""
    WAV = "wav"
    MP3 = "mp3"
    WEBM = "webm"


class VoiceGender(str, Enum):
    """Voice gender types."""
    MALE = "male"
    FEMALE = "female"
    NEUTRAL = "neutral"


class SynthesizeRequest(BaseModel):
    """Request model for text synthesis."""
    text: str = Field(..., min_length=1, max_length=10000, description="Text to synthesize")
    voice: Optional[str] = Field(default="default", description="Voice profile to use")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="Speaking speed")
    format: AudioFormat = Field(default=AudioFormat.WAV, description="Output audio format")

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        """Validate and clean text input."""
        # Remove excessive whitespace
        v = " ".join(v.split())
        if not v.strip():
            raise ValueError("Text cannot be empty or only whitespace")
        return v


class SynthesizeResponse(BaseModel):
    """Response model for synthesis."""
    audio: str = Field(..., description="Base64 encoded audio or binary data")
    duration: float = Field(..., description="Audio duration in seconds")
    format: str = Field(..., description="Audio format")
    sample_rate: int = Field(..., description="Sample rate in Hz")
    processing_time: float = Field(..., description="Processing time in seconds")


class VoiceInfo(BaseModel):
    """Voice profile information."""
    id: str = Field(..., description="Unique voice identifier")
    name: str = Field(..., description="Human-readable voice name")
    language: str = Field(..., description="Language code (e.g., 'en')")
    gender: VoiceGender = Field(..., description="Voice gender")
    preview: Optional[str] = Field(None, description="URL to sample audio")


class VoicesResponse(BaseModel):
    """Response model for available voices."""
    voices: list[VoiceInfo] = Field(..., description="List of available voices")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="API version")
    model_loaded: bool = Field(..., description="Whether TTS model is loaded")
    gpu_available: bool = Field(..., description="Whether GPU is available")


class StreamMessage(BaseModel):
    """WebSocket message for streaming."""
    type: str = Field(..., description="Message type: 'synthesize'")
    text: str = Field(..., min_length=1, max_length=10000)
    voice: Optional[str] = Field(default="default")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


class StreamChunk(BaseModel):
    """WebSocket audio chunk response."""
    type: str = Field(..., description="'audio_chunk' or 'complete'")
    data: Optional[bytes] = Field(None, description="Audio data chunk")
    sequence_id: int = Field(..., description="Chunk sequence number")
    is_last: bool = Field(..., description="Whether this is the final chunk")
