$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path "$PSScriptRoot"
$venvActivate = Join-Path $repoRoot ".venv\Scripts\Activate.ps1"

if (-not (Test-Path $venvActivate)) {
  Write-Host "Virtualenv not found. Run setup first:" -ForegroundColor Yellow
  Write-Host "py -3.12 -m venv .venv" -ForegroundColor Yellow
  Write-Host ".\.venv\Scripts\Activate.ps1" -ForegroundColor Yellow
  Write-Host "pip install -r requirements.txt" -ForegroundColor Yellow
  exit 1
}

& $venvActivate
python -m uvicorn src.main:app --host 0.0.0.0 --port 8083
