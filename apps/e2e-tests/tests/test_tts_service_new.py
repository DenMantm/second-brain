"""End-to-end tests for TTS service (CPU Mode)."""

import pytest
import io


@pytest.mark.asyncio
@pytest.mark.e2e
class TestTTSService:
    """TTS service E2E tests."""

    async def test_ping(self, tts_client):
        """Test TTS service ping endpoint."""
        response = await tts_client.get("/ping")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pong"

    async def test_service_health(self, tts_client):
        """Test TTS service health endpoint (if available)."""
        response = await tts_client.get("/health")
        
        # May return 404 if not implemented, that's OK
        if response.status_code == 200:
            data = response.json()
            assert "status" in data

    async def test_synthesize_text_basic(self, tts_client, sample_text_short):
        """Test basic text synthesis."""
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": sample_text_short}
        )
        
        assert response.status_code == 200
        
        # Response should be JSON with audio data
        data = response.json()
        
        assert "audio" in data
        assert "duration" in data
        assert "format" in data
        assert "sample_rate" in data
        assert "processing_time" in data
        
        # Decode audio from base64
        import base64
        audio_bytes = base64.b64decode(data["audio"])
        assert len(audio_bytes) > 1000  # WAV header + some audio
        
        # Verify WAV header
        assert audio_bytes[:4] == b'RIFF'
        assert audio_bytes[8:12] == b'WAVE'
        
        # Check metrics
        assert data["duration"] > 0
        assert data["sample_rate"] > 0
        assert data["processing_time"] > 0
        
        print(f"\n⏱️  TTS processing time: {data['processing_time']:.3f}s")
        print(f"📊 Duration: {data['duration']:.2f}s, RTF: {data['processing_time']/data['duration']:.3f}")

    async def test_synthesize_medium_text(self, tts_client, sample_text):
        """Test synthesis with medium-length text."""
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": sample_text}
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        
        data = response.json()
        assert "audio" in data
        assert "duration" in data
        assert data["duration"] > 1.0  # Longer text = more audio

    async def test_synthesize_long_text(self, tts_client, sample_text_long):
        """Test synthesis with long text."""
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": sample_text_long}
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        
        data = response.json()
        assert "audio" in data
        assert "duration" in data
        assert data["duration"] > 2.0  # Even longer audio

    async def test_synthesize_empty_text(self, tts_client):
        """Test synthesis with empty text (should fail)."""
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": ""}
        )
        
        # Should return error for empty text
        assert response.status_code in [400, 422]

    async def test_synthesize_special_characters(self, tts_client):
        """Test synthesis with special characters."""
        text = "Hello! This costs $100.50. Is it 2026?"
        
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": text}
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        data = response.json()
        assert "audio" in data

    async def test_synthesize_numbers(self, tts_client):
        """Test synthesis with numbers."""
        text = "The year is 2026 and the temperature is 72 degrees."
        
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": text}
        )
        
        assert response.status_code == 200

    async def test_synthesize_multiple_sentences(self, tts_client):
        """Test synthesis with multiple sentences."""
        text = "First sentence. Second sentence! Third sentence?"
        
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": text}
        )
        
        assert response.status_code == 200
        audio_data = response.content
        assert len(audio_data) > 2000

    async def test_performance_short_text(self, tts_client):
        """Test synthesis performance for short text."""
        import time
        
        text = "Quick test."
        start = time.time()
        
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": text}
        )
        
        elapsed = time.time() - start
        
        assert response.status_code == 200
        # Should be fast (< 5 seconds on CPU for short text)
        assert elapsed < 5.0
        print(f"\n⏱️  Short text synthesis time: {elapsed:.2f}s")

    async def test_performance_medium_text(self, tts_client, sample_text):
        """Test synthesis performance for medium text."""
        import time
        
        start = time.time()
        
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": sample_text}
        )
        
        elapsed = time.time() - start
        
        assert response.status_code == 200
        # Should complete reasonably fast on CPU
        assert elapsed < 10.0
        print(f"\n⏱️  Medium text synthesis time: {elapsed:.2f}s")

    @pytest.mark.slow
    async def test_concurrent_requests(self, tts_client):
        """Test handling concurrent synthesis requests."""
        import asyncio
        
        texts = [
            "First concurrent request.",
            "Second concurrent request.",
            "Third concurrent request.",
        ]
        
        # Send requests concurrently
        tasks = [
            tts_client.post("/api/tts/synthesize", json={"text": text})
            for text in texts
        ]
        
        responses = await asyncio.gather(*tasks)
        
        # All should succeed
        for response in responses:
            assert response.status_code == 200
            assert response.headers["content-type"] == "audio/wav"

    async def test_invalid_json(self, tts_client):
        """Test handling of invalid JSON."""
        response = await tts_client.post(
            "/api/tts/synthesize",
            content="not json"
        )
        
        assert response.status_code in [400, 422]

    async def test_missing_text_field(self, tts_client):
        """Test handling of missing text field."""
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"wrong_field": "value"}
        )
        
        assert response.status_code in [400, 422]

    async def test_very_long_text(self, tts_client):
        """Test synthesis with very long text."""
        # Create a very long text
        text = " ".join(["This is sentence number {}.".format(i) for i in range(50)])
        
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": text}
        )
        
        # Should either succeed or return appropriate error
        assert response.status_code in [200, 400, 413]
        
        if response.status_code == 200:
            audio_data = response.content
            assert len(audio_data) > 10000  # Should be substantial


@pytest.mark.asyncio
@pytest.mark.e2e
class TestTTSServiceRobustness:
    """TTS service robustness tests."""

    async def test_unicode_text(self, tts_client):
        """Test synthesis with Unicode characters."""
        text = "Hello 你好 Привет مرحبا"
        
        response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": text}
        )
        
        # Should handle gracefully (success or appropriate error)
        assert response.status_code in [200, 400]

    async def test_repeated_requests(self, tts_client, sample_text_short):
        """Test repeated requests for the same text."""
        for _ in range(5):
            response = await tts_client.post(
                "/api/tts/synthesize",
                json={"text": sample_text_short}
            )
            
            assert response.status_code == 200

    async def test_whitespace_handling(self, tts_client):
        """Test handling of various whitespace."""
        texts = [
            "Text with    multiple     spaces",
            "Text\nwith\nnewlines",
            "Text\twith\ttabs",
            "  Leading and trailing spaces  "
        ]
        
        for text in texts:
            response = await tts_client.post(
                "/api/tts/synthesize",
                json={"text": text}
            )
            
            # Should handle gracefully
            assert response.status_code in [200, 400]
