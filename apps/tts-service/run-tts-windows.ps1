# TTS Service Windows Native Launcher with GPU Support
# This script runs the TTS service directly on Windows with NVIDIA GPU acceleration

# Color output function
function Write-Color {
    param($Text, $Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

Write-Color "`n========================================" "Cyan"
Write-Color "  TTS Service - Windows Native + GPU" "Cyan"
Write-Color "========================================`n" "Cyan"

# Check if virtual environment exists
if (-Not (Test-Path ".\venv-windows")) {
    Write-Color "❌ Virtual environment not found!" "Red"
    Write-Color "Please run setup first:`n" "Yellow"
    Write-Color "  python -m venv venv-windows" "White"
    Write-Color "  .\venv-windows\Scripts\Activate.ps1" "White"
    Write-Color "  pip install onnxruntime-gpu piper-tts piper-phonemize fastapi uvicorn`n" "White"
    exit 1
}

# Activate virtual environment
Write-Color "🔧 Activating virtual environment..." "Yellow"
& ".\venv-windows\Scripts\Activate.ps1"

# Check for onnxruntime-gpu
Write-Color "🔍 Checking ONNX Runtime GPU installation..." "Yellow"
$onnxCheck = & python -c "import onnxruntime as ort; print('CUDAExecutionProvider' in ort.get_available_providers())" 2>&1
if ($onnxCheck -ne "True") {
    Write-Color "⚠️  Warning: CUDA provider not available!" "Red"
    Write-Color "Expected GPU support but not detected.`n" "Yellow"
    Write-Color "To fix, run:" "White"
    Write-Color "  pip uninstall onnxruntime onnxruntime-gpu -y" "White"
    Write-Color "  pip install onnxruntime-gpu`n" "White"
    
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
} else {
    Write-Color "✅ CUDA provider available!" "Green"
}

# Set environment variables
Write-Color "`n⚙️  Setting environment variables..." "Yellow"
$env:MODEL_PATH = "C:/Interesting/repos/second-brain/models/piper"
$env:CUDA_VISIBLE_DEVICES = "0"
$env:PYTHONUNBUFFERED = "1"

Write-Color "   MODEL_PATH: $env:MODEL_PATH" "Gray"
Write-Color "   CUDA_VISIBLE_DEVICES: $env:CUDA_VISIBLE_DEVICES" "Gray"

# Check if models exist
if (-Not (Test-Path $env:MODEL_PATH)) {
    Write-Color "`n⚠️  Warning: Model directory not found at $env:MODEL_PATH" "Yellow"
    Write-Color "The service may fail to start without models.`n" "Yellow"
}

# Display GPU info
Write-Color "`n🎮 GPU Information:" "Cyan"
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Color "⚠️  Could not get GPU info (nvidia-smi failed)" "Yellow"
}

# Start service
Write-Color "`n🚀 Starting TTS Service on http://localhost:3002" "Green"
Write-Color "Press Ctrl+C to stop`n" "Gray"
Write-Color "========================================`n" "Cyan"

# Run uvicorn
uvicorn src.main:app --host 0.0.0.0 --port 3002 --reload
