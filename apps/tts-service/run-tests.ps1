#!/usr/bin/env pwsh
# Run TTS service tests

Write-Host "Running TTS Service Tests" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "tests")) {
    Write-Host "Error: Run this script from apps/tts-service directory" -ForegroundColor Red
    exit 1
}

# Check if virtual environment exists
if (-not (Test-Path "venv") -and -not (Test-Path ".venv")) {
    Write-Host "No virtual environment found. Creating one..." -ForegroundColor Yellow
    python -m venv venv
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create virtual environment" -ForegroundColor Red
        exit 1
    }
}

# Activate virtual environment
if (Test-Path "venv/Scripts/Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & "venv/Scripts/Activate.ps1"
} elseif (Test-Path ".venv/Scripts/Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & ".venv/Scripts/Activate.ps1"
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pip install -q -r requirements.txt
pip install -q -r requirements-dev.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Running tests..." -ForegroundColor Green
Write-Host ""

# Run tests with coverage
pytest -v --cov=src --cov-report=term-missing --cov-report=html

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ All tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Coverage report generated in htmlcov/index.html" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Some tests failed!" -ForegroundColor Red
    exit 1
}
