# Test STT Service

import requests
import json
from pathlib import Path

# Create a simple test
def test_stt_health():
    """Test STT health endpoint."""
    response = requests.get("http://localhost:3003/health")
    print("\n=== STT Health Check ===")
    print(json.dumps(response.json(), indent=2))
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    print("✅ Health check passed")

def test_tts_health():
    """Test TTS health endpoint."""
    response = requests.get("http://localhost:3002/ping")
    print("\n=== TTS Health Check ===")
    print(json.dumps(response.json(), indent=2))
    assert response.status_code == 200
    assert response.json()["status"] == "pong"
    print("✅ TTS health check passed")

if __name__ == "__main__":
    print("Testing Second Brain Services (CPU Mode)")
    print("=" * 50)
    
    try:
        test_tts_health()
        test_stt_health()
        print("\n" + "=" * 50)
        print("✅ All services are healthy and running!")
        print("=" * 50)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        exit(1)
