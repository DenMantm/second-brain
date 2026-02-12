"""Configuration management for advanced TTS service."""

from functools import lru_cache
from typing import Literal, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8083
    workers: int = 1
    reload: bool = True

    # Environment
    environment: Literal["development", "production"] = "development"
    log_level: Literal["debug", "info", "warning", "error"] = "info"

    # Engine selection
    model_type: Literal["piper", "kokoro", "pocket", "qwen3"] = "piper"

    # Piper
    piper_model_path: str = "/models/piper/en_US-lessac-medium.onnx"
    piper_voice_config_path: str = "/models/piper/en_US-lessac-medium.onnx.json"

    # Kokoro (placeholders, override with env vars)
    kokoro_model_path: str = "/models/kokoro"

    # Pocket TTS
    pocket_default_voice: str = "alba"

    # Qwen3
    qwen3_model_name: str = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
    qwen3_model_path: str = "/models/qwen3"
    qwen3_language: str = "Auto"
    qwen3_instruct: str = ""
    qwen3_init_timeout_s: int = 120
    qwen3_synthesize_timeout_s: int = 60
    qwen3_use_quantization: bool = False
    qwen3_use_compile: bool = False

    # Audio Quality Settings
    tts_sample_rate: int = 22050
    tts_noise_scale: float = 0.6
    tts_length_scale: float = 1.0
    tts_speaker_id: Optional[int] = None
    enable_audio_enhancement: bool = False

    # Performance
    max_workers: int = 2
    stream_chunk_size: int = 100
    buffer_size: int = 4096

    # CUDA
    cuda_visible_devices: str = "0"

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.environment == "development"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
