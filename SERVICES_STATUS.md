# Second Brain Services Status - CPU Mode

**Date**: February 7, 2026  
**Status**: ✅ All Services Running on CPU  
**Architecture**: Docker Compose on Windows

---

## 🎯 Current Setup

### Active Services

| Service | Port | Status | Technology | Mode |
|---------|------|--------|------------|------|
| **TTS** (Text-to-Speech) | 3002 | ✅ Healthy | Piper TTS 1.2.0 + ONNX Runtime | CPU |
| **STT** (Speech-to-Text) | 3003 | ✅ Healthy | Faster Whisper (base model) | CPU |

### Performance Metrics

**TTS Service (CPU)**:
- Model: `en_US-lessac-medium.onnx`
- Real-Time Factor: 0.05-0.25 (4-20x faster than real-time)
- Typical latency: 50-250ms for short sentences
- Memory: ~500MB

**STT Service (CPU)**:
- Model: Faster Whisper `base` (74M parameters)
- Inference speed: 6-10x faster than real-time
- Typical latency: ~800ms for 5s audio
- Memory: ~1GB
- Languages: Auto-detect or specify (99+ supported)

---

## 📊 Service Endpoints

### TTS Service (Port 3002)

```bash
# Health checks
GET  http://localhost:3002/ping
GET  http://localhost:3002/health

# Synthesize speech
POST http://localhost:3002/api/tts/synthesize
  Body: { "text": "Hello world" }
  Returns: WAV audio file

# Streaming synthesis
WS   ws://localhost:3002/api/tts/stream
```

### STT Service (Port 3003)

```bash
# Health checks
GET  http://localhost:3003/ping
GET  http://localhost:3003/health

# Transcribe audio
POST http://localhost:3003/api/stt/transcribe
  Form: audio=@file.wav, language=en
  Returns: { "text": "...", "segments": [...], ... }
```

---

## 🐳 Docker Commands

### Status & Logs
```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f tts-service
docker-compose logs -f stt-service
docker-compose logs -f  # Both services

# Tail recent logs
docker-compose logs --tail=50 tts-service
```

### Control
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d tts-service
docker-compose up -d stt-service

# Restart services
docker-compose restart

# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down
```

### Rebuild
```bash
# Rebuild and restart specific service
docker-compose up -d --build tts-service
docker-compose up -d --build stt-service

# Rebuild everything
docker-compose build --no-cache
docker-compose up -d
```

---

## 🧪 Testing

### Quick Health Check
```bash
# Python test
python test_services.py

# Manual checks
curl http://localhost:3002/ping
curl http://localhost:3003/health
```

### TTS Test
```bash
curl -X POST http://localhost:3002/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, this is a test"}' \
  --output test.wav
```

### STT Test (requires audio file)
```bash
curl -X POST http://localhost:3003/api/stt/transcribe \
  -F "audio=@test.wav" \
  -F "language=en"
```

---

## 📁 Project Structure

```
second-brain/
├── docker-compose.yml          # Service orchestration
├── test_services.py           # Health check script
├── models/
│   ├── piper/                 # TTS models
│   └── whisper/               # STT models (auto-downloaded)
├── apps/
│   ├── tts-service/
│   │   ├── Dockerfile         # TTS container
│   │   ├── src/               # TTS service code
│   │   ├── requirements.txt
│   │   └── README.md
│   └── stt-service/
│       ├── Dockerfile         # STT container
│       ├── src/               # STT service code
│       ├── requirements.txt
│       └── README.md
```

---

## 🔧 Configuration

### TTS Configuration
Edit `apps/tts-service/.env`:
```env
MODEL_PATH=/models/piper/en_US-lessac-medium.onnx
VOICE_CONFIG_PATH=/models/piper/en_US-lessac-medium.onnx.json
LOG_LEVEL=info
```

### STT Configuration
Edit `apps/stt-service/.env`:
```env
MODEL_SIZE=base          # tiny, base, small, medium, large-v3
DEVICE=cpu
COMPUTE_TYPE=int8        # int8 (fastest), int16, float32
DEFAULT_LANGUAGE=en      # Or None for auto-detect
```

---

## 📈 Performance Optimization

### Current Settings (Optimized for CPU)

**TTS**:
- ✅ Using ONNX Runtime with optimizations
- ✅ Medium-quality voice model (balanced)
- ✅ Excellent RTF on CPU

**STT**:
- ✅ Using `base` model (good accuracy, fast)
- ✅ int8 quantization (fastest CPU inference)
- ✅ VAD filtering enabled (skips silence)

### Future GPU Migration

When deploying to Linux server with GPU:

1. **STT Service** - Update `.env`:
   ```env
   DEVICE=cuda
   COMPUTE_TYPE=float16
   ```
   Expected speedup: **15-20x faster**

2. **TTS Service** - Already configured for GPU
   Expected speedup: **5-10x faster**

3. **Docker Compose** - Add GPU config:
   ```yaml
   deploy:
     resources:
       reservations:
         devices:
           - driver: nvidia
             count: 1
             capabilities: [gpu]
   ```

---

## 🚨 Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Port conflicts
```bash
# Check what's using ports
netstat -ano | findstr :3002
netstat -ano | findstr :3003

# Stop services and change ports in docker-compose.yml
```

### Model download issues (STT)
```bash
# Models auto-download on first use
# Check models directory
ls models/whisper/

# Manually download if needed (inside container)
docker exec -it second-brain-stt bash
```

### Memory issues
```bash
# Check Docker resources
docker stats

# Reduce model size in .env
# TTS: Use smaller voice model
# STT: Change MODEL_SIZE=tiny
```

---

## 📝 Development Notes

### Why CPU Mode?

**Windows + Docker + GPU Limitation**:
- WSL2 paravirtualization doesn't support full CUDA runtime
- `cudaSetDevice()` fails with symbol errors
- See `apps/tts-service/GPU_STATUS.md` for details

**CPU Performance is Excellent**:
- TTS: 4-20x faster than real-time (RTF 0.05-0.25)
- STT: 6-10x faster than real-time
- Sub-second latency for typical use cases

**Production GPU Strategy**:
- Deploy same Docker images to native Linux
- Simply change `DEVICE=cuda` in config
- No code changes needed
- Expected 10-20x speedup

---

## ✅ Next Steps

1. **API Orchestration Layer** - Coordinate TTS + STT
2. **Web Interface** - Interactive UI for voice interaction
3. **End-to-End Testing** - Full audio pipeline
4. **Memory/RAG Integration** - Add context and memory
5. **Production Deployment** - Deploy to Linux for GPU

---

## 📚 Documentation

- [TTS Service](apps/tts-service/README.md)
- [STT Service](apps/stt-service/README.md)
- [GPU Investigation](apps/tts-service/GPU_STATUS.md)
- [System Design](SYSTEM_DESIGN.md)

---

**Last Updated**: February 7, 2026  
**Status**: ✅ Both services running successfully on CPU  
**Ready for**: API layer and web interface development
