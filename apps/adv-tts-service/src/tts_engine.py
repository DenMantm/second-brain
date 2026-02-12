"""Advanced TTS engine wrapper with multiple backends."""

import io
import json
import logging
import os
import time
import wave
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from pathlib import Path
from typing import Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


def _get_torch_gpu_snapshot() -> Optional[dict[str, Optional[int] | str]]:
    try:
        import torch
    except Exception:
        return None

    if not torch.cuda.is_available():
        return None

    device_index = torch.cuda.current_device()
    props = torch.cuda.get_device_properties(device_index)
    total_mb = int(props.total_memory / (1024 * 1024))
    allocated_mb = int(torch.cuda.memory_allocated(device_index) / (1024 * 1024))
    reserved_mb = int(torch.cuda.memory_reserved(device_index) / (1024 * 1024))
    free_mb = None
    try:
        free_bytes, total_bytes = torch.cuda.mem_get_info(device_index)
        free_mb = int(free_bytes / (1024 * 1024))
        total_mb = int(total_bytes / (1024 * 1024))
    except Exception:
        pass

    return {
        "device_index": device_index,
        "name": props.name,
        "total_mb": total_mb,
        "reserved_mb": reserved_mb,
        "allocated_mb": allocated_mb,
        "free_mb": free_mb,
    }


def _log_gpu_snapshot(prefix: str) -> None:
    snapshot = _get_torch_gpu_snapshot()
    if not snapshot:
        return

    free_mb = snapshot.get("free_mb")
    free_part = f", free={free_mb}MB" if isinstance(free_mb, int) else ""
    logger.info(
        f"{prefix} GPU {snapshot['name']} (idx={snapshot['device_index']}), "
        f"total={snapshot['total_mb']}MB, reserved={snapshot['reserved_mb']}MB, "
        f"allocated={snapshot['allocated_mb']}MB{free_part}"
    )


class BaseTTSEngine:
    """Base class for TTS engines."""

    def __init__(self) -> None:
        self._initialized = False

    def initialize(self) -> None:
        raise NotImplementedError

    def synthesize(
        self,
        text: str,
        speed: float,
        sample_rate: int,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        instruct: Optional[str] = None
    ) -> Tuple[np.ndarray, int]:
        raise NotImplementedError

    def synthesize_streaming(
        self,
        text: str,
        speed: float,
        chunk_size: int,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        instruct: Optional[str] = None
    ):
        raise NotImplementedError

    def get_supported_speakers(self) -> list[str]:
        return []

    def audio_to_bytes(self, audio_data: np.ndarray, sample_rate: int, format: str = "wav") -> bytes:
        buffer = io.BytesIO()

        if format == "wav":
            audio_int16 = (audio_data * 32767).astype(np.int16)
            with wave.open(buffer, "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_int16.tobytes())
        elif format == "mp3":
            logger.warning("MP3 encoding not implemented, using WAV")
            return self.audio_to_bytes(audio_data, sample_rate, "wav")
        elif format == "webm":
            logger.warning("WebM encoding not implemented, using WAV")
            return self.audio_to_bytes(audio_data, sample_rate, "wav")
        else:
            raise ValueError(f"Unsupported audio format: {format}")

        buffer.seek(0)
        return buffer.read()

    def _enhance_audio(self, audio_data: np.ndarray) -> np.ndarray:
        try:
            max_val = np.abs(audio_data).max()
            if max_val > 0:
                target_peak = 0.85
                audio_data = audio_data * (target_peak / max_val)

            if len(audio_data) > 1:
                alpha = 0.95
                filtered = np.zeros_like(audio_data)
                filtered[0] = audio_data[0]
                for i in range(1, len(audio_data)):
                    filtered[i] = alpha * filtered[i - 1] + alpha * (audio_data[i] - audio_data[i - 1])
                audio_data = filtered

            threshold = 0.95
            audio_data = np.clip(audio_data, -threshold, threshold)

            return audio_data
        except Exception as e:
            logger.warning(f"Audio enhancement failed: {e}")
            return audio_data


class PiperEngine(BaseTTSEngine):
    """Piper TTS engine wrapper."""

    def __init__(
        self,
        model_path: str,
        config_path: str,
        use_cuda: bool,
        noise_scale: float,
        length_scale: float,
        enable_enhancement: bool
    ) -> None:
        super().__init__()
        self.model_path = Path(model_path)
        self.config_path = Path(config_path)
        self.use_cuda = use_cuda
        self.noise_scale = noise_scale
        self.length_scale = length_scale
        self.enable_enhancement = enable_enhancement
        self.model = None
        self.config = None

    def initialize(self) -> None:
        if self._initialized:
            logger.warning("Piper engine already initialized")
            return

        try:
            from piper import PiperVoice

            logger.info(f"Loading Piper model from {self.model_path}")
            start_time = time.time()

            with open(self.config_path, "r") as f:
                self.config = json.load(f)

            if self.use_cuda:
                try:
                    import onnxruntime as ort
                    available_providers = ort.get_available_providers()
                    logger.info(f"Available ONNX providers: {available_providers}")
                    if "CUDAExecutionProvider" not in available_providers:
                        logger.warning("CUDA provider not available, falling back to CPU")
                        self.use_cuda = False
                except Exception as e:
                    logger.warning(f"Failed to check CUDA availability: {e}")
                    self.use_cuda = False

            self.model = PiperVoice.load(
                str(self.model_path),
                config_path=str(self.config_path),
                use_cuda=self.use_cuda
            )

            load_time = time.time() - start_time
            gpu_status = "GPU" if self.use_cuda else "CPU"
            logger.info(f"Piper model loaded on {gpu_status} in {load_time:.2f}s")
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize Piper: {e}")
            raise RuntimeError(f"Piper initialization failed: {e}")

    def synthesize(
        self,
        text: str,
        speed: float,
        sample_rate: int,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        instruct: Optional[str] = None
    ) -> Tuple[np.ndarray, int]:
        if not self._initialized:
            raise RuntimeError("Piper engine not initialized")

        try:
            start_time = time.time()
            audio_chunks = []
            synthesis_length_scale = self.length_scale / speed

            for audio_bytes in self.model.synthesize_stream_raw(
                text,
                length_scale=synthesis_length_scale,
                noise_scale=self.noise_scale
            ):
                audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
                audio_chunks.append(audio_array)

            audio_data = np.concatenate(audio_chunks) if audio_chunks else np.array([], dtype=np.int16)
            audio_data = audio_data.astype(np.float32) / 32768.0
            actual_sample_rate = self.config.get("sample_rate", 22050) if self.config else 22050

            if self.enable_enhancement:
                audio_data = self._enhance_audio(audio_data)

            synthesis_time = time.time() - start_time
            logger.info(f"Piper synthesis completed in {synthesis_time:.2f}s")

            return audio_data, actual_sample_rate
        except Exception as e:
            logger.error(f"Piper synthesis failed: {e}")
            raise RuntimeError(f"Speech synthesis failed: {e}")

    def synthesize_streaming(
        self,
        text: str,
        speed: float,
        chunk_size: int,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        instruct: Optional[str] = None
    ):
        sentences = self._split_into_sentences(text)
        default_rate = self.config.get("sample_rate", 22050) if self.config else 22050
        for sentence in sentences:
            if not sentence.strip():
                continue
            audio_data, sample_rate = self.synthesize(
                sentence,
                speed,
                default_rate,
                voice=voice,
                language=language,
                instruct=instruct
            )
            yield audio_data, sample_rate

    def _split_into_sentences(self, text: str) -> list[str]:
        import re
        sentences = re.split(r"[.!?]+", text)
        return [s.strip() for s in sentences if s.strip()]


class KokoroEngine(BaseTTSEngine):
    """Kokoro TTS engine wrapper (adapter)."""

    def __init__(self, model_path: str) -> None:
        super().__init__()
        self.model_path = Path(model_path)
        self.model = None

    def initialize(self) -> None:
        if self._initialized:
            logger.warning("Kokoro engine already initialized")
            return

        try:
            import kokoro  # type: ignore
        except Exception as e:
            raise RuntimeError(
                "Kokoro engine is not installed. Install Kokoro and its dependencies before use."
            ) from e

        # Placeholder: adapt to Kokoro API when available
        self.model = kokoro
        self._initialized = True

    def synthesize(
        self,
        text: str,
        speed: float,
        sample_rate: int,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        instruct: Optional[str] = None
    ) -> Tuple[np.ndarray, int]:
        raise RuntimeError("Kokoro engine adapter not implemented yet")

    def synthesize_streaming(
        self,
        text: str,
        speed: float,
        chunk_size: int,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        instruct: Optional[str] = None
    ):
        raise RuntimeError("Kokoro engine adapter not implemented yet")


class Qwen3Engine(BaseTTSEngine):
    """Qwen3 TTS engine wrapper (adapter)."""

    def __init__(
        self,
        model_name: str,
        model_path: str,
        default_language: str,
        default_instruct: str,
        init_timeout_s: int,
        synthesize_timeout_s: int,
        use_quantization: bool = False,
        use_compile: bool = True
    ) -> None:
        super().__init__()
        self.model_name = model_name
        self.model_path = Path(model_path)
        self.model = None
        self.default_language = default_language
        self.default_instruct = default_instruct
        self.init_timeout_s = init_timeout_s
        self.synthesize_timeout_s = synthesize_timeout_s
        self.use_quantization = use_quantization
        self.use_compile = use_compile
        self.device_map = None
        self.dtype = None

    def initialize(self) -> None:
        if self._initialized:
            logger.warning("Qwen3 engine already initialized")
            return

        try:
            import torch
            from qwen_tts import Qwen3TTSModel
        except Exception as e:
            raise RuntimeError(
                "Qwen3 engine requires qwen-tts and torch. Install dependencies before use."
            ) from e

        use_cuda = torch.cuda.is_available()
        
        # Enable GPU optimizations
        if use_cuda:
            # Enable TF32 for Ampere+ GPUs (RTX 30/40 series)
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True
            # Enable cuDNN benchmarking for faster convolutions
            torch.backends.cudnn.benchmark = True
            logger.info("GPU optimizations enabled: TF32=True, cuDNN benchmark=True")
        
        self.device_map = "cuda:0" if use_cuda else "cpu"
        if use_cuda:
            if self.use_quantization:
                self.dtype = None  # Let quantization handle dtype
            else:
                self.dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
        else:
            self.dtype = torch.float32

        model_source = str(self.model_path) if self.model_path.exists() else self.model_name
        logger.info(f"Loading Qwen3-TTS model: {model_source}")

        load_kwargs = {
            "device_map": self.device_map,
        }
        
        if not self.use_quantization:
            load_kwargs["dtype"] = self.dtype
        
        # Enable optimized attention using SDPA (works on Windows, uses FlashAttention2 if available)
        if use_cuda:
            load_kwargs["attn_implementation"] = "sdpa"
            logger.info("Using SDPA (Scaled Dot Product Attention) for optimized inference")
        
        # Add 4-bit quantization if enabled
        if self.use_quantization and use_cuda:
            try:
                from transformers import BitsAndBytesConfig
                quantization_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
                    bnb_4bit_use_double_quant=True,
                    bnb_4bit_quant_type="nf4"
                )
                load_kwargs["quantization_config"] = quantization_config
                logger.info("4-bit quantization enabled (NF4)")
            except ImportError:
                logger.warning("bitsandbytes not available, skipping quantization")
                self.use_quantization = False
                load_kwargs["dtype"] = self.dtype

        def _load_model() -> object:
            return Qwen3TTSModel.from_pretrained(model_source, **load_kwargs)

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_load_model)
            try:
                self.model = future.result(timeout=self.init_timeout_s)
            except TimeoutError as e:
                raise RuntimeError(
                    f"Qwen3 model load timed out after {self.init_timeout_s}s"
                ) from e
        
        # Apply torch.compile for 2-3x speedup (after warmup)
        if self.use_compile and use_cuda:
            try:
                logger.info("Compiling model with torch.compile...")
                # Compile the generate method for faster inference
                if hasattr(self.model, 'generate_custom_voice'):
                    original_method = self.model.generate_custom_voice
                    self.model.generate_custom_voice = torch.compile(
                        original_method,
                        mode="reduce-overhead",
                        fullgraph=False
                    )
                logger.info("Model compiled successfully")
            except Exception as e:
                logger.warning(f"torch.compile failed: {e}, continuing without compilation")
                self.use_compile = False
        
        # Warmup inference for GPU memory preallocation and optimization
        if use_cuda:
            try:
                logger.info("Running warmup inference to preallocate GPU memory...")
                warmup_start = time.time()
                # Use longer text to preallocate buffers for variable-length inputs
                warmup_text = "Hello, this is a warmup sentence to preallocate GPU memory buffers for better performance."
                _, _ = self.model.generate_custom_voice(
                    text=warmup_text,
                    language="Auto",
                    speaker="Vivian",
                    instruct=""
                )
                warmup_time = time.time() - warmup_start
                logger.info(f"Warmup completed in {warmup_time:.2f}s")
            except Exception as e:
                logger.warning(f"Warmup failed: {e}")
        
        logger.info(f"Qwen3 device={self.device_map}, dtype={self.dtype}, quantized={self.use_quantization}, compiled={self.use_compile}")
        _log_gpu_snapshot("Qwen3 init")
        self._initialized = True

    def synthesize(
        self,
        text: str,
        speed: float,
        sample_rate: int,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        instruct: Optional[str] = None
    ) -> Tuple[np.ndarray, int]:
        if not self._initialized:
            raise RuntimeError("Qwen3 engine not initialized")

        try:
            before_snapshot = _get_torch_gpu_snapshot()
            lang = language or self.default_language
            prompt = instruct if instruct is not None else self.default_instruct

            speaker = voice or "Vivian"
            if hasattr(self.model, "get_supported_speakers"):
                speakers = self.model.get_supported_speakers()
                if speakers and speaker not in speakers:
                    speaker = speakers[0]

            def _generate() -> Tuple[object, int]:
                return self.model.generate_custom_voice(
                    text=text,
                    language=lang,
                    speaker=speaker,
                    instruct=prompt
                )

            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_generate)
                try:
                    wavs, sr = future.result(timeout=self.synthesize_timeout_s)
                except TimeoutError as e:
                    raise RuntimeError(
                        f"Qwen3 synthesis timed out after {self.synthesize_timeout_s}s"
                    ) from e

            audio_data = wavs[0] if isinstance(wavs, list) else wavs
            if isinstance(audio_data, np.ndarray) and audio_data.dtype != np.float32:
                audio_data = audio_data.astype(np.float32)

            after_snapshot = _get_torch_gpu_snapshot()
            if before_snapshot and after_snapshot:
                delta_alloc = after_snapshot["allocated_mb"] - before_snapshot["allocated_mb"]
                delta_res = after_snapshot["reserved_mb"] - before_snapshot["reserved_mb"]
                logger.info(
                    "Qwen3 GPU delta: "
                    f"allocated={delta_alloc}MB, reserved={delta_res}MB"
                )
                _log_gpu_snapshot("Qwen3 synth")

            return audio_data, sr
        except Exception as e:
            logger.error(f"Qwen3 synthesis failed: {e}")
            raise RuntimeError(f"Qwen3 synthesis failed: {e}")

    def synthesize_streaming(
        self,
        text: str,
        speed: float,
        chunk_size: int,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        instruct: Optional[str] = None
    ):
        sentences = self._split_into_sentences(text)
        target_rate = 24000
        for sentence in sentences:
            if not sentence.strip():
                continue
            audio_data, sample_rate = self.synthesize(
                sentence,
                speed,
                sample_rate=target_rate,
                voice=voice,
                language=language,
                instruct=instruct
            )
            yield audio_data, sample_rate

    def _split_into_sentences(self, text: str) -> list[str]:
        import re
        sentences = re.split(r"[.!?]+", text)
        return [s.strip() for s in sentences if s.strip()]

    def get_supported_speakers(self) -> list[str]:
        if not self._initialized:
            return []
        if hasattr(self.model, "get_supported_speakers"):
            return list(self.model.get_supported_speakers())
        return []


class PocketTTSEngine(BaseTTSEngine):
    """Pocket TTS engine wrapper - lightweight CPU TTS."""

    # Pre-made voices from Pocket TTS
    VOICE_CATALOG = [
        "alba", "marius", "javert", "jean",
        "fantine", "cosette", "eponine", "azelma"
    ]

    def __init__(
        self,
        default_voice: str = "alba",
        enable_enhancement: bool = False
    ) -> None:
        super().__init__()
        self.model = None
        self.voice_states = {}  # Cache for voice states
        self.default_voice = default_voice
        self.enable_enhancement = enable_enhancement
        self.sample_rate = 24000  # Pocket TTS uses 24kHz

    def initialize(self) -> None:
        if self._initialized:
            logger.warning("PocketTTS engine already initialized")
            return

        try:
            from pocket_tts import TTSModel
        except Exception as e:
            raise RuntimeError(
                "PocketTTS engine requires pocket-tts. Install with: pip install pocket-tts"
            ) from e

        logger.info("Loading Pocket TTS model (without voice cloning)...")
        start = time.time()
        # pocket-tts doesn't support repo_id parameter, it always uses the public model
        self.model = TTSModel.load_model()
        load_time = time.time() - start
        logger.info(f"Pocket TTS model loaded in {load_time:.2f}s")
        
        # Pre-load default voice
        self._load_voice(self.default_voice)
        
        logger.info(f"Pocket TTS initialized (sample_rate={self.sample_rate}Hz)")
        self._initialized = True

    def _load_voice(self, voice: str) -> None:
        """Load and cache a voice state."""
        if voice in self.voice_states:
            return
        
        start = time.time()
        self.voice_states[voice] = self.model.get_state_for_audio_prompt(voice)
        load_time = time.time() - start
        logger.info(f"Loaded voice '{voice}' in {load_time:.2f}s")

    def synthesize(
        self,
        text: str,
        speed: float,
        sample_rate: int,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        instruct: Optional[str] = None
    ) -> Tuple[np.ndarray, int]:
        if not self._initialized:
            raise RuntimeError("PocketTTS engine not initialized")

        # Use default voice if not specified
        voice = voice or self.default_voice
        
        # Load voice if not cached
        self._load_voice(voice)
        
        # Generate audio
        start = time.time()
        audio_tensor = self.model.generate_audio(
            self.voice_states[voice],
            text
        )
        gen_time = time.time() - start
        
        # Convert torch tensor to numpy
        audio = audio_tensor.cpu().numpy()
        
        # Apply speed adjustment if needed
        if speed != 1.0:
            audio = self._adjust_speed(audio, speed)
        
        # Apply enhancement if enabled
        if self.enable_enhancement:
            audio = self._enhance_audio(audio)
        
        logger.info(
            f"PocketTTS generated {len(text)} chars in {gen_time:.2f}s "
            f"({len(audio)/self.sample_rate:.2f}s audio, {len(text)/gen_time:.1f} chars/s)"
        )
        
        # Return audio at native sample rate (Pocket TTS is 24kHz)
        return audio, self.sample_rate

    def _adjust_speed(self, audio: np.ndarray, speed: float) -> np.ndarray:
        """Adjust playback speed without changing pitch."""
        from scipy import signal
        
        # Simple resampling for speed control
        num_samples = int(len(audio) / speed)
        return signal.resample(audio, num_samples)

    def synthesize_streaming(
        self,
        text: str,
        speed: float,
        chunk_size: int,
        voice: Optional[str] = None,
        language: Optional[str] = None,
        instruct: Optional[str] = None
    ):
        """Streaming synthesis (Pocket TTS supports this natively)."""
        if not self._initialized:
            raise RuntimeError("PocketTTS engine not initialized")

        voice = voice or self.default_voice
        self._load_voice(voice)
        
        # Pocket TTS has streaming support
        for audio_chunk in self.model.generate_audio_streaming(
            self.voice_states[voice],
            text
        ):
            audio = audio_chunk.cpu().numpy()
            
            if speed != 1.0:
                audio = self._adjust_speed(audio, speed)
            
            if self.enable_enhancement:
                audio = self._enhance_audio(audio)
            
            yield audio, self.sample_rate

    def get_supported_speakers(self) -> list[str]:
        return self.VOICE_CATALOG


_engine: Optional[BaseTTSEngine] = None


def initialize_engine(settings) -> None:
    global _engine

    if settings.model_type == "piper":
        _engine = PiperEngine(
            model_path=settings.piper_model_path,
            config_path=settings.piper_voice_config_path,
            use_cuda=True,
            noise_scale=settings.tts_noise_scale,
            length_scale=settings.tts_length_scale,
            enable_enhancement=settings.enable_audio_enhancement
        )
    elif settings.model_type == "kokoro":
        _engine = KokoroEngine(model_path=settings.kokoro_model_path)
    elif settings.model_type == "pocket":
        _engine = PocketTTSEngine(
            default_voice=getattr(settings, "pocket_default_voice", "alba"),
            enable_enhancement=settings.enable_audio_enhancement
        )
    elif settings.model_type == "qwen3":
        _engine = Qwen3Engine(
            model_name=settings.qwen3_model_name,
            model_path=settings.qwen3_model_path,
            default_language=settings.qwen3_language,
            default_instruct=settings.qwen3_instruct,
            init_timeout_s=settings.qwen3_init_timeout_s,
            synthesize_timeout_s=settings.qwen3_synthesize_timeout_s,
            use_quantization=settings.qwen3_use_quantization,
            use_compile=settings.qwen3_use_compile
        )
    else:
        raise RuntimeError(f"Unknown engine: {settings.model_type}")

    _engine.initialize()


def shutdown_engine() -> None:
    global _engine
    _engine = None


def get_engine() -> BaseTTSEngine:
    if _engine is None:
        raise RuntimeError("TTS engine not initialized")
    return _engine
