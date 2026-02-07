"""End-to-end tests for TTS service."""

import base64

import pytest


@pytest.mark.asyncio
@pytest.mark.e2e
class TestTTSService:
    """TTS service E2E tests."""

    async def test_service_health(self, tts_client):
        """Test TTS service health endpoint."""
        response = await tts_client.get("/api/tts/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert "version" in data
        assert isinstance(data["model_loaded"], bool)
        assert isinstance(data["gpu_available"], bool)

    async def test_get_voices(self, tts_client):
        """Test getting available voices."""
        response = await tts_client.get("/api/tts/voices")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "voices" in data
        assert len(data["voices"]) > 0
        
        # Validate voice structure
        voice = data["voices"][0]
        assert "id" in voice
        assert "name" in voice
        assert "language" in voice
        assert "gender" in voice

    async def test_synthesize_text(self, tts_client, sample_text):
        """Test basic text synthesis."""
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={
                "text": sample_text,
                "voice": "default",
                "speed": 1.0,
                "format": "wav"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "audio" in data
        assert "duration" in data
        assert "format" in data
        assert "sample_rate" in data
        assert "processing_time" in data
        
        # Validate audio data
        audio_bytes = base64.b64decode(data["audio"])
        assert len(audio_bytes) > 0
        
        # Validate metrics
        assert data["duration"] > 0
        assert data["sample_rate"] > 0
        assert data["processing_time"] > 0

    async def test_synthesize_with_speed_variation(self, tts_client, sample_text):
        """Test synthesis with different speeds."""
        speeds = [0.5, 1.0, 1.5, 2.0]
        durations = []
        
        for speed in speeds:
            response = await tts_client.post(
                "/api/tts/synthesize",
                json={
                    "text": sample_text,
                    "speed": speed,
                    "format": "wav"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            durations.append(data["duration"])
        
        # Slower speeds should produce longer audio
        assert durations[0] > durations[-1]

    async def test_synthesize_binary(self, tts_client, sample_text):
        """Test binary audio synthesis."""
        response = await tts_client.post(
            "/api/tts/synthesize/binary",
            json={
                "text": sample_text,
                "format": "wav"
            }
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("audio/")
        
        # Validate binary audio
        audio_data = response.content
        assert len(audio_data) > 0
        
        # WAV files start with 'RIFF'
        assert audio_data[:4] == b"RIFF"

    async def test_synthesize_long_text(self, tts_client, sample_long_text):
        """Test synthesis with longer text."""
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={
                "text": sample_long_text,
                "format": "wav"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Longer text should produce longer audio
        assert data["duration"] > 2.0  # At least 2 seconds

    async def test_invalid_speed(self, tts_client, sample_text):
        """Test synthesis with invalid speed parameter."""
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={
                "text": sample_text,
                "speed": 5.0  # Out of range (0.5-2.0)
            }
        )
        
        assert response.status_code == 422  # Validation error

    async def test_empty_text(self, tts_client):
        """Test synthesis with empty text."""
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={
                "text": ""
            }
        )
        
        assert response.status_code == 422  # Validation error

    async def test_very_long_text(self, tts_client):
        """Test synthesis with text exceeding max length."""
        long_text = "a" * 20000  # Exceeds 10000 char limit
        
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={
                "text": long_text
            }
        )
        
        assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
@pytest.mark.e2e
@pytest.mark.websocket
class TestTTSWebSocket:
    """TTS WebSocket E2E tests."""

    async def test_websocket_streaming(self, test_config, sample_text):
        """Test WebSocket streaming synthesis."""
        import websockets
        
        ws_url = f"{test_config['tts_url'].replace('http', 'ws')}/api/tts/stream"
        
        async with websockets.connect(ws_url) as websocket:
            # Send synthesis request
            await websocket.send(
                '{"type": "synthesize", "text": "' + sample_text + '", "speed": 1.0}'
            )
            
            chunks_received = 0
            completed = False
            
            # Receive chunks
            while not completed:
                response = await websocket.recv()
                import json
                data = json.loads(response)
                
                if data["type"] == "audio_chunk":
                    assert "data" in data
                    assert "sequence_id" in data
                    chunks_received += 1
                elif data["type"] == "complete":
                    completed = True
                    assert data["is_last"] is True
            
            assert chunks_received > 0


@pytest.mark.asyncio
@pytest.mark.e2e
@pytest.mark.slow
class TestTTSPerformance:
    """TTS performance tests."""

    async def test_synthesis_latency(self, tts_client, sample_text):
        """Test synthesis latency is acceptable."""
        import time
        
        start = time.time()
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": sample_text}
        )
        latency = time.time() - start
        
        assert response.status_code == 200
        data = response.json()
        
        # Real-time factor should be < 1.0 (faster than real-time)
        rtf = data["processing_time"] / data["duration"]
        assert rtf < 1.0, f"RTF {rtf} is too high"
        
        # Total latency should be reasonable
        assert latency < 5.0, f"Latency {latency}s is too high"

    async def test_concurrent_synthesis(self, tts_client, sample_text):
        """Test handling multiple concurrent requests."""
        import asyncio
        
        # Send 5 concurrent requests
        tasks = []
        for _ in range(5):
            task = tts_client.post(
                "/api/tts/synthesize",
                json={"text": sample_text}
            )
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks)
        
        # All should succeed
        for response in responses:
            assert response.status_code == 200
