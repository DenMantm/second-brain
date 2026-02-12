# TTS Concurrent Request Serialization Fix

## Problem

The TTS service was processing all synthesis requests **concurrently** without any synchronization mechanism. When multiple HTTP requests arrived simultaneously, they would all invoke the Piper TTS model at the same time.

### Why This Is a Problem

1. **Thread Safety**: The Piper TTS model is not thread-safe. Concurrent access can cause:
   - Memory corruption
   - Segmentation faults
   - Unpredictable behavior
   - Service crashes

2. **Resource Contention**: Multiple concurrent syntheses compete for:
   - GPU memory (if using CUDA)
   - CPU cycles
   - Memory bandwidth

3. **Degraded Performance**: Concurrent execution actually **slows down** individual requests due to context switching and resource contention.

4. **Inconsistent Results**: Race conditions can lead to:
   - Corrupted audio output
   - Truncated responses
   - Mixed audio from different requests

### Example Scenario

```
Without Fix (BROKEN):
┌─────────────────────────────────┐
│ Request 1: "Hello"              │ ◄─┐
│ Request 2: "World"              │ ◄─┼─ All execute
│ Request 3: "Test"               │ ◄─┘  CONCURRENTLY
└─────────────────────────────────┘
         Time: ~150ms
         Result: ❌ CRASHES/CORRUPTION
```

## Solution

Added an `asyncio.Lock` to the `TTSEngine` class that serializes all synthesis requests.

### Implementation

```python
class TTSEngine:
    def __init__(self, ...):
        ...
        self._synthesis_lock = asyncio.Lock()
    
    async def synthesize(self, text: str, ...):
        # Acquire lock - only one request at a time
        async with self._synthesis_lock:
            # Actual synthesis happens here
            return await self._synthesize_internal(text)
```

### How It Works

```
With Fix (CORRECT):
┌─────────────────────────────────┐
│ Request 1: "Hello"              │ ← Executes first   (0-150ms)
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Request 2: "World"              │ ← Waits, then runs (150-300ms)
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Request 3: "Test"               │ ← Waits, then runs (300-450ms)
└─────────────────────────────────┘
         Time: ~450ms total
         Result: ✅ ALL SUCCEED
```

## Changes Made

### 1. `tts_engine.py`

```python
# Added import
import asyncio

# Added lock to __init__
self._synthesis_lock = asyncio.Lock()

# Made synthesize async with lock
async def synthesize(self, text: str, ...):
    async with self._synthesis_lock:
        # Run synthesis in executor to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._synthesize_sync,
            text, speed, sample_rate
        )

# Extracted sync version
def _synthesize_sync(self, text: str, ...):
    # Original synthesis logic here
    ...
```

### 2. `routes.py`

```python
# Updated to await the now-async synthesize method
audio_data, sample_rate = await engine.synthesize(...)
```

### 3. Tests Added

- `test_tts_engine.py` - Unit tests for engine serialization
- `test_routes.py` - Integration tests for API endpoints
- Comprehensive concurrent request testing

## Performance Impact

### Before Fix
- 3 concurrent requests: ~150ms (but crash risk 🔥)
- Unpredictable, unsafe

### After Fix
- 3 concurrent requests: ~450ms (3 × 150ms)
- Predictable, safe, stable

### Trade-offs

✅ **Gains:**
- Thread safety guaranteed
- No crashes or corruption
- Predictable performance
- Error isolation

❌ **Costs:**
- Increased latency for concurrent requests
- But this is **necessary** for correctness

## Why Not Use Thread Pool?

We use `asyncio.Lock` instead of threading because:

1. **FastAPI is async** - We're already in an async context
2. **Better integration** - Works seamlessly with async/await
3. **Lower overhead** - No thread switching costs
4. **Simpler** - No need to manage thread pools
5. **Executor used** - We still use thread executor for actual synthesis

## Verification

### Run Tests

```bash
cd apps/tts-service
python -m pytest tests/ -v
```

### Run Demonstration

```bash
python demo_concurrent_fix.py
```

This shows the difference between locked and unlocked execution.

### Key Tests

1. **Serialization Test**: Verifies no request overlap
   ```python
   test_concurrent_synthesis_serialization
   ```

2. **Performance Test**: Ensures acceptable overhead
   ```python
   test_synthesis_performance_with_queuing
   ```

3. **Error Recovery Test**: Ensures errors don't block queue
   ```python
   test_synthesis_error_doesnt_block_queue
   ```

## Monitoring

### Check Logs

The engine now logs wait times:

```
INFO - Synthesizing text: Hello... (waiting time: 0.003s)
INFO - Synthesis completed in 0.152s, 22050 samples
```

If `waiting time` is high, requests are queuing (expected behavior).

### Metrics to Watch

- **Request duration**: Should be consistent (~150-200ms per request)
- **Queue depth**: Number of requests waiting (increases under load)
- **Error rate**: Should remain low (errors don't block queue)

## Future Improvements

1. **Queue Metrics**: Expose queue depth via `/health` endpoint
2. **Priority Queuing**: High-priority requests jump queue
3. **Request Timeout**: Abort requests waiting too long
4. **Batch Processing**: Process multiple short texts together
5. **Model Pooling**: Multiple model instances (if memory allows)

## Related Files

- `src/tts_engine.py` - Core fix implementation
- `src/routes.py` - API endpoint updates
- `tests/test_tts_engine.py` - Engine unit tests
- `tests/test_routes.py` - API integration tests
- `demo_concurrent_fix.py` - Visual demonstration
- `CONCURRENT_FIX.md` - This document

## References

- [Piper TTS Documentation](https://github.com/rhasspy/piper)
- [asyncio Locks](https://docs.python.org/3/library/asyncio-sync.html#asyncio.Lock)
- [FastAPI Concurrency](https://fastapi.tiangolo.com/async/)

---

**Last Updated**: February 12, 2026  
**Status**: ✅ **FIXED** - All tests passing
