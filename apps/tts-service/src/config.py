"""Configuration management for TTS service."""

from functools import lru_cache
from typing import Literal

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
    port: int = 3002
    workers: int = 1
    reload: bool = True

    # Environment
    environment: Literal["development", "production"] = "development"
    log_level: Literal["debug", "info", "warning", "error"] = "info"

    # Model Configuration
    model_type: str = "piper"
    model_path: str = "/mnt/c/Interesting/repos/second-brain/models/piper/en_US-lessac-medium.onnx"
    voice_config_path: str = "/mnt/c/Interesting/repos/second-brain/models/piper/en_US-lessac-medium.onnx.json"

    # Performance
    max_workers: int = 2
    stream_chunk_size: int = 100
    buffer_size: int = 4096

    # Caching
    enable_cache: bool = False
    cache_ttl: int = 3600
    redis_url: str = "redis://localhost:6379"

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
