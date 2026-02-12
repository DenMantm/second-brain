# TTS Service Tests

This directory contains comprehensive tests for the TTS service to ensure proper request serialization and concurrent handling.

## Test Coverage

### Unit Tests (`test_tts_engine.py`)

1. **Engine Initialization** - Verifies TTS engine loads correctly
2. **Basic Synthesis** - Tests single synthesis request
3. **Concurrent Synthesis Serialization** - Ensures concurrent requests are properly queued
4. **Performance Testing** - Verifies queuing doesn't add excessive overhead
5. **Error Handling** - Ensures errors don't permanently block the queue
6. **Streaming Synthesis** - Tests streaming audio generation
7. **Audio Enhancement** - Verifies enhancement processing

### Integration Tests (`test_routes.py`)

1. **Health Endpoint** - Tests service health check
2. **Voices Endpoint** - Tests voice listing
3. **Synthesize Endpoint** - Tests main synthesis API
4. **Concurrent Requests** - Verifies HTTP requests are properly serialized
5. **Performance** - Ensures acceptable request throughput
6. **Binary Endpoint** - Tests raw audio response
7. **Error Handling** - Verifies error recovery
8. **Mixed Endpoints** - Tests concurrent requests to different endpoints

## Key Test: Concurrent Synthesis Serialization

The most important test (`test_concurrent_synthesis_serialization`) verifies that when multiple synthesis requests arrive simultaneously, they are processed **sequentially** rather than concurrently. This prevents:

- Thread safety issues with the Piper model
- Memory contention
- Audio corruption
- Service crashes

### How It Works

1. Launches 3-5 concurrent synthesis requests
2. Tracks exact start/end times for each request
3. Verifies no overlap: Request N must start after Request N-1 ends
4. Ensures proper serialization using asyncio Lock

## Running Tests

### Install Dependencies

```bash
cd apps/tts-service
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### Run All Tests

```bash
pytest
```

### Run Specific Test File

```bash
pytest tests/test_tts_engine.py
pytest tests/test_routes.py
```

### Run Specific Test

```bash
pytest tests/test_tts_engine.py::TestTTSEngine::test_concurrent_synthesis_serialization
```

### Run with Coverage

```bash
pytest --cov=src --cov-report=html
```

Then open `htmlcov/index.html` in a browser.

### Run in Verbose Mode

```bash
pytest -v
```

### Run in Watch Mode (requires pytest-watch)

```bash
ptw
```

## Expected Results

All tests should pass, confirming:

✅ Concurrent requests are properly serialized
✅ No request overlap or race conditions  
✅ Minimal queuing overhead (~50% max)
✅ Error recovery works correctly
✅ Queue doesn't permanently block

## Test Execution Time

- Unit tests: ~5-10 seconds
- Integration tests: ~10-15 seconds
- Total: ~15-25 seconds

## Troubleshooting

### Tests Fail with Import Errors

Ensure you're in the correct directory and dependencies are installed:

```bash
cd apps/tts-service
pip install -r requirements.txt -r requirements-dev.txt
```

### Tests Fail with "Event Loop Closed"

This can happen with async tests. Ensure pytest-asyncio is installed:

```bash
pip install pytest-asyncio
```

### Coverage Not Generated

Install pytest-cov:

```bash
pip install pytest-cov
```

## Adding New Tests

When adding features, ensure you add corresponding tests:

1. Unit tests for core logic in `test_tts_engine.py`
2. Integration tests for API endpoints in `test_routes.py`
3. Update this README with new test descriptions

## CI/CD Integration

These tests should be run in CI/CD pipelines:

```yaml
- name: Run TTS Tests
  run: |
    cd apps/tts-service
    pip install -r requirements.txt -r requirements-dev.txt
    pytest --cov=src --cov-report=xml
```
