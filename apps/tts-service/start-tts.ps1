# Simple TTS Service Launcher for Windows
# Activate venv and start service with GPU support

.\venv-windows\Scripts\Activate.ps1

# Set environment
$env:MODEL_PATH = "C:/Interesting/repos/second-brain/models/piper"
$env:CUDA_VISIBLE_DEVICES = "0"

Write-Host "Starting TTS Service on Windows with GPU support..." -ForegroundColor Green
Write-Host "GPU Status:" -ForegroundColor Cyan
python -c "import onnxruntime as ort; print('  CUDA Available:', 'CUDAExecutionProvider' in ort.get_available_providers())"

Write-Host "`nService will run on http://localhost:3002" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Gray

uvicorn src.main:app --host 0.0.0.0 --port 3002 --reload
