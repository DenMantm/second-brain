# E2E Testing Suite

End-to-end testing framework for Second Brain services.

## Overview

Comprehensive testing suite covering:
- **Unit Tests**: Individual component testing
- **Integration Tests**: Multi-service interactions
- **E2E Tests**: Full user workflows
- **Performance Tests**: Load and stress testing
- **WebSocket Tests**: Real-time communication testing

## Setup

### Installation

```bash
# In WSL
cd ~/projects/second-brain/apps/e2e-tests

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment configuration
cp .env.example .env
```

### Configuration

Edit `.env` to match your service URLs:

```bash
TTS_SERVICE_URL=http://localhost:3002
STT_SERVICE_URL=http://localhost:3001
API_SERVICE_URL=http://localhost:3000
```

## Running Tests

### Quick Start

```bash
# Run all tests
./run_tests.sh

# Run specific test types
./run_tests.sh --e2e          # End-to-end only
./run_tests.sh --integration  # Integration only
./run_tests.sh --unit         # Unit only

# Run tests in parallel
./run_tests.sh --parallel
```

### Using pytest directly

```bash
# All tests
pytest

# Specific test file
pytest tests/test_tts_service.py

# Specific test class
pytest tests/test_tts_service.py::TestTTSService

# Specific test method
pytest tests/test_tts_service.py::TestTTSService::test_synthesize_text

# With markers
pytest -m e2e
pytest -m "e2e and not slow"

# With coverage
pytest --cov --cov-report=html
```

## Test Structure

```
e2e-tests/
├── tests/
│   ├── test_tts_service.py      # TTS E2E tests
│   ├── test_stt_service.py      # STT E2E tests
│   └── test_integration.py      # Cross-service tests
├── conftest.py                  # Shared fixtures
├── locustfile.py                # Performance tests
├── pytest.ini                   # Pytest config
└── requirements.txt             # Dependencies
```

## Test Categories

### E2E Tests
Test complete user workflows:
- TTS synthesis flow
- STT transcription flow
- Voice interaction loop

### Integration Tests
Test service interactions:
- TTS + STT round-trip
- API + TTS/STT coordination

### Performance Tests
Load and stress testing:

```bash
# Run performance tests
./run_perf_tests.sh 10 2 60s tts

# Parameters: users spawn_rate duration target
# Example: 10 users, 2/sec spawn rate, 60s duration, TTS target
```

Or use Locust UI:

```bash
locust -f locustfile.py TTSUser
# Open http://localhost:8089
```

## Writing Tests

### Example E2E Test

```python
import pytest

@pytest.mark.asyncio
@pytest.mark.e2e
async def test_tts_synthesis(tts_client, sample_text):
    """Test TTS synthesis."""
    response = await tts_client.post(
        "/api/tts/synthesize",
        json={"text": sample_text}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "audio" in data
```

### Available Fixtures

- `tts_client`: Async HTTP client for TTS service
- `stt_client`: Async HTTP client for STT service
- `api_client`: Async HTTP client for API service
- `sample_text`: Sample text for testing
- `sample_long_text`: Longer text sample
- `test_config`: Test configuration dict

## Test Markers

```python
@pytest.mark.unit          # Unit test
@pytest.mark.integration   # Integration test
@pytest.mark.e2e          # End-to-end test
@pytest.mark.slow         # Slow test (>5s)
@pytest.mark.websocket    # WebSocket test
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd apps/e2e-tests
          pip install -r requirements.txt
      
      - name: Run tests
        run: |
          cd apps/e2e-tests
          pytest -m "not slow"
```

## Reports

Tests generate multiple reports:

- **HTML**: `test_results/report.html`
- **JUnit XML**: `test_results/junit.xml`
- **Coverage**: `htmlcov/index.html`
- **Locust**: `test_results/locust_report.html`

## Best Practices

1. **Use fixtures** for common setup
2. **Mark tests appropriately** (e2e, slow, etc.)
3. **Test real scenarios** not just happy paths
4. **Keep tests isolated** - no dependencies between tests
5. **Clean up resources** in fixtures
6. **Use meaningful assertions** with descriptive messages
7. **Mock external dependencies** when appropriate

## Troubleshooting

### Services Not Available
Tests auto-skip if services aren't running. Start services first:

```bash
# Terminal 1: TTS Service
cd apps/tts-service
./run.sh

# Terminal 2: Tests
cd apps/e2e-tests
./run_tests.sh
```

### Timeout Errors
Increase timeout in `.env`:

```bash
TEST_TIMEOUT=60
```

### WebSocket Tests Failing
Ensure WebSocket support is enabled in services and firewall allows connections.

---

**Last Updated**: February 7, 2026
