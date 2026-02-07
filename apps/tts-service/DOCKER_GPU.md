# Running TTS Service with Docker GPU Support

This guide explains how to run the TTS service with NVIDIA GPU acceleration using Docker.

## ⚠️ Important: Windows Docker Desktop GPU Limitations

**Current Status**: The Docker setup uses a pre-built NVIDIA PyTorch image with full GPU support configured, but **GPU acceleration does not work on Windows Docker Desktop** due to WSL2 limitations.

- ✅ **Service runs excellently on CPU** (RTF 0.05-0.25, 4-20x real-time)
- ✅ **GPU configuration ready** for Linux deployment
- ❌ **GPU not functional** on Windows Docker Desktop + WSL2

See [GPU_STATUS.md](./GPU_STATUS.md) for detailed explanation and alternatives.

---

## Prerequisites

### 1. Docker Desktop for Windows
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Enable WSL 2 backend in Docker Desktop settings

### 2. NVIDIA GPU Driver
- ✅ Already installed (Driver 572.83, CUDA 12.8)
- Verify with: `nvidia-smi`

### 3. Enable GPU Support in Docker Desktop
1. Open Docker Desktop
2. Go to **Settings** → **Resources** → **WSL Integration**
3. Enable integration for Ubuntu-22.04
4. Go to **Settings** → **Docker Engine**
5. Add to the configuration:
```json
{
  "features": {
    "buildkit": true
  },
  "experimental": true
}
```

**Note**: Even with these settings, CUDA runtime operations will fail on Windows. The service will automatically fall back to CPU mode.

## Quick Start

### 1. Start Docker Desktop
Make sure Docker Desktop is running.

### 2. Build and Run with Docker Compose

```powershell
# From the project root
cd C:\Interesting\repos\second-brain

# Build the image
docker-compose build tts-service

# Run with GPU support
docker-compose up tts-service
```

### 3. Test the Service

```powershell
# Test health endpoint
curl http://localhost:3002/ping

# Test synthesis
$body = @{
    text = "Hello from GPU-accelerated TTS!"
    voice = "en_US-lessac-medium"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3002/api/tts/synthesize -Method Post -Body $body -ContentType "application/json"
```

## GPU Verification

### Check if GPU is available in container:

```powershell
docker exec -it second-brain-tts python -c "import onnxruntime as ort; print('Available providers:', ort.get_available_providers())"
```

Expected output should include `CUDAExecutionProvider`.

### Monitor GPU usage:

```powershell
nvidia-smi -l 1
```

You should see the `second-brain-tts` container using GPU memory during inference.

## Docker Commands

```powershell
# Build the image
docker-compose build tts-service

# Start service in background
docker-compose up -d tts-service

# View logs
docker-compose logs -f tts-service

# Stop service
docker-compose down

# Rebuild after code changes
docker-compose up --build tts-service

# Access container shell
docker exec -it second-brain-tts bash
```

## Performance Comparison

### CPU Mode (WSL2):
- RTF: 0.05-0.25 (5-25x faster than real-time)
- No GPU memory usage

### GPU Mode (Docker):
- RTF: Expected 0.01-0.05 (20-100x faster than real-time)
- GPU memory: ~500MB-1GB during inference
- First inference slower due to CUDA initialization

## Troubleshooting

### Error: "could not select device driver with capabilities: [[gpu]]"

**Solution**: Enable GPU support in Docker Desktop:
1. Update Docker Desktop to latest version
2. Ensure WSL 2 backend is enabled
3. Restart Docker Desktop

### Error: "CUDA driver version is insufficient"

**Solution**: Update NVIDIA driver:
```powershell
# Check current driver
nvidia-smi

# Update to latest driver from NVIDIA website
```

### Error: "no CUDA-capable device is detected"

**Solution**: Verify Docker can access GPU:
```powershell
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

### Container won't start

**Solution**: Check logs:
```powershell
docker-compose logs tts-service
```

## Development Mode

For development with hot-reload (code changes reflected without rebuild):

1. Uncomment the source volume mount in `docker-compose.yml`:
```yaml
volumes:
  - ./apps/tts-service/src:/app/src:ro
```

2. Run with reload:
```powershell
docker-compose up tts-service
```

## Production Deployment

For production:

1. Comment out source code volume mount in `docker-compose.yml`
2. Build optimized image:
```powershell
docker-compose build --no-cache tts-service
```

3. Run in detached mode:
```powershell
docker-compose up -d tts-service
```

## Performance Testing

Run the E2E tests against the containerized service:

```powershell
cd C:\Interesting\repos\second-brain\apps\e2e-tests
.\venv-windows\Scripts\Activate.ps1
pytest tests/test_tts_service.py -v
```

## Next Steps

Once GPU acceleration is confirmed working:
1. Containerize other services (STT, API, web)
2. Add Redis, PostgreSQL, Qdrant to docker-compose
3. Set up multi-container orchestration
4. Configure production-ready networking and security
