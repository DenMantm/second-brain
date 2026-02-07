# Speech-to-Text (STT) Service

🐳 **This service runs in Docker containers only**

## Overview

The STT service converts voice audio input into text transcriptions for the Second Brain assistant. Optimized for real-time voice interaction with low latency, running entirely locally for privacy.

## Technology Stack

- **Runtime**: Python 3.11 (in Docker)
- **Framework**: FastAPI (async HTTP server)
- **Engine**: [Faster-Whisper](https://github.com/guillaumekln/faster-whisper) (CTranslate2)
- **Model**: Whisper Base (optimized for CPU)
- **Acceleration**: CPU optimized with INT8 quantization

## Quick Start

### Running with Docker (Recommended)

The STT service is managed by docker-compose in the project root:

```bash
# Start STT service
docker-compose up -d stt-service

# View logs
docker logs second-brain-stt -f

# Check health
curl http://localhost:3003/ping

# Restart with changes
docker-compose up -d --build stt-service
```

### Configuration

Edit `docker-compose.yml` in the project root to configure the STT service:

```yaml
services:
  stt-service:
    environment:
      - MODEL_PATH=/models/whisper
      - MODEL_SIZE=base              # tiny, base, small, medium, large
      - DEVICE=cpu                   # cpu or cuda
      - COMPUTE_TYPE=int8            # int8, int16, float16, float32
      - LOG_LEVEL=info
```

## API Endpoints

### Health Check
```bash
GET /ping
Response: {"status": "healthy"}
```

### Transcribe Audio
```bash
POST /api/stt/transcribe
Content-Type: multipart/form-data
Body: audio file (WAV, MP3, FLAC, WebM)

Response: {
  "text": "transcribed speech",
  "confidence": 0.95,
  "language": "en"
}
```

### Streaming Transcription (WebSocket)
```javascript
ws://localhost:3003/api/stt/stream
// Send audio chunks, receive real-time transcriptions
```

## Whisper Models

The service uses Faster-Whisper models located in `./models/whisper/`:

**Available Models:**
- **tiny** - Fastest, lowest accuracy (~1GB RAM)
- **base** - Good speed/accuracy balance (~1.5GB RAM) ← **Default**
- **small** - Better accuracy (~2GB RAM)
- **medium** - High accuracy (~5GB RAM)
- **large** - Best accuracy, slowest (~10GB RAM)

**Changing Models:**
1. Update `MODEL_SIZE` in docker-compose.yml
2. Restart: `docker-compose up -d --build stt-service`
3. Model will auto-download on first run

## Quality vs Performance

### Model Comparison

| Model  | Size | Speed  | WER   | Use Case |
|--------|------|--------|-------|----------|
| tiny   | 75MB | 10x RT | ~10%  | Testing, low-resource |
| base   | 142MB| 7x RT  | ~7%   | **Recommended for CPU** |
| small  | 466MB| 4x RT  | ~5%   | Better accuracy needed |
| medium | 1.5GB| 2x RT  | ~4%   | GPU available |
| large  | 3GB  | 1x RT  | ~3%   | Highest accuracy |

*RT = Real-time factor (lower is faster)*

### Compute Types

- **int8** - Fastest, slight accuracy loss ← **Default**
- **int16** - Balanced
- **float16** - GPU only, high quality
- **float32** - Highest quality, slowest

## Development

### Project Structure
```
apps/stt-service/
├── src/
│   ├── main.py           # FastAPI application
│   ├── config.py         # Settings and environment
│   ├── stt_engine.py     # Faster-Whisper wrapper
│   └── routes.py         # API endpoints
├── Dockerfile            # Docker build instructions
├── requirements.txt      # Python dependencies
├── .env.example         # Example environment variables
└── README.md            # This file
```

### Local Development (Docker)

1. **Edit source code** in `./src/`
2. **Rebuild container**:
   ```bash
   docker-compose up -d --build stt-service
   ```
3. **View logs**:
   ```bash
   docker logs second-brain-stt -f
   ```

### Testing

Test the service locally:
```bash
# Health check
curl http://localhost:3003/ping

# Transcribe audio file
curl -X POST http://localhost:3003/api/stt/transcribe \
  -F "audio=@test.wav"
```

## Troubleshooting

### Service Shows "Unhealthy"
```bash
# Check logs for errors
docker logs second-brain-stt

# Common issues:
# 1. Model download in progress (wait 2-5 minutes)
# 2. Insufficient memory (try smaller model)
# 3. Port conflict (check port 3003)

# Restart container
docker-compose restart stt-service
```

### Slow Transcription
1. Use **base** or **tiny** model (not medium/large)
2. Ensure `COMPUTE_TYPE=int8`
3. Verify CPU resources: `docker stats second-brain-stt`
4. Consider GPU support if available

### Poor Accuracy
1. Upgrade to **small** or **medium** model
2. Ensure audio quality is good (16kHz+, low noise)
3. Check `COMPUTE_TYPE` (int8 vs int16)
4. Test with different microphones

### Container Won't Start
```bash
# Check Docker logs
docker logs second-brain-stt

# Verify models directory exists
ls ./models/whisper

# Check port availability
netstat -ano | findstr :3003

# Force rebuild
docker-compose up -d --force-recreate --build stt-service
```

## Performance

**Typical Latency (CPU - base model):**
- Model loading: ~3-5 seconds (first run)
- Transcription: ~1-2 seconds per 10 seconds of audio
- Real-time factor: ~7x (processes 10s audio in ~1.5s)

**Resource Usage:**
- RAM: 1.5-2GB (base model)
- CPU: 60-80% during transcription
- Storage: ~500MB (model cache)

## Audio Requirements

**Optimal Input:**
- Format: WAV, FLAC, or WebM
- Sample Rate: 16kHz (auto-converted if different)
- Channels: Mono (stereo will be downmixed)
- Bit Depth: 16-bit PCM
- Duration: 1-30 seconds per chunk (streaming)

## License

MIT License - Part of Second Brain project
