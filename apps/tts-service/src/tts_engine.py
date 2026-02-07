"""TTS engine wrapper for Piper TTS."""

import io
import json
import logging
import time
import wave
from pathlib import Path
from typing import Optional

import numpy as np
from piper import PiperVoice

logger = logging.getLogger(__name__)


class TTSEngine:
    """Text-to-Speech engine using Piper."""

    def __init__(
        self,
        model_path: str,
        config_path: str,
        use_cuda: bool = True,
        noise_scale: float = 0.667,
        length_scale: float = 1.0,
        enable_enhancement: bool = True
    ):
        """Initialize TTS engine.
        
        Args:
            model_path: Path to ONNX model file
            config_path: Path to voice config JSON
            use_cuda: Whether to use CUDA acceleration
            noise_scale: Noise amount (lower = clearer)
            length_scale: Speech rate (higher = slower)
            enable_enhancement: Apply audio enhancement
        """
        self.model_path = Path(model_path)
        self.config_path = Path(config_path)
        self.use_cuda = use_cuda
        self.noise_scale = noise_scale
        self.length_scale = length_scale
        self.enable_enhancement = enable_enhancement
        self.model = None
        self.config = None
        self._initialized = False

    def initialize(self) -> None:
        """Load and initialize the TTS model."""
        if self._initialized:
            logger.warning("TTS engine already initialized")
            return

        try:
            logger.info(f"Loading TTS model from {self.model_path}")
            start_time = time.time()

            # Load voice configuration
            with open(self.config_path, "r") as f:
                self.config = json.load(f)

            # Configure ONNX Runtime providers
            if self.use_cuda:
                try:
                    import onnxruntime as ort
                    available_providers = ort.get_available_providers()
                    logger.info(f"Available ONNX providers: {available_providers}")
                    
                    if "CUDAExecutionProvider" in available_providers:
                        logger.info("CUDA provider available, using GPU acceleration")
                    else:
                        logger.warning("CUDA provider not available, falling back to CPU")
                        self.use_cuda = False
                except Exception as e:
                    logger.warning(f"Failed to check CUDA availability: {e}")
                    self.use_cuda = False

            # Initialize Piper voice
            self.model = PiperVoice.load(
                str(self.model_path),
                config_path=str(self.config_path),
                use_cuda=self.use_cuda
            )
            
            load_time = time.time() - start_time
            gpu_status = "GPU" if self.use_cuda else "CPU"
            logger.info(f"TTS model loaded successfully on {gpu_status} in {load_time:.2f}s")
            self._initialized = True

        except Exception as e:
            logger.error(f"Failed to initialize TTS engine: {e}")
            raise RuntimeError(f"TTS engine initialization failed: {e}")

    def synthesize(
        self,
        text: str,
        speed: float = 1.0,
        sample_rate: int = 22050
    ) -> tuple[np.ndarray, int]:
        """Synthesize speech from text.
        
        Args:
            text: Input text to synthesize
            speed: Speaking speed (0.5 - 2.0)
            sample_rate: Target sample rate in Hz
            
        Returns:
            Tuple of (audio_data, sample_rate)
        """
        if not self._initialized:
            raise RuntimeError("TTS engine not initialized. Call initialize() first.")

        try:
            start_time = time.time()
            logger.info(f"Synthesizing text: {text[:50]}...")

            # Synthesize audio using Piper with quality settings
            audio_chunks = []
            synthesis_length_scale = self.length_scale / speed
            
            for audio_bytes in self.model.synthesize_stream_raw(
                text,
                length_scale=synthesis_length_scale,
                noise_scale=self.noise_scale
            ):
                # Convert bytes to numpy array
                audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
                audio_chunks.append(audio_array)
            
            # Concatenate all chunks
            audio_data = np.concatenate(audio_chunks) if audio_chunks else np.array([], dtype=np.int16)
            
            # Convert to float32 normalized between -1 and 1
            audio_data = audio_data.astype(np.float32) / 32768.0
            
            # Get actual sample rate from model config
            actual_sample_rate = self.config.get("sample_rate", 22050)

            synthesis_time = time.time() - start_time
            logger.info(f"Synthesis completed in {synthesis_time:.2f}s, {len(audio_data)} samples")

            return audio_data, actual_sample_rate

        except Exception as e:
            logger.error(f"Synthesis failed: {e}")
            raise RuntimeError(f"Speech synthesis failed: {e}")

    def synthesize_streaming(
        self,
        text: str,
        speed: float = 1.0,
        chunk_size: int = 100
    ):
        """Synthesize speech with streaming output.
        
        Args:
            text: Input text to synthesize
            speed: Speaking speed
            chunk_size: Characters per chunk
            
        Yields:
            Audio data chunks
        """
        # Split text into sentences or chunks
        sentences = self._split_into_sentences(text)

        for sentence in sentences:
            if not sentence.strip():
                continue
                
            audio_data, sample_rate = self.synthesize(sentence, speed)
            yield audio_data, sample_rate

    def _split_into_sentences(self, text: str) -> list[str]:
        """Split text into sentences for streaming.
        
        Args:
            text: Input text
            
        Returns:
            List of sentences
        """
        # Simple sentence splitting (could be improved with NLTK)
        import re
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if s.strip()]

    def audio_to_bytes(
        self,
        audio_data: np.ndarray,
        sample_rate: int,
        format: str = "wav"
    ) -> bytes:
        """Convert audio data to bytes in specified format.
        
        Args:
            audio_data: Audio samples (float32, -1 to 1)
            sample_rate: Sample rate in Hz
            format: Output format ('wav', 'mp3', 'webm')
            
        Returns:
            Audio bytes
        """
        buffer = io.BytesIO()

        if format == "wav":
            # Convert float32 to int16 for WAV
            audio_int16 = (audio_data * 32767).astype(np.int16)
            
            # Write WAV file manually
            with wave.open(buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_int16.tobytes())
        elif format == "mp3":
            # MP3 encoding requires additional libraries (pydub/lameenc)
            logger.warning("MP3 encoding not implemented, using WAV")
            return self.audio_to_bytes(audio_data, sample_rate, "wav")
        elif format == "webm":
            # WebM encoding requires ffmpeg
            logger.warning("WebM encoding not implemented, using WAV")
            return self.audio_to_bytes(audio_data, sample_rate, "wav")
        else:
            raise ValueError(f"Unsupported audio format: {format}")

        buffer.seek(0)
        return buffer.read()

    def _enhance_audio(self, audio_data: np.ndarray) -> np.ndarray:
        """Apply audio enhancement for better quality.
        
        Args:
            audio_data: Raw audio samples (float32, -1 to 1)
            
        Returns:
            Enhanced audio samples
        """
        try:
            # 1. Normalize volume to optimal level
            max_val = np.abs(audio_data).max()
            if max_val > 0:
                # Target peak at 85% to avoid clipping
                target_peak = 0.85
                audio_data = audio_data * (target_peak / max_val)
            
            # 2. Apply subtle high-pass filter to reduce rumble
            # Simple first-order filter (removes very low frequencies)
            if len(audio_data) > 1:
                alpha = 0.95  # Filter coefficient
                filtered = np.zeros_like(audio_data)
                filtered[0] = audio_data[0]
                for i in range(1, len(audio_data)):
                    filtered[i] = alpha * filtered[i-1] + alpha * (audio_data[i] - audio_data[i-1])
                audio_data = filtered
            
            # 3. Soft limiter to prevent clipping
            threshold = 0.95
            audio_data = np.clip(audio_data, -threshold, threshold)
            
            # 4. Apply gentle compression for more consistent volume
            # Simple soft-knee compressor
            compressed = np.copy(audio_data)
            knee = 0.7
            ratio = 3.0  # 3:1 compression
            
            for i in range(len(compressed)):
                abs_val = abs(compressed[i])
                if abs_val > knee:
                    # Apply compression above knee
                    excess = abs_val - knee
                    compressed_excess = excess / ratio
                    new_val = knee + compressed_excess
                    compressed[i] = np.sign(compressed[i]) * new_val
            
            audio_data = compressed
            
            logger.debug("Audio enhancement applied successfully")
            return audio_data
            
        except Exception as e:
            logger.warning(f"Audio enhancement failed: {e}, using raw audio")
            return audio_data

    def shutdown(self) -> None:
        """Cleanup and shutdown the TTS engine."""
        if self._initialized:
            logger.info("Shutting down TTS engine")
            self.model = None
            self._initialized = False


# Global TTS engine instance
_engine: Optional[TTSEngine] = None


def get_engine() -> TTSEngine:
    """Get or create global TTS engine instance."""
    global _engine
    if _engine is None:
        raise RuntimeError("TTS engine not initialized")
    return _engine


def initialize_engine(
    model_path: str, 
    config_path: str, 
    use_cuda: bool = True,
    noise_scale: float = 0.667,
    length_scale: float = 1.0,
    enable_enhancement: bool = True
) -> None:
    """Initialize global TTS engine."""
    global _engine
    _engine = TTSEngine(
        model_path, 
        config_path, 
        use_cuda,
        noise_scale=noise_scale,
        length_scale=length_scale,
        enable_enhancement=enable_enhancement
    )
    _engine.initialize()


def shutdown_engine() -> None:
    """Shutdown global TTS engine."""
    global _engine
    if _engine:
        _engine.shutdown()
        _engine = None
