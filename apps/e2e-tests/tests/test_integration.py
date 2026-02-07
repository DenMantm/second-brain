"""Integration tests across multiple services."""

import pytest


@pytest.mark.asyncio
@pytest.mark.integration
class TestVoiceLoop:
    """Test complete voice interaction loop."""

    @pytest.mark.skip(reason="Requires both STT and TTS services")
    async def test_text_to_speech_to_text_loop(
        self, 
        tts_client, 
        stt_client,
        sample_text
    ):
        """Test TTS -> STT round-trip."""
        # 1. Synthesize text to audio
        tts_response = await tts_client.post(
            "/api/tts/synthesize/binary",
            json={"text": sample_text, "format": "wav"}
        )
        
        assert tts_response.status_code == 200
        audio_data = tts_response.content
        
        # 2. Transcribe audio back to text
        files = {"audio": ("test.wav", audio_data, "audio/wav")}
        stt_response = await stt_client.post(
            "/api/stt/transcribe",
            files=files
        )
        
        assert stt_response.status_code == 200
        transcription = stt_response.json()["text"]
        
        # 3. Verify text similarity (won't be exact)
        assert len(transcription) > 0
        # Could add fuzzy matching here
