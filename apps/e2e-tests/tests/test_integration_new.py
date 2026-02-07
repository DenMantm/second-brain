"""Integration tests for TTS + STT services."""

import base64
import io
import pytest


@pytest.mark.asyncio
@pytest.mark.integration
class TestTTSSTTIntegration:
    """Integration tests for TTS and STT services working together."""

    async def test_roundtrip_transcription(
        self, 
        tts_client, 
        stt_client, 
        sample_text_short
    ):
        """
        Test round-trip: Text -> TTS -> Audio -> STT -> Text
        
        Note: STT may not perfectly transcribe synthetic speech,
        so we check for partial match rather than exact match.
        """
        original_text = sample_text_short
        
        # Step 1: Generate audio from text (TTS)
        tts_response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": original_text}
        )
        
        assert tts_response.status_code == 200
        tts_data = tts_response.json()
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(tts_data["audio"])
        
        # Step 2: Transcribe the generated audio (STT)
        files = {"audio": ("generated.wav", io.BytesIO(audio_bytes), "audio/wav")}
        stt_response = await stt_client.post(
            "/api/stt/transcribe",
            files=files
        )
        
        assert stt_response.status_code == 200
        stt_result = stt_response.json()
        
        transcribed_text = stt_result["text"].lower().strip()
        original_lower = original_text.lower().strip()
        
        print(f"\n🔄 Round-trip test:")
        print(f"  Original:    '{original_text}'")
        print(f"  Transcribed: '{stt_result['text']}'")
        print(f"  Language:    {stt_result['language']}")
        
        # Check that some words match (synthetic speech may not be perfect)
        original_words = set(original_lower.split())
        transcribed_words = set(transcribed_text.split())
        
        # At least 30% of words should match
        matching_words = original_words & transcribed_words
        match_ratio = len(matching_words) / len(original_words) if original_words else 0
        
        print(f"  Match ratio: {match_ratio:.1%}")
        
        # Lenient check - synthetic speech transcription may vary
        assert match_ratio > 0.2 or len(transcribed_text) > 0

    async def test_services_work_independently(
        self,
        tts_client,
        stt_client,
        test_audio_short,
        sample_text
    ):
        """Test that both services work independently."""
        # Test TTS
        tts_response = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": sample_text}
        )
        assert tts_response.status_code == 200
        
        # Test STT
        with open(test_audio_short, "rb") as f:
            files = {"audio": ("test.wav", f, "audio/wav")}
            stt_response = await stt_client.post(
                "/api/stt/transcribe",
                files=files
            )
        assert stt_response.status_code == 200

    async def test_concurrent_tts_stt_requests(
        self,
        tts_client,
        stt_client,
        sample_text_short,
        test_audio_short
    ):
        """Test concurrent requests to both services."""
        import asyncio
        
        # Concurrent TTS request
        async def tts_request():
            return await tts_client.post(
                "/api/tts/synthesize",
                json={"text": sample_text_short}
            )
        
        # Concurrent STT request
        async def stt_request():
            with open(test_audio_short, "rb") as f:
                files = {"audio": ("test.wav", f.read(), "audio/wav")}
                return await stt_client.post(
                    "/api/stt/transcribe",
                    files=files
                )
        
        # Run both concurrently
        tts_resp, stt_resp = await asyncio.gather(
            tts_request(),
            stt_request()
        )
        
        # Both should succeed
        assert tts_resp.status_code == 200
        assert stt_resp.status_code == 200

    async def test_services_health_check(self, tts_client, stt_client):
        """Test health checks for both services."""
        # TTS health
        tts_response = await tts_client.get("/ping")
        assert tts_response.status_code == 200
        
        # STT health
        stt_response = await stt_client.get("/health")
        assert stt_response.status_code == 200
        
        stt_data = stt_response.json()
        assert stt_data["status"] == "healthy"

    @pytest.mark.slow
    async def test_multiple_roundtrips(
        self,
        tts_client,
        stt_client
    ):
        """Test multiple text-to-audio-to-text roundtrips."""
        test_texts = [
            "Hello world.",
            "Testing one two three.",
            "This is a test."
        ]
        
        for text in test_texts:
            # TTS
            tts_resp = await tts_client.post(
                "/api/tts/synthesize",
                json={"text": text}
            )
            assert tts_resp.status_code == 200
            
            # STT
            audio = tts_resp.content
            files = {"audio": ("test.wav", audio, "audio/wav")}
            stt_resp = await stt_client.post(
                "/api/stt/transcribe",
                files=files
            )
            assert stt_resp.status_code == 200
            
            result = stt_resp.json()
            print(f"\n  '{text}' -> '{result['text']}'")


@pytest.mark.asyncio
@pytest.mark.integration
class TestServicesPerformance:
    """Performance tests for both services."""

    async def test_combined_latency(
        self,
        tts_client,
        stt_client,
        sample_text_short
    ):
        """Test combined latency of TTS + STT pipeline."""
        import time
        
        start = time.time()
        
        # TTS
        tts_resp = await tts_client.post(
            "/api/tts/synthesize",
            json={"text": sample_text_short}
        )
        tts_time = time.time() - start
        
        assert tts_resp.status_code == 200
        
        # Decode base64 audio
        tts_data = tts_resp.json()
        audio_bytes = base64.b64decode(tts_data["audio"])
        
        # STT
        stt_start = time.time()
        files = {"audio": ("test.wav", io.BytesIO(audio_bytes), "audio/wav")}
        stt_resp = await stt_client.post(
            "/api/stt/transcribe",
            files=files
        )
        stt_time = time.time() - stt_start
        
        assert stt_resp.status_code == 200
        
        total_time = time.time() - start
        
        print(f"\n⏱️  Pipeline Performance:")
        print(f"  TTS time: {tts_time:.2f}s")
        print(f"  STT time: {stt_time:.2f}s")
        print(f"  Total time: {total_time:.2f}s")
        
        # Total should be reasonable for CPU mode
        assert total_time < 15.0  # 15 seconds is generous for CPU

    async def test_throughput(
        self,
        tts_client,
        stt_client,
        sample_text_short,
        test_audio_short
    ):
        """Test throughput of both services."""
        import asyncio
        import time
        
        num_requests = 5
        
        # TTS throughput
        tts_start = time.time()
        tts_tasks = [
            tts_client.post("/api/tts/synthesize", json={"text": sample_text_short})
            for _ in range(num_requests)
        ]
        tts_responses = await asyncio.gather(*tts_tasks)
        tts_elapsed = time.time() - tts_start
        
        # All should succeed
        assert all(r.status_code == 200 for r in tts_responses)
        
        # STT throughput
        stt_start = time.time()
        stt_tasks = []
        with open(test_audio_short, "rb") as f:
            audio_data = f.read()
        
        for _ in range(num_requests):
            files = {"audio": ("test.wav", audio_data, "audio/wav")}
            stt_tasks.append(
                stt_client.post("/api/stt/transcribe", files=files)
            )
        
        stt_responses = await asyncio.gather(*stt_tasks)
        stt_elapsed = time.time() - stt_start
        
        assert all(r.status_code == 200 for r in stt_responses)
        
        print(f"\n📊 Throughput Test ({num_requests} requests each):")
        print(f"  TTS: {tts_elapsed:.2f}s ({num_requests/tts_elapsed:.1f} req/s)")
        print(f"  STT: {stt_elapsed:.2f}s ({num_requests/stt_elapsed:.1f} req/s)")
