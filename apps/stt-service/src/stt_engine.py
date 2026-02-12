"""Speech-to-Text engine using Faster Whisper."""
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import time

from faster_whisper import WhisperModel

from .config import settings

logger = logging.getLogger(__name__)


class STTEngine:
    """Speech-to-Text engine wrapper."""
    
    def __init__(self):
        """Initialize STT engine."""
        self.model: Optional[WhisperModel] = None
        self.model_loaded = False
        
    def load_model(self):
        """Load Whisper model."""
        if self.model_loaded:
            logger.info("Model already loaded")
            return
            
        try:
            start_time = time.time()
            logger.info(f"Loading Whisper model: {settings.model_size}")
            logger.info(f"Device: {settings.device}, Compute type: {settings.compute_type}")
            
            self.model = WhisperModel(
                settings.model_size,
                device=settings.device,
                compute_type=settings.compute_type,
                download_root=settings.model_path
            )
            
            load_time = time.time() - start_time
            logger.info(f"Whisper model loaded successfully on {settings.device.upper()} in {load_time:.2f}s")
            self.model_loaded = True
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> Dict[str, Any]:
        """
        Transcribe audio file.
        
        Args:
            audio_path: Path to audio file
            language: Language code (None for auto-detection)
            task: "transcribe" or "translate" (to English)
            
        Returns:
            Dict with transcription results
        """
        if not self.model_loaded:
            self.load_model()
        
        try:
            start_time = time.time()
            
            # Use default language if not specified
            lang = language or settings.default_language
            
            logger.info(f"Transcribing audio: {audio_path} (language: {lang})")
            
            segments, info = self.model.transcribe(
                audio_path,
                language=lang,
                task=task,
                beam_size=10,  # Increased from 5 for better accuracy
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=300,  # Reduced from 500ms to catch more speech
                    threshold=0.3  # Lower threshold = more sensitive to speech
                )
            )
            
            # Collect all segments
            full_text = ""
            segment_list = []
            
            for segment in segments:
                full_text += segment.text + " "
                segment_list.append({
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip()
                })
            
            inference_time = time.time() - start_time
            
            result = {
                "text": full_text.strip(),
                "segments": segment_list,
                "language": info.language,
                "language_probability": info.language_probability,
                "duration": info.duration,
                "inference_time": inference_time
            }
            
            logger.info(f"Transcription completed in {inference_time:.2f}s")
            logger.info(f"Detected language: {info.language} (confidence: {info.language_probability:.2f})")
            
            return result
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise


# Global engine instance
stt_engine = STTEngine()
