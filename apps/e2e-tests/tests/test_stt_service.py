"""End-to-end tests for STT service (placeholder)."""

import pytest


@pytest.mark.asyncio
@pytest.mark.e2e
class TestSTTService:
    """STT service E2E tests."""

    async def test_service_health(self, stt_client):
        """Test STT service health endpoint."""
        response = await stt_client.get("/api/stt/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert "version" in data

    @pytest.mark.skip(reason="STT service not yet implemented")
    async def test_transcribe_audio(self, stt_client, test_audio_file):
        """Test audio transcription."""
        with open(test_audio_file, "rb") as f:
            files = {"audio": f}
            response = await stt_client.post(
                "/api/stt/transcribe",
                files=files
            )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "text" in data
        assert "confidence" in data
        assert "language" in data
