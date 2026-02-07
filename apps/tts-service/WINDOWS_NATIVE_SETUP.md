# Running TTS Service Natively on Windows with GPU

This guide explains how to run the TTS service directly on Windows to leverage GPU acceleration without Docker/WSL2 limitations.

## Why Native Windows?

- ✅ **Direct GPU access** - No WSL2 virtualization layer
- ✅ **Full CUDA runtime support** - All operations work
- ✅ **Better performance** - No containerization overhead
- ✅ **Simpler debugging** - Standard Windows Python environment

## Prerequisites

- ✅ Windows 10/11
- ✅ NVIDIA GPU with updated drivers (you have 572.83)
- ✅ Python 3.10 or 3.11 installed on Windows
- ✅ CUDA Toolkit 12.x (optional, driver includes runtime)

## Setup Steps

### 1. Create Windows Python Virtual Environment

```powershell
# Navigate to TTS service directory
cd C:\Interesting\repos\second-brain\apps\tts-service

# Create Python virtual environment
python -m venv venv-windows

# Activate it
.\venv-windows\Scripts\Activate.ps1
```

### 2. Install GPU-Enabled Dependencies

```powershell
# Upgrade pip
python -m pip install --upgrade pip

# Install ONNX Runtime GPU (CRITICAL: GPU version first)
pip install onnxruntime-gpu

# Install Piper TTS without dependencies (to avoid CPU onnxruntime)
pip install --no-deps piper-tts==1.2.0

# Install Piper phonemize
pip install piper-phonemize==1.1.0

# Install other dependencies
pip install fastapi==0.109.0 uvicorn[standard]==0.27.0 pydantic==2.5.0 pydantic-settings==2.1.0 soundfile==0.12.1 pydub==0.25.1 websockets==12.0 python-multipart==0.0.6 redis==5.0.1 python-dotenv==1.0.0

# CRITICAL: Ensure no CPU version sneaked in
pip uninstall -y onnxruntime
```

### 3. Verify GPU Access

```powershell
# Test ONNX Runtime GPU
python -c "import onnxruntime as ort; print('ONNX Runtime version:', ort.__version__); print('Available providers:', ort.get_available_providers())"
```

Expected output:
```
ONNX Runtime version: 1.23.2
Available providers: ['TensorrtExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider']
```

### 4. Configure Environment

Create `.env.windows` file:
```env
# Model path
MODEL_PATH=C:/Interesting/repos/second-brain/models/piper

# Service config
HOST=0.0.0.0
PORT=3002

# GPU config
CUDA_VISIBLE_DEVICES=0
```

### 5. Run the Service

```powershell
# Make sure venv is activated
.\venv-windows\Scripts\Activate.ps1

# Run with GPU
$env:MODEL_PATH="C:/Interesting/repos/second-brain/models/piper"
uvicorn src.main:app --host 0.0.0.0 --port 3002
```

## Startup Script

For convenience, create `run-tts-windows.ps1`:

```powershell
# Activate virtual environment
.\venv-windows\Scripts\Activate.ps1

# Set environment variables
$env:MODEL_PATH="C:/Interesting/repos/second-brain/models/piper"
$env:CUDA_VISIBLE_DEVICES="0"

# Run service
Write-Host "Starting TTS Service with GPU acceleration..." -ForegroundColor Green
uvicorn src.main:app --host 0.0.0.0 --port 3002 --reload
```

Then run with:
```powershell
.\run-tts-windows.ps1
```

## Performance Expectations

With native Windows GPU:
- **RTF**: 0.01-0.05 (10-100x faster than real-time)
- **Latency**: 50-200ms for typical sentences
- **GPU Usage**: 20-40% on RTX 4060 Ti
- **VRAM**: ~500MB-1GB

This is **5-10x faster** than CPU mode!

## Troubleshooting

### Issue: "CUDAExecutionProvider not available"

**Solution**: Reinstall onnxruntime-gpu
```powershell
pip uninstall onnxruntime onnxruntime-gpu -y
pip install onnxruntime-gpu
```

### Issue: "CUDA DLL not found"

**Solution**: CUDA runtime should be in your driver. Verify:
```powershell
nvidia-smi
```

If needed, download CUDA runtime from: https://developer.nvidia.com/cuda-downloads

### Issue: Service uses CPU instead of GPU

**Check logs** - should see:
```
CUDA provider available, using GPU acceleration
TTS model loaded successfully on GPU in 0.XX s
```

If seeing CPU:
1. Verify `ort.get_available_providers()` includes `CUDAExecutionProvider`
2. Check CUDA_VISIBLE_DEVICES is set
3. Ensure onnxruntime-gpu is installed (not onnxruntime)

## Integration with Other Services

- **TTS**: Runs natively on Windows (this service) - Port 3002
- **STT**: Will run in Docker CPU container - Port 3003
- **API**: Can run in Docker or natively - Port 8000
- **Web**: Static files or Docker - Port 3000

All services talk via HTTP, so mixing native + Docker works perfectly!

## Next Steps

1. ✅ Get TTS running on Windows with GPU
2. ⏭️ Build STT Docker container (Faster Whisper on CPU)
3. ⏭️ Build API orchestration layer
4. ⏭️ Deploy full stack

---

**Status**: Ready for native Windows deployment with full GPU support! 🚀
