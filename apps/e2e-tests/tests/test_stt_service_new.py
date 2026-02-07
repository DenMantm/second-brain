"""End-to-end tests for STT service (CPU Mode)."""

import pytest
from pathlib import Path


@pytest.mark.asyncio
@pytest.mark.e2e
class TestSTTService:
    """STT service E2E tests."""

    async def test_ping(self, stt_client):
        """Test STT service ping endpoint."""
        response = await stt_client.get("/ping")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pong"

    async def test_service_health(self, stt_client):
        """Test STT service health endpoint."""
        response = await stt_client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert "model_loaded" in data
        assert "model_size" in data
        assert "device" in data
        assert "compute_type" in data
        
        # Verify CPU mode
        assert data["device"] == "cpu"
        assert data["compute_type"] == "int8"

    async def test_transcribe_short_audio(self, stt_client, test_audio_short):
        """Test transcription of short audio file."""
        with open(test_audio_short, "rb") as f:
            files = {"audio": ("test.wav", f, "audio/wav")}
            response = await stt_client.post(
                "/api/stt/transcribe",
                files=files
            )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "text" in data
        assert "segments" in data
        assert "language" in data
        assert "language_probability" in data
        assert "duration" in data
        assert "inference_time" in data
        
        # Verify types
        assert isinstance(data["text"], str)
        assert isinstance(data["segments"], list)
        assert isinstance(data["duration"], (int, float))
        assert isinstance(data["inference_time"], (int, float))
        
        print(f"\n📝 Transcribed text: '{data['text']}'")
        print(f"🌍 Detected language: {data['language']} ({data['language_probability']:.2%})")
        print(f"⏱️  Inference time: {data['inference_time']:.2f}s")

    async def test_transcribe_medium_audio(self, stt_client, test_audio_medium):
        """Test transcription of medium-length audio."""
        with open(test_audio_medium, "rb") as f:
            files = {"audio": ("test.wav", f, "audio/wav")}
            response = await stt_client.post(
                "/api/stt/transcribe",
                files=files
            )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "text" in data
        assert data["duration"] > 4.0  # ~5 seconds
        
        # Should have multiple segments for longer audio
        assert len(data["segments"]) >= 1
        
        print(f"\n⏱️  Medium audio inference time: {data['inference_time']:.2f}s")

    @pytest.mark.slow
    async def test_transcribe_long_audio(self, stt_client, test_audio_long):
        """Test transcription of long audio file."""
        import time
        
        start = time.time()
        
        with open(test_audio_long, "rb") as f:
            files = {"audio": ("test.wav", f, "audio/wav")}
            response = await stt_client.post(
                "/api/stt/transcribe",
                files=files
            )
        
        elapsed = time.time() - start
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["duration"] > 25.0  # ~30 seconds
        assert len(data["segments"]) > 0
        
        # Performance check (should be faster than real-time on CPU)
        rtf = data["inference_time"] / data["duration"]
        print(f"\n⏱️  Long audio ({data['duration']:.1f}s) inference: {data['inference_time']:.2f}s")
        print(f"📊 Real-time factor: {rtf:.2f} ({1/rtf:.1f}x faster than real-time)")
        
        # Should be faster than real-time (RTF < 1)
        assert rtf < 1.0

    async def test_transcribe_with_language_specified(self, stt_client, test_audio_short):
        """Test transcription with explicit language specification."""
        with open(test_audio_short, "rb") as f:
            files = {"audio": ("test.wav", f, "audio/wav")}
            data = {"language": "en"}
            response = await stt_client.post(
                "/api/stt/transcribe",
                files=files,
                data=data
            )
        
        assert response.status_code == 200
        result = response.json()
        
        # Language should be set to English
        assert result["language"] == "en"

    async def test_transcribe_auto_language_detection(self, stt_client, test_audio_short):
        """Test auto language detection."""
        with open(test_audio_short, "rb") as f:
            files = {"audio": ("test.wav", f, "audio/wav")}
            # No language specified - should auto-detect
            response = await stt_client.post(
                "/api/stt/transcribe",
                files=files
            )
        
        assert response.status_code == 200
        result = response.json()
        
        # Should detect some language
        assert result["language"] is not None
        assert result["language_probability"] > 0.0

    async def test_transcribe_missing_audio(self, stt_client):
        """Test transcription without audio file."""
        response = await stt_client.post(
            "/api/stt/transcribe",
            files={}
        )
        
        # Should return error
        assert response.status_code in [400, 422]

    async def test_transcribe_invalid_audio_format(self, stt_client):
        """Test transcription with invalid audio format."""
        # Send plain text as audio
        files = {"audio": ("test.txt", b"not an audio file", "text/plain")}
        response = await stt_client.post(
            "/api/stt/transcribe",
            files=files
        )
        
        # Should return error
        assert response.status_code in [400, 422, 500]

    async def test_transcribe_task_translate(self, stt_client, test_audio_short):
        """Test translation task (translate to English)."""
        with open(test_audio_short, "rb") as f:
            files = {"audio": ("test.wav", f, "audio/wav")}
            data = {"task": "translate"}
            response = await stt_client.post(
                "/api/stt/transcribe",
                files=files,
                data=data
            )
        
        assert response.status_code == 200
        result = response.json()
        
        assert "text" in result

    async def test_transcribe_invalid_task(self, stt_client, test_audio_short):
        """Test with invalid task parameter."""
        with open(test_audio_short, "rb") as f:
            files = {"audio": ("test.wav", f, "audio/wav")}
            data = {"task": "invalid_task"}
            response = await stt_client.post(
                "/api/stt/transcribe",
                files=files,
                data=data
            )
        
        # Should return error for invalid task
        assert response.status_code in [400, 422]

    async def test_segment_timestamps(self, stt_client, test_audio_medium):
        """Test that segments have valid timestamps."""
        with open(test_audio_medium, "rb") as f:
            files = {"audio": ("test.wav", f, "audio/wav")}
            response = await stt_client.post(
                "/api/stt/transcribe",
                files=files
            )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check segments
        for segment in data["segments"]:
            assert "start" in segment
            assert "end" in segment
            assert "text" in segment
            
            # Timestamps should be valid
            assert segment["start"] >= 0
            assert segment["end"] > segment["start"]
            assert segment["end"] <= data["duration"]

    @pytest.mark.slow
    async def test_concurrent_transcriptions(self, stt_client, test_audio_short):
        """Test handling concurrent transcription requests."""
        import asyncio
        
        async def transcribe():
            with open(test_audio_short, "rb") as f:
                audio_data = f.read()
            
            files = {"audio": ("test.wav", audio_data, "audio/wav")}
            return await stt_client.post(
                "/api/stt/transcribe",
                files=files
            )
        
        # Send 3 concurrent requests
        tasks = [transcribe() for _ in range(3)]
        responses = await asyncio.gather(*tasks)
        
        # All should succeed
        for response in responses:
            assert response.status_code == 200
            data = response.json()
            assert "text" in data


@pytest.mark.asyncio
@pytest.mark.e2e
class TestSTTServicePerformance:
    """STT service performance tests."""

    async def test_performance_metrics(self, stt_client, test_audio_short):
        """Test and display performance metrics."""
        import time
        
        # Warm-up request (model loading)
        with open(test_audio_short, "rb") as f:
            files = {"audio": ("test.wav", f.read(), "audio/wav")}
            await stt_client.post("/api/stt/transcribe", files=files)
        
        # Actual performance test
        start = time.time()
        with open(test_audio_short, "rb") as f:
            files = {"audio": ("test.wav", f.read(), "audio/wav")}
            response = await stt_client.post("/api/stt/transcribe", files=files)
        
        total_time = time.time() - start
        
        assert response.status_code == 200
        data = response.json()
        
        rtf = data["inference_time"] / data["duration"]
        
        print(f"\n📊 STT Performance Metrics:")
        print(f"  Audio duration: {data['duration']:.2f}s")
        print(f"  Inference time: {data['inference_time']:.2f}s")
        print(f"  Total request time: {total_time:.2f}s")
        print(f"  Real-time factor: {rtf:.3f}")
        print(f"  Speed: {1/rtf:.1f}x faster than real-time")
        
        # On CPU with base model, should be 5-10x faster than real-time
        assert rtf < 0.5  # At least 2x faster than real-time

    async def test_repeated_transcriptions(self, stt_client, test_audio_short):
        """Test performance of repeated transcriptions."""
        import time
        
        times = []
        
        for i in range(5):
            start = time.time()
            
            with open(test_audio_short, "rb") as f:
                files = {"audio": ("test.wav", f.read(), "audio/wav")}
                response = await stt_client.post("/api/stt/transcribe", files=files)
            
            elapsed = time.time() - start
            times.append(elapsed)
            
            assert response.status_code == 200
        
        avg_time = sum(times) / len(times)
        print(f"\n⏱️  Average transcription time (5 runs): {avg_time:.2f}s")
        print(f"  Min: {min(times):.2f}s, Max: {max(times):.2f}s")
