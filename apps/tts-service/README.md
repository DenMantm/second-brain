# Text-to-Speech (TTS) Service

## Overview

The TTS service converts text responses from the Second Brain assistant into natural-sounding speech for voice output. Designed for real-time conversational AI with low latency and high-quality voice synthesis, running entirely on local hardware.

## Technology Stack

- **Runtime**: Python 3.11
- **Framework**: FastAPI (async HTTP server)
- **Engine**: [Piper TTS](https://github.com/rhasspy/piper) (ONNX runtime) - primary
- **Alternative**: [Coqui TTS](https://github.com/coqui-ai/TTS) (XTTS v2) - for voice cloning
- **Acceleration**: ONNX Runtime with CUDA support (RTX 4060 Ti 16GB)
- **Voice Quality**: 22kHz sample rate, natural prosody

## Key Features

### Natural Voice Synthesis
- High-quality neural TTS models
- Expressive speech with proper intonation
- Configurable speaking rate and pitch
- Multiple voice profiles (male/female options)

### Streaming Support
- Word-level or sentence-level streaming
- Reduced time-to-first-audio
- Chunked audio generation for real-time playback
- Optimized for conversational flow

### Audio Output Formats
- **Primary**: WAV (PCM 16-bit)
- **Streaming**: Opus in WebM (low latency)
- **Compressed**: MP3 for storage (optional)
- **Sample Rates**: 16kHz, 22kHz, 24kHz

## Architecture

```
┌─────────────────────┐
│  Text Input         │
│  (from LLM Service) │
└──────────┬──────────┘
           │ HTTP/WebSocket
           ↓
┌──────ify Server     │
│  (TypeScript)       │
│  - Text validation  │
│  - SSML parsing     │
│  - Queue management │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Pre-processing     │
│  - Text cleanup     │
│  - Sentence splitting│
│  - Phoneme conversion│
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Piper TTS          │
│  (ONNX Runtime)     │
│  - Neural vocoder   │
│  - GPU acceleration │
│  - Fast inferenceon │
│  - Voice cloning    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Post-processing    │
│  - Audio normalization│
│  - Format conversion│
│  - Streaming chunks │
└──────────┬──────────┘
           │
           ↓
    Audio Output
    (WAV/WebM/MP3)
```

## API Endpoints

### HTTP Endpoints

```python
POST /api/tts/synthesize
Content-Type: application/json
Body: {
  text: string,
  voice?: string,
  speed?: number,      # 0.5 - 2.0
  format?: "wav" | "mp3" | "webm"
}

Response: {
  audio: base64 | binary,
  duration: number,
  format: string,
  sampleRate: number,
  processingTime: number
}
```

### WebSocket Endpoint

```python
WS /api/tts/stream

# Client → Server
{
  type: "synthesize",
  text: string,
  voice?: string,
  speed?: number
}

# Server → Client (chunked)
{
  type: "audio_chunk" | "complete",
  data: ArrayBuffer,
  sequenceId: number,
  isLast: boolean
}
```

### Voice Management

```python
GET /api/tts/voices
Response: {
  voices: List[{
    id: str,
    name: str,
    language: str,
    gender: "male" | "female" | "neutral",
    preview: Optional[str]  # Sample audio URL
  }]
}
```

## Configuration

### Model Selection

```python
# Piper: Fast, good quality, ONNX-based
# Using pre-trained voices from Piper repository

MODEL_TYPE = "piper"
  MODEL_PATH: '/models/piper/en_US-lessac-medium.onnx',
  VOICE_CONFIG: '/models/piper/en_US-lessac-medium.onnx.json'
} as const;
```

### Voice Profiles

```typescript
const VOICES = {
  default: {
    model: 'en_US-lessac-medium',
    language: 'en',
    speed: 1.0
  },
  assistant: {
    model: 'en_US-lessac-medium',
    language: 'en',
    speed: 1.1,
  },
  reader: {
    model: 'en_US-danny-low',
    language: 'en',
    speed: 0.9
  }
} as const;
```

### Performance Tuning

```typescript
// Streaming chunk size (characters)
const STREAM_CHUNK_SIZE = 100;

// Max concurrent synthesis requests
const MAX_WORKERS = 2;

// Audio buffer size for streaming
const BUFFER_SIZE = 4096;

// Cache synthesized audio for repeated phrases
const ENABLE_CACHE = true;
const CACHE_TTL = 3600; // audio for repeated phrases
ENABLE_CACHE = True
CACHE_TTL = 3600  # 1 hour
```

## Implementation Plan

### Phase 1: Basic Synthesis ✅ (To Do)
- [ ] Set up FastAPI server
- [ ] Integrate Coqui TTS with CUDA
- [ ] Implement single-text synthesis endpoint
- [ ] Add voice selection support
- [ ] Create health check endpoint

### Phase 2: Streaming Support
- [ ] Implement WebSocket streaming
- [ ] Add sentence-level chunking
- [ ] Real-time audio generation
- [ ] Buffer management for smooth playback

### Phase 3: Optimization
- [ ] GPU memory management
- [ ] Audio caching for common phrases
- [ ] Model pre-loading and warmup
- [ ] Concurrent request handling

### Phase 4: Advanced Features
- [ ] SSML support (pitch, rate, pauses)
- [ ] Emotion/style control
- [ ] Voice cloning (optional)
- [ ] Multi-language support

## Performance Targets

- **Latency**: < 500ms for first audio chunk
- **Throughput**: 2-3 concurrent synthesis
- **Quality**: MOS score > 4.0 (naturalness)
- **GPU Usage**: < 2GB VRAM for model + processing
- **Real-time Factor**: < 0.5 (faster than real-time)
json
{
  "dependencies": {
    "fastify": "^4.26.0",
    "@fastify/websocket": "^10.0.1",
    "@fastify/cors": "^9.0.1",
    "node-piper-tts": "^1.0.0",
    "onnxruntime-node": "^1.16.3",
    "fluent-ffmpeg": "^2.1.2",
    "wav": "^1.0.2",
    "compromise": "^14.11.0",
    "pino": "^8.19.0",
    "zod": "^3.22.4",
    "ioredis": "^5.3.2"
  },
  "devDependencies": {
    "@types/node": "^20.11.16",
    "@types/fluent-ffmpeg": "^2.1.24",
    "@types/wav": "^1.0.5",
    "typescript": "^5.3.3",
    "tsx": "^4.7.1",
    "vitest": "^1.2.2"
  }
}
```

## Environment Setup

Runs in WSL2 with CUDA support. See [WSL_SETUP.md](../../docs/WSL_SETUP.md) for installation guide.nstall Python 3.11, CUDA toolkit, audio libraries
# Optimized for GPU inference
# Pre-download TTS models during build
```

## Testing Strategy

- **Unit Tests**: Text preprocessing, voice selection
- **Integration Tests**: End-to-end synthesis flow
- **Performance Tests**: Latency benchmarks, GPU memory profiling
- **Quality Tests**: MOS evaluation, listening tests
- **Load Tests**: Concurrent request handling

## Privacy & Security

- ✅ **100% Local Processing**: No external API calls
- ✅ **No Data Retention**: Text and audio ephemeral
- ✅ **Secure Communication**: WSS for encrypted streaming
- ✅ **Input Validation**: Text length limits, sanitization

## Monitoring

- Synthesis latency metrics
- GPU utilization tracking
- Error rate monitoring
- Cache hit rate (if enabled)
- Audio quality metrics

## Text Pre-processing

###typescript
const inputText = "Hello! I'm your AI assistant. How can I help today?";

const processed = {
  sentences: [
    "Hello!",
    "I'm your AI assistant.",
    "How can I help today?"
  ],
  phonemes: [...],  // IPA notation
  pauses: [0.3, 0.2, 0.0]  // seconds
};rocessed = {
  "sentences": [
    "Hello!",
    "I'm your AI assistant.",
    "How can I help today?"
  ],
  "phonemes": [...],  # IPA notation
  "pauses": [0.3, 0.2, 0.0]  # seconds
}
```

## Audio Post-processing

- **Normalization**: Maintain consistent volume
- **Silence Trimming**: Remove leading/trailing silence
- **Compression**: Dynamic range compression for clarity
- **Format Conversion**: WAV → MP3/Opus as needed

## Integration Points

- **LLM Service**: Receives generated text responses
- **API Service**: Orchestrates TTS requests
- **STT Service**: Voice interaction loop
- **Web Interface**: Browser audio playback
- **Raspberry Pi Client**: Local speaker output

## typescript
audio → normalizeVolume() → trimSilence() → 
        applyEq() → compressDynamics() → 
        encodeFm voice samples
- Optimize for conversational style
- Reduce artifacts and mispronunciations

### Post-processing Pipeline
```python
audio → normalize_volume() → trim_silence() → 
        apply_eq() → compress_dynamics() → 
        encode_format()
```

---

**Status**: 🚧 Planning Phase  
**Owner**: Second Brain Team  
**Last Updated**: February 7, 2026
