"""Integration tests for TTS service API routes."""

import asyncio
import base64
import time
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient


@pytest.fixture
def mock_tts_engine():
    """Mock TTS engine for API tests."""
    mock_engine = MagicMock()
    mock_engine._initialized = True
    
    async def mock_synthesize(text, speed=1.0, sample_rate=22050):
        """Mock async synthesis with realistic timing."""
        # Simulate processing time
        await asyncio.sleep(0.15)
        
        # Return dummy audio data
        audio_data = np.random.randn(1000).astype(np.float32) * 0.5
        return audio_data, 22050
    
    def mock_audio_to_bytes(audio_data, sample_rate, format="wav"):
        """Mock audio conversion."""
        # Return some realistic dummy WAV bytes
        return b"RIFF" + b"\x00" * 100
    
    mock_engine.synthesize = mock_synthesize
    mock_engine.audio_to_bytes = mock_audio_to_bytes
    
    return mock_engine


@pytest.mark.asyncio
class TestTTSRoutes:
    """Test TTS API routes."""

    async def test_health_endpoint(self):
        """Test health check endpoint."""
        from src.main import app
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/tts/health")
            
            assert response.status_code == 200
            data = response.json()
            assert "status" in data
            assert "version" in data
            assert "model_loaded" in data

    async def test_voices_endpoint(self):
        """Test voices listing endpoint."""
        from src.main import app
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/tts/voices")
            
            assert response.status_code == 200
            data = response.json()
            assert "voices" in data
            assert len(data["voices"]) > 0

    async def test_synthesize_endpoint(self, mock_tts_engine):
        """Test synthesis endpoint."""
        from src.main import app
        
        with patch('src.routes.get_engine', return_value=mock_tts_engine):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    "/api/tts/synthesize",
                    json={
                        "text": "Hello, world!",
                        "speed": 1.0,
                        "format": "wav"
                    }
                )
                
                assert response.status_code == 200
                data = response.json()
                
                assert "audio" in data
                assert "duration" in data
                assert "format" in data
                assert "sample_rate" in data
                assert "processing_time" in data
                
                # Verify audio is base64 encoded
                try:
                    audio_bytes = base64.b64decode(data["audio"])
                    assert len(audio_bytes) > 0
                except Exception as e:
                    pytest.fail(f"Invalid base64 audio: {e}")

    async def test_concurrent_synthesis_requests(self, mock_tts_engine):
        """Test that concurrent synthesis requests are properly queued."""
        from src.main import app
        
        # Track request timing
        request_times = []
        
        original_synthesize = mock_tts_engine.synthesize
        
        async def tracked_synthesize(text, speed=1.0, sample_rate=22050):
            """Track synthesis timing."""
            start_time = time.time()
            result = await original_synthesize(text, speed, sample_rate)
            end_time = time.time()
            request_times.append((start_time, end_time, text))
            return result
        
        mock_tts_engine.synthesize = tracked_synthesize
        
        with patch('src.routes.get_engine', return_value=mock_tts_engine):
            async with AsyncClient(app=app, base_url="http://test") as client:
                # Launch 5 concurrent requests
                tasks = []
                for i in range(5):
                    task = client.post(
                        "/api/tts/synthesize",
                        json={
                            "text": f"Request number {i}",
                            "speed": 1.0,
                            "format": "wav"
                        }
                    )
                    tasks.append(task)
                
                # Execute all concurrently
                responses = await asyncio.gather(*tasks)
                
                # Verify all succeeded
                for response in responses:
                    assert response.status_code == 200
                
                # Verify requests were serialized (no overlap)
                assert len(request_times) == 5
                
                # Sort by start time
                request_times.sort(key=lambda x: x[0])
                
                # Check for sequential execution (no overlap)
                for i in range(1, len(request_times)):
                    prev_end = request_times[i-1][1]
                    curr_start = request_times[i][0]
                    
                    # Current should start after previous ended (with small tolerance)
                    assert curr_start >= prev_end - 0.01, \
                        f"Request {i} overlapped with request {i-1}"

    async def test_concurrent_requests_performance(self, mock_tts_engine):
        """Test performance impact of request queuing."""
        from src.main import app
        
        with patch('src.routes.get_engine', return_value=mock_tts_engine):
            async with AsyncClient(app=app, base_url="http://test") as client:
                # Measure time for 3 concurrent requests
                start_time = time.time()
                
                tasks = [
                    client.post(
                        "/api/tts/synthesize",
                        json={"text": f"Request {i}", "speed": 1.0, "format": "wav"}
                    )
                    for i in range(3)
                ]
                
                responses = await asyncio.gather(*tasks)
                total_time = time.time() - start_time
                
                # All should succeed
                for response in responses:
                    assert response.status_code == 200
                
                # Should take roughly 3x single request time (0.15s each = ~0.45s)
                # Allow for some overhead (~50%)
                expected_min = 0.45  # 3 * 0.15s
                expected_max = 0.75  # 50% overhead tolerance
                
                assert expected_min <= total_time <= expected_max, \
                    f"Unexpected total time: {total_time}s (expected {expected_min}-{expected_max}s)"

    async def test_binary_synthesize_endpoint(self, mock_tts_engine):
        """Test binary synthesis endpoint."""
        from src.main import app
        
        with patch('src.routes.get_engine', return_value=mock_tts_engine):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    "/api/tts/synthesize/binary",
                    json={
                        "text": "Binary audio test",
                        "speed": 1.0,
                        "format": "wav"
                    }
                )
                
                assert response.status_code == 200
                assert response.headers["content-type"] == "audio/wav"
                assert len(response.content) > 0

    async def test_error_handling_doesnt_block_queue(self, mock_tts_engine):
        """Test that errors don't permanently block the request queue."""
        from src.main import app
        
        call_count = 0
        original_synthesize = mock_tts_engine.synthesize
        
        async def failing_synthesize(text, speed=1.0, sample_rate=22050):
            """Fail first call, succeed after."""
            nonlocal call_count
            call_count += 1
            
            if call_count == 1:
                raise RuntimeError("Synthesis failed")
            
            return await original_synthesize(text, speed, sample_rate)
        
        mock_tts_engine.synthesize = failing_synthesize
        
        with patch('src.routes.get_engine', return_value=mock_tts_engine):
            async with AsyncClient(app=app, base_url="http://test") as client:
                # First request should fail
                response = await client.post(
                    "/api/tts/synthesize",
                    json={"text": "Will fail", "speed": 1.0, "format": "wav"}
                )
                assert response.status_code == 500
                
                # Second request should succeed
                response = await client.post(
                    "/api/tts/synthesize",
                    json={"text": "Should work", "speed": 1.0, "format": "wav"}
                )
                assert response.status_code == 200

    async def test_validation_errors(self):
        """Test input validation."""
        from src.main import app
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Missing required field
            response = await client.post(
                "/api/tts/synthesize",
                json={"speed": 1.0}  # Missing 'text'
            )
            assert response.status_code == 422
            
            # Invalid speed
            response = await client.post(
                "/api/tts/synthesize",
                json={"text": "Test", "speed": 5.0}  # Speed too high
            )
            assert response.status_code == 422

    async def test_concurrent_mixed_endpoints(self, mock_tts_engine):
        """Test concurrent requests to different endpoints."""
        from src.main import app
        
        with patch('src.routes.get_engine', return_value=mock_tts_engine):
            async with AsyncClient(app=app, base_url="http://test") as client:
                # Mix of regular and binary endpoints
                tasks = [
                    client.post(
                        "/api/tts/synthesize",
                        json={"text": "Regular 1", "speed": 1.0, "format": "wav"}
                    ),
                    client.post(
                        "/api/tts/synthesize/binary",
                        json={"text": "Binary 1", "speed": 1.0, "format": "wav"}
                    ),
                    client.post(
                        "/api/tts/synthesize",
                        json={"text": "Regular 2", "speed": 1.0, "format": "wav"}
                    ),
                ]
                
                responses = await asyncio.gather(*tasks)
                
                # All should succeed
                assert responses[0].status_code == 200
                assert responses[1].status_code == 200
                assert responses[2].status_code == 200
                
                # Verify response types
                assert "audio" in responses[0].json()  # Regular (base64)
                assert responses[1].headers["content-type"] == "audio/wav"  # Binary


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
