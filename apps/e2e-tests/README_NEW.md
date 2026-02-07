# E2E Test Suite - Second Brain Services

Comprehensive end-to-end tests for TTS and STT services running on CPU.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Make sure services are running
cd ../..
docker-compose up -d

# Run all tests
python run_tests.py
```

## Test Categories

### TTS Service Tests (`test_tts_service_new.py`)
- ✅ Health checks and service availability
- ✅ Basic text synthesis
- ✅ Various text lengths (short, medium, long)
- ✅ Special characters and numbers
- ✅ Performance benchmarks (CPU mode)
- ✅ Concurrent request handling
- ✅ Error handling and edge cases
- ✅ Robustness tests (Unicode, whitespace, etc.)

### STT Service Tests (`test_stt_service_new.py`)
- ✅ Health checks and model status
- ✅ Audio transcription (short, medium, long)
- ✅ Language detection and specification
- ✅ Task modes (transcribe, translate)
- ✅ Segment timestamps validation
- ✅ Performance benchmarks (CPU mode)
- ✅ Concurrent transcriptions
- ✅ Error handling (invalid audio, missing files)

### Integration Tests (`test_integration_new.py`)
- ✅ Round-trip testing (Text → TTS → Audio → STT → Text)
- ✅ Concurrent TTS + STT requests
- ✅ Combined service health
- ✅ End-to-end pipeline latency
- ✅ Throughput testing

## Running Tests

### All Tests
```bash
python run_tests.py
```

### Specific Service
```bash
python run_tests.py tts           # TTS tests only
python run_tests.py stt           # STT tests only
python run_tests.py integration   # Integration tests only
```

### Fast Mode (Skip Slow Tests)
```bash
python run_tests.py --fast
```

### Using Pytest Directly

```bash
# Run all tests
pytest -v

# Run specific test file
pytest tests/test_tts_service_new.py -v

# Run specific test class
pytest tests/test_tts_service_new.py::TestTTSService -v

# Run specific test
pytest tests/test_tts_service_new.py::TestTTSService::test_ping -v

# Skip slow tests
pytest -v -m "not slow"

# Run only integration tests
pytest -v -m integration

# Show print statements
pytest -v -s

# Stop on first failure
pytest -v -x
```

## Test Data

Test audio files are generated automatically on first run:
- `test_data/audio/test_short.wav` - 1 second
- `test_data/audio/test_medium.wav` - 5 seconds
- `test_data/audio/test_long.wav` - 30 seconds

These are synthetic speech-like audio for consistent testing.

## Environment Variables

Edit `.env` to configure:

```env
# Service URLs
TTS_SERVICE_URL=http://localhost:3002
STT_SERVICE_URL=http://localhost:3003

# Test configuration
TEST_TIMEOUT=30
TEST_DATA_DIR=./test_data
```

## Expected Performance (CPU Mode)

### TTS Service
- Short text (<10 words): < 2s
- Medium text (50 words): < 5s
- Long text (200 words): < 10s

### STT Service
- Short audio (1s): ~0.2s (5x real-time)
- Medium audio (5s): ~0.8s (6x real-time)
- Long audio (30s): ~3-4s (8-10x real-time)

## Test Results

Tests will show performance metrics:

```
⏱️  Short text synthesis time: 0.85s
📝 Transcribed text: 'hello world'
🌍 Detected language: en (98.5%)
⏱️  Inference time: 0.23s
📊 Real-time factor: 0.12 (8.3x faster than real-time)
```

## Troubleshooting

### Services Not Running
```bash
# Start services
cd ../..
docker-compose up -d

# Check status
docker-compose ps
curl http://localhost:3002/ping
curl http://localhost:3003/health
```

### Tests Failing
```bash
# Check service logs
docker-compose logs tts-service
docker-compose logs stt-service

# Restart services
docker-compose restart

# Rebuild if needed
docker-compose up -d --build
```

### Import Errors
```bash
# Make sure you're in the e2e-tests directory
cd apps/e2e-tests

# Activate virtual environment (if using)
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt
```

## CI/CD Integration

For automated testing:

```bash
# One-line test command
docker-compose up -d && sleep 10 && pytest -v --tb=short

# With coverage
pytest --cov=. --cov-report=html

# Generate JUnit XML
pytest --junitxml=test-results.xml
```

## Test Markers

```python
@pytest.mark.e2e          # End-to-end test
@pytest.mark.integration  # Integration test
@pytest.mark.slow         # Slow running test (skip with --fast)
@pytest.mark.websocket    # WebSocket test (future)
```

## Writing New Tests

Example test:

```python
import pytest

@pytest.mark.asyncio
@pytest.mark.e2e
class TestNewFeature:
    async def test_something(self, tts_client, sample_text):
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": sample_text}
        )
        
        assert response.status_code == 200
```

## Performance Benchmarking

For detailed performance analysis:

```bash
# Run with timing
pytest -v --durations=10

# Run specific performance tests
pytest tests/test_stt_service_new.py::TestSTTServicePerformance -v -s
```

## Coverage

```bash
# Generate coverage report
pytest --cov=tests --cov-report=html

# View report
open htmlcov/index.html  # Mac/Linux
start htmlcov/index.html # Windows
```

## Next Steps

1. Add WebSocket streaming tests
2. Add load testing with Locust
3. Add memory/resource usage tests
4. Add error recovery tests
5. Add cross-service integration scenarios
