# Speech-to-Text (STT) Service

## Overview

The STT service converts voice audio input into text transcriptions for the Second Brain assistant. This service is optimized for real-time voice interaction with sub-2-second response times, running entirely locally for privacy.

## Technology Stack

- **Runtime**: Python 3.11
- **Framework**: FastAPI (async HTTP server)
- **Engine**: [Faster-Whisper](https://github.com/guillaumekln/faster-whisper) (CTranslate2)
- **Model**: Whisper Medium or Small (depending on GPU memory)
- **Acceleration**: CUDA 12.1+ (RTX 4060 Ti 16GB)
- **Quantization**: INT8 for faster inference

## Key Features

### Real-time Processing
- Streaming audio support via WebSocket
- Chunk-based processing for live transcription
- Voice Activity Detection (VAD) to reduce processing overhead
- Optimized for conversational speech

### Language Support
- Primary: English
- Extensible: Multi-language detection and transcription
- Automatic language detection option

### Audio Formats
- **Input**: WAV, MP3, FLAC, WebM
- **Sample Rate**: 16kHz (optimal for Whisper)
- **Channels**: Mono (stereo will be converted)

## Architecture

```
┌─────────────────────┐
│  Audio Input        │
│  (Raspberry Pi /    │
│   Web Interface)    │
└──────────┬──────────┘
           │ WebSocket/HTTP
           ↓
┌─────────────────────┐
│  FastAPI Server     │
│  (Python)           │
│  - Audio validation │
│  - Format conversion│
│  - Request queuing  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Faster-Whisper     │
│  (CTranslate2)      │
│  - VAD filtering    │
│  - Beam search      │
│  - GPU inference    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Post-processing    │
│  - Punctuation      │
│  - Normalization    │
│  - Confidence scores│
└──────────┬──────────┘
           │
           ↓
    Transcribed Text
```

## API Endpoints

###typescript
POST /api/stt/transcribe
Content-Type: multipart/form-data
Body: { audio: File }

Response: {
  text: string,
  language: string,
  confidence: number,
  duration: number,
  processingTime: number
}
```

### WebSocket Endpoint

```typescript
WS /api/stt/stream

// Client → Server
{
  type: "audio_chunk",
  data: ArrayBuffer,
  format: "wav" | "webm",
  sampleRate: 16000
}

//

# Server → Client
{
  type: "partial" | "final",
  text: string,
  confidence: number,
  isFinal: boolean
}
```

## Configuration

### Model Selection

```python
# whisper-small: ~500MB VRAM, faster, good for simple queries
# whisper-medium: ~1.5GB VRAM, better accuracy
# whisper-large-v3: ~3GB VRAM, best accuracy (if needed)

MODEL_SIZE = "medium"  # Configurable via env
COMPUTE_TYPE = "int8"  # int8 for speed, float16 for accuracy
DEVICE = "cuda"
MODEL_PATH = "/models/whisper"
```

### Performance Tuning

```python
# Beam search width (higher = more accurate, slower)
BEAM_SIZE = 5

# VAD threshold (0-1, higher = less sensitive)
VAD_THRESHOLD = 0.5

# Chunk duration for streaming (seconds)
CHUNK_DURATION = 2.0

# Max concurrent requests
MAX_WORKERS = 2
```

## Implementation Plan

### Phase 1: Basic Transcription ✅ (To Do)
- [ ] Set up FastAPI server
- [ ] Integrate Faster-Whisper with CUDA
- [ ] Implement single-file transcription endpoint
- [ ] Add audio format validation and conversion
- [ ] Create health check endpoint

### Phase 2: Streaming Support
- [ ] Implement WebSocket streaming
- [ ] Add VAD for silence detection
- [ ] Implement chunked processing
- [ ] Add partial transcription results

### Phase 3: Optimization
- [ ] GPU memory management
- [ ] Request queuing and batching
- [ ] Model caching in VRAM
- [ ] Performance monitoring and logging

### Phase 4: Advanced Features
- [ ] Multi-language support
- [ ] Speaker diarization (optional)
- [ ] Noise reduction preprocessing
- [ ] Custom vocabulary/hotwords

## Performance Targets

- **Latency**: < 1 second for 5-second audio clip
- **Throughput**: 2-3 concurrent streams
- **Accuracy**: > 95% WER (Word Error Rate) for clear speech
- **GPU Usage**: < 2GB VRAM for model + processing
json
{
  "dependencies": {
    "fastify": "^4.26.0",
    "@fastify/multipart": "^8.1.0",
    "@fastify/websocket": "^10.0.1",
    "@fastify/cors": "^9.0.1",
    "@xenova/transformers": "^2.17.0",
    "whisper-node": "^1.1.0",
    "node-wav": "^0.0.2",
    "fluent-ffmpeg": "^2.1.2",
    "@silvia-odwyer/node-vad": "^3.0.0",
    "pino": "^8.19.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.16",
    "@types/fluent-ffmpeg": "^2.1.24",
    "typescript": "^5.3.3",
    "tsx": "^4.7.1",
    "vitest": "^1.2.2"
  }
}
```

## Environment Setup

Runs in WSL2 with CUDA support. See [WSL_SETUP.md](../../docs/WSL_SETUP.md) for installation guide.M nvidia/cuda:12.1.0-runtime-ubuntu22.04
# Install Python 3.11, CUDA toolkit, and dependencies
# Optimized for GPU inference
```

## Testing Strategy

- **Unit Tests**: Audio processing, model inference
- **Integration Tests**: End-to-end transcription flow
- **Performance Tests**: Latency benchmarks, GPU memory profiling
- **Load Tests**: Concurrent request handling

## Privacy & Security

- ✅ **100% Local Processing**: No external API calls
- ✅ **No Data Retention**: Audio discarded after transcription
- ✅ **Secure Communication**: WSS for encrypted streaming
- ✅ **Input Validation**: File size limits, format checks

## Monitoring

- Request latency metrics
- GPU utilization tracking
- Error rate monitoring
- Queue depth tracking

## Related Services

- **TTS Service**: Text-to-Speech output
- **API Service**: Main orchestration layer
- **LLM Service**: Natural language understanding

---

**Status**: 🚧 Planning Phase  
**Owner**: Second Brain Team  
**Last Updated**: February 7, 2026
