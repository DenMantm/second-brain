# Text-to-Speech (TTS) Service

🐳 **This service runs in Docker containers only**

## Overview

The TTS service converts text responses from the Second Brain assistant into natural-sounding speech for voice output. Designed for real-time conversational AI with low latency and high-quality voice synthesis.

## Technology Stack

- **Runtime**: Python 3.11 (in Docker)
- **Framework**: FastAPI (async HTTP server)
- **Engine**: [Piper TTS](https://github.com/rhasspy/piper) (ONNX runtime)
- **Acceleration**: CPU optimized (ONNX Runtime)
- **Voice Quality**: 22kHz sample rate, natural prosody

## Quick Start

### Running with Docker (Recommended)

The TTS service is managed by docker-compose in the project root:

```bash
# Start TTS service
docker-compose up -d tts-service

# View logs
docker logs second-brain-tts -f

# Check health
curl http://localhost:3002/ping

# Restart with changes
docker-compose up -d --build tts-service
```

### Configuration

Edit `docker-compose.yml` in the project root to configure the TTS service:

```yaml
services:
  tts-service:
    environment:
      - MODEL_PATH=/models/piper/en_US-lessac-medium.onnx
      - VOICE_CONFIG_PATH=/models/piper/en_US-lessac-medium.onnx.json
      - TTS_NOISE_SCALE=0.4          # Lower = clearer voice (0.3-0.7)
      - TTS_LENGTH_SCALE=1.0         # Speech speed (0.5-2.0)
      - TTS_SAMPLE_RATE=22050        # Audio quality (16000-24000)
      - ENABLE_AUDIO_ENHANCEMENT=true # Post-processing effects
      - LOG_LEVEL=info
```

## API Endpoints

### Health Check
```bash
GET /ping
Response: {"status": "healthy"}
```

### Synthesize Speech
```bash
POST /api/tts/synthesize
Content-Type: application/json
Body: {
  "text": "Hello, this is a test",
  "voice": "en_US-lessac-medium",
  "speed": 1.0
}

Response: Audio file (WAV format)
```

## Voice Models

The service uses Piper TTS models located in `./models/piper/`:

**Available Models:**
- `en_US-lessac-medium.onnx` - Natural, clear voice (default)
- `en_US-lessac-high.onnx` - Higher quality (slower)
- `en_US-amy-medium.onnx` - Female voice alternative
- `en_US-ryan-high.onnx` - Male voice alternative

**Adding New Models:**
1. Download from [Piper releases](https://github.com/rhasspy/piper/releases)
2. Place `.onnx` and `.onnx.json` files in `./models/piper/`
3. Update `MODEL_PATH` in docker-compose.yml
4. Restart: `docker-compose up -d --build tts-service`

## Quality Settings

### Noise Scale (0.3 - 0.7)
- **Lower** (0.3-0.4): Clearer, crisper voice
- **Higher** (0.6-0.7): More variation, slight breathiness

### Length Scale (0.5 - 2.0)
- **Lower** (0.8-0.9): Faster speech
- **Higher** (1.1-1.5): Slower, more deliberate speech

### Audio Enhancement
When enabled, applies:
- Volume normalization (85% peak target)
- High-pass filter (removes low-frequency rumble)
- Soft limiting (prevents clipping)
- Dynamic compression (consistent volume)

## Concurrent Request Handling

The TTS service properly serializes all synthesis requests to ensure thread safety and prevent crashes.

### How It Works

- **Sequential Processing**: Requests are processed one at a time using `asyncio.Lock`
- **Queue Management**: Concurrent requests wait in a queue (FIFO order)
- **Thread Safety**: Prevents race conditions and memory corruption
- **Error Isolation**: Errors in one request don't block others

### Performance Impact

```
Single request:     ~150ms
3 concurrent:       ~450ms (sequential)
10 concurrent:      ~1500ms (queued)
```

**Why serialization is necessary:**
- Piper TTS model is not thread-safe
- Concurrent access causes crashes and corrupted audio
- Sequential processing ensures reliable, high-quality output

### Testing

Run comprehensive tests to verify concurrent handling:
```bash
cd apps/tts-service
pip install -r requirements-dev.txt
pytest tests/ -v
```

See [CONCURRENT_FIX.md](CONCURRENT_FIX.md) for detailed explanation.

### Demonstration

Run the visual demonstration:
```bash
python demo_concurrent_fix.py
```

This shows the difference between concurrent (broken) and sequential (fixed) execution.

## Development

### Project Structure
```
apps/tts-service/
├── src/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Settings and environment
│   ├── tts_engine.py        # Piper TTS engine wrapper
│   ├── routes.py            # API endpoints
│   └── schemas.py           # Pydantic models
├── tests/
│   ├── test_tts_engine.py   # Engine unit tests
│   ├── test_routes.py       # API integration tests
│   └── README.md            # Test documentation
├── Dockerfile               # Docker build instructions
├── requirements.txt         # Python dependencies
├── requirements-dev.txt     # Development dependencies
├── pyproject.toml          # Test configuration
├── demo_concurrent_fix.py  # Concurrency demonstration
├── run-tests.ps1           # Test runner script
├── CONCURRENT_FIX.md       # Concurrency fix details
└── README.md               # This file
```

### Local Development (Docker)

1. **Edit source code** in `./src/`
2. **Rebuild container**:
   ```bash
   docker-compose up -d --build tts-service
   ```
3. **View logs**:
   ```bash
   docker logs second-brain-tts -f
   ```

### Testing

Test the service locally:
```bash
# Health check
curl http://localhost:3002/ping

# Synthesize speech
curl -X POST http://localhost:3002/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Testing TTS service"}' \
  --output test.wav
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker logs second-brain-tts

# Check if port is already in use
docker ps | grep 3002

# Restart container
docker-compose restart tts-service
```

### Poor Audio Quality
1. Try a different voice model (lessac-high, amy, ryan)
2. Adjust `TTS_NOISE_SCALE` (lower = clearer)
3. Enable `ENABLE_AUDIO_ENHANCEMENT=true`
4. Increase `TTS_SAMPLE_RATE` to 24000

### Slow Response Time
1. Use medium-quality models (not high)
2. Ensure Docker has adequate CPU resources
3. Check `docker stats second-brain-tts`

## Performance

**Typical Latency (CPU):**
- Model loading: ~2 seconds (cached)
- Synthesis: ~50-100ms per second of audio
- Total time-to-first-audio: ~200-300ms

**Resource Usage:**
- RAM: ~500MB
- CPU: 20-40% during synthesis
- Storage: ~50MB per model

## License

MIT License - Part of Second Brain project
