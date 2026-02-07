"""Configuration management for STT service."""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""
    
    # Model configuration
    model_path: str = "/models/whisper"
    model_size: str = "base"  # tiny, base, small, medium, large-v2, large-v3
    
    # Server configuration
    host: str = "0.0.0.0"
    port: int = 3003
    
    # Processing configuration
    device: str = "cpu"
    compute_type: str = "int8"  # int8, int16, float32 for CPU
    
    # Language configuration
    default_language: Optional[str] = "en"  # None for auto-detection
    
    # Audio configuration
    sample_rate: int = 16000
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
