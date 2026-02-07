# Docker Services Architecture

This document explains how Second Brain uses Docker containers for all voice services.

## Overview

Second Brain uses a **Docker-first architecture** for voice services (TTS/STT) to ensure:
- ✅ **Easy deployment** - No complex Python environment setup
- ✅ **Isolation** - Each service runs in its own container
- ✅ **Consistency** - Same environment on all machines
- ✅ **Resource management** - Docker handles CPU/GPU allocation
- ✅ **Easy updates** - Rebuild containers to apply changes

## Container Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Docker Compose Network: second-brain-network            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │  second-brain-tts│  │ second-brain-stt │             │
│  │  Port: 3002      │  │  Port: 3003      │             │
│  │  Piper TTS       │  │  Faster-Whisper  │             │
│  │  ✅ Healthy      │  │  ⚠️ Unhealthy*   │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                           │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │  wyoming-whisper │  │  wyoming-piper   │             │
│  │  Port: 10300     │  │  Port: 10200     │             │
│  │  Whisper ASR     │  │  Piper TTS       │             │
│  │  (Alternative)   │  │  (Alternative)   │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                           │
│  ┌──────────────────┐                                    │
│  │wyoming-openwakewd│                                    │
│  │  Port: 10400     │                                    │
│  │  Wake Word Det.  │                                    │
│  └──────────────────┘                                    │
└─────────────────────────────────────────────────────────┘

* STT may show unhealthy during model download (2-5 minutes)
```

## Service Details

### TTS Service (second-brain-tts)
**Purpose**: Convert text to speech using Piper TTS  
**Port**: 3002  
**Technology**: Python 3.11 + FastAPI + Piper + ONNX Runtime  
**Model**: en_US-lessac-medium (22kHz, natural voice)  
**Health**: HTTP GET /ping  

**Key Features:**
- Noise reduction (noise_scale=0.4)
- Audio enhancement pipeline
- Volume normalization
- High-pass filtering
- Dynamic compression

**Configuration** (in docker-compose.yml):
```yaml
environment:
  - TTS_NOISE_SCALE=0.4          # Clarity (0.3-0.7)
  - TTS_LENGTH_SCALE=1.0         # Speed (0.5-2.0)
  - TTS_SAMPLE_RATE=22050        # Quality (16000-24000)
  - ENABLE_AUDIO_ENHANCEMENT=true
```

### STT Service (second-brain-stt)
**Purpose**: Convert speech to text using Faster-Whisper  
**Port**: 3003  
**Technology**: Python 3.11 + FastAPI + Faster-Whisper  
**Model**: Whisper base (INT8 quantized for CPU)  
**Health**: HTTP GET /ping  

**Key Features:**
- Real-time transcription
- CPU-optimized INT8 inference
- Auto-download models on first run
- Multi-language support

**Configuration** (in docker-compose.yml):
```yaml
environment:
  - MODEL_SIZE=base              # tiny|base|small|medium|large
  - DEVICE=cpu                   # cpu or cuda
  - COMPUTE_TYPE=int8            # int8|int16|float16|float32
```

### Wyoming Services
**Purpose**: Alternative TTS/STT implementations + wake word detection  
**Ports**: 10200 (TTS), 10300 (STT), 10400 (wake word)  
**Protocol**: Wyoming protocol for Home Assistant compatibility  

These run alongside the main services for fallback and additional features.

## Common Operations

### Start All Services
```bash
docker-compose up -d
```

### View Service Status
```bash
docker ps

# Expected output:
# second-brain-tts    Up X hours (healthy)
# second-brain-stt    Up X hours
# wyoming-whisper     Up X hours
# wyoming-piper       Up X hours
# wyoming-openwakeword Up X hours
```

### View Logs
```bash
# TTS logs
docker logs second-brain-tts -f

# STT logs
docker logs second-brain-stt -f

# All services
docker-compose logs -f
```

### Restart Services
```bash
# Restart single service
docker-compose restart tts-service

# Restart all
docker-compose restart

# Stop all
docker-compose down

# Start fresh (removes containers)
docker-compose down && docker-compose up -d
```

### Rebuild After Code Changes
```bash
# Rebuild TTS service
docker-compose up -d --build tts-service

# Rebuild all
docker-compose up -d --build

# Force recreate (ignores cache)
docker-compose up -d --force-recreate --build
```

### Check Resource Usage
```bash
# Monitor all containers
docker stats

# Monitor specific service
docker stats second-brain-tts
```

## Volume Mounts

Both services use volume mounts for:

1. **Models** (read-only):
   ```yaml
   volumes:
     - ./models/piper:/models/piper:ro
     - ./models/whisper:/models/whisper
   ```

2. **Source Code** (development):
   ```yaml
   volumes:
     - ./apps/tts-service/src:/app/src:ro
   ```
   
   This allows hot-reloading during development without rebuilding.

## Health Checks

Docker automatically monitors service health:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3002/ping"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s  # Grace period for startup
```

**Health Status:**
- ✅ **healthy** - Service responding to health checks
- ⚠️ **unhealthy** - Health check failing (check logs)
- 🔄 **starting** - Within start_period grace period

## Troubleshooting

### Service Shows "Unhealthy"

**TTS Service:**
```bash
docker logs second-brain-tts --tail 50

# Common issues:
# - Model not found (check ./models/piper/ exists)
# - Port conflict (check if 3002 is available)
# - ONNX runtime error (check logs for details)
```

**STT Service:**
```bash
docker logs second-brain-stt --tail 50

# Common issues:
# - Model downloading (wait 2-5 minutes on first start)
# - Insufficient memory (try MODEL_SIZE=tiny)
# - Port conflict (check if 3003 is available)
```

### Port Already in Use
```powershell
# Windows - find what's using the port
netstat -ano | findstr ":3002"
netstat -ano | findstr ":3003"

# Stop the conflicting process or change ports in docker-compose.yml
```

### Container Won't Start
```bash
# Check container logs
docker logs second-brain-tts

# Check Docker daemon
docker info

# Verify docker-compose.yml syntax
docker-compose config

# Force recreate
docker-compose up -d --force-recreate tts-service
```

### Slow Performance
```bash
# Check resource limits
docker stats

# Adjust Docker Desktop resources:
# Settings → Resources → Advanced
# - CPUs: 4+ recommended
# - Memory: 8GB+ recommended
# - Swap: 2GB+
```

### Models Not Loading
```bash
# Verify model files exist
ls -la models/piper/
ls -la models/whisper/

# Check permissions (WSL)
wsl -d Ubuntu-22.04 ls -la /mnt/c/Interesting/repos/second-brain/models/piper/

# Manually download if missing
# See apps/tts-service/README.md for model download links
```

## Development Workflow

### Making Code Changes

1. **Edit source code** in `./apps/tts-service/src/` or `./apps/stt-service/src/`
2. **Rebuild container**:
   ```bash
   docker-compose up -d --build tts-service
   ```
3. **Verify changes**:
   ```bash
   docker logs second-brain-tts -f
   curl http://localhost:3002/ping
   ```

### Testing Changes

```bash
# Test TTS
curl -X POST http://localhost:3002/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Testing new changes"}' \
  --output test.wav

# Test STT
curl -X POST http://localhost:3003/api/stt/transcribe \
  -F "audio=@test.wav"
```

### Hot Reload (Development Mode)

The source code is mounted as a volume with the `:ro` flag (read-only). To enable hot reload:

1. Remove `:ro` flag in docker-compose.yml (for development only)
2. Add auto-reload to Python services (uvicorn --reload)
3. Changes will apply without rebuilding

**Note**: This is for development only. Production should use `:ro` for security.

## Best Practices

1. **Always use docker-compose** - Don't run containers manually
2. **Check logs first** - Most issues show up in `docker logs`
3. **Use health checks** - Wait for "healthy" status before testing
4. **Version control** - Keep docker-compose.yml in git
5. **Document changes** - Update environment variables in comments
6. **Test locally** - Use curl to test endpoints before frontend integration
7. **Monitor resources** - Run `docker stats` periodically
8. **Clean up** - Occasionally prune: `docker system prune -a`

## Architecture Benefits

### Why Docker for Voice Services?

1. **Isolation**: TTS/STT have different dependencies (ONNX, Whisper, etc.)
2. **Portability**: Works same on all machines with Docker
3. **Resource Management**: Docker controls CPU/memory allocation
4. **Easy Updates**: Rebuild container vs managing Python environments
5. **Scalability**: Can add more containers for load balancing
6. **Security**: Containers run in sandboxed environments
7. **Debugging**: Logs and health checks built-in

### Why NOT Docker for Web UI?

The web UI (React + Node.js) runs **natively** because:
- Hot module replacement (HMR) for instant updates
- Better debugging experience
- Faster iteration during development
- TypeScript language server integration
- No performance overhead

## Future Enhancements

- [ ] Add LLM service container (vLLM or llama.cpp)
- [ ] Add PostgreSQL container for database
- [ ] Add Qdrant container for vector storage
- [ ] Add Redis container for caching
- [ ] GPU passthrough for faster inference
- [ ] Multi-stage builds for smaller images
- [ ] Health check improvements (detailed status)
- [ ] Kubernetes deployment configs
- [ ] Auto-scaling based on load

## Related Documentation

- [TTS Service README](../apps/tts-service/README.md) - Detailed TTS configuration
- [STT Service README](../apps/stt-service/README.md) - Detailed STT configuration
- [docker-compose.yml](../docker-compose.yml) - Service definitions
- [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) - Overall architecture

---

**Last Updated**: February 7, 2026  
**Status**: ✅ Production-ready Docker setup
