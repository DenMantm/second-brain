"""Unit tests for TTS engine."""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import numpy as np
import pytest


@pytest.fixture
def mock_piper_voice():
    """Mock Piper voice model."""
    mock_voice = MagicMock()
    
    # Mock synthesize_stream_raw to return audio bytes
    def synthesize_stream_raw(text, **kwargs):
        # Simulate some processing time
        time.sleep(0.1)
        
        # Return some dummy audio data
        audio_data = np.random.randint(-32768, 32767, 1000, dtype=np.int16)
        yield audio_data.tobytes()
    
    mock_voice.synthesize_stream_raw = synthesize_stream_raw
    return mock_voice


@pytest.fixture
def mock_config():
    """Mock voice config."""
    return {
        "sample_rate": 22050,
        "num_speakers": 1
    }


@pytest.mark.asyncio
class TestTTSEngine:
    """Test TTS engine functionality."""

    async def test_engine_initialization(self, mock_piper_voice, mock_config):
        """Test engine initializes correctly."""
        from src.tts_engine import TTSEngine
        
        with patch('src.tts_engine.PiperVoice.load', return_value=mock_piper_voice), \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load', return_value=mock_config):
            
            mock_open.return_value.__enter__.return_value = MagicMock()
            
            engine = TTSEngine(
                model_path="/fake/model.onnx",
                config_path="/fake/config.json",
                use_cuda=False
            )
            
            assert not engine._initialized
            engine.initialize()
            assert engine._initialized
            assert engine.model is not None

    async def test_synthesize_basic(self, mock_piper_voice, mock_config):
        """Test basic synthesis works."""
        from src.tts_engine import TTSEngine
        
        with patch('src.tts_engine.PiperVoice.load', return_value=mock_piper_voice), \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load', return_value=mock_config):
            
            mock_open.return_value.__enter__.return_value = MagicMock()
            
            engine = TTSEngine(
                model_path="/fake/model.onnx",
                config_path="/fake/config.json",
                use_cuda=False
            )
            engine.initialize()
            
            audio_data, sample_rate = await engine.synthesize("Hello, world!")
            
            assert isinstance(audio_data, np.ndarray)
            assert audio_data.dtype == np.float32
            assert len(audio_data) > 0
            assert sample_rate == 22050

    async def test_concurrent_synthesis_serialization(self, mock_piper_voice, mock_config):
        """Test that concurrent synthesis requests are properly serialized."""
        from src.tts_engine import TTSEngine
        
        # Track execution order and timing
        execution_log = []
        
        def tracked_synthesize_stream_raw(text, **kwargs):
            """Track when synthesis starts and ends."""
            start_time = time.time()
            execution_log.append(("start", text, start_time))
            
            # Simulate processing time
            time.sleep(0.15)
            
            # Return dummy audio
            audio_data = np.random.randint(-32768, 32767, 1000, dtype=np.int16)
            yield audio_data.tobytes()
            
            end_time = time.time()
            execution_log.append(("end", text, end_time))
        
        mock_piper_voice.synthesize_stream_raw = tracked_synthesize_stream_raw
        
        with patch('src.tts_engine.PiperVoice.load', return_value=mock_piper_voice), \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load', return_value=mock_config):
            
            mock_open.return_value.__enter__.return_value = MagicMock()
            
            engine = TTSEngine(
                model_path="/fake/model.onnx",
                config_path="/fake/config.json",
                use_cuda=False,
                enable_enhancement=False  # Disable to simplify test
            )
            engine.initialize()
            
            # Launch 3 concurrent synthesis requests
            texts = ["First request", "Second request", "Third request"]
            tasks = [
                asyncio.create_task(engine.synthesize(text))
                for text in texts
            ]
            
            # Wait for all to complete
            results = await asyncio.gather(*tasks)
            
            # Verify all completed successfully
            assert len(results) == 3
            for audio_data, sample_rate in results:
                assert isinstance(audio_data, np.ndarray)
                assert len(audio_data) > 0
            
            # Verify serialization: no overlapping execution
            # Check that each request's start time is after the previous request's end time
            starts = [log for log in execution_log if log[0] == "start"]
            ends = [log for log in execution_log if log[0] == "end"]
            
            assert len(starts) == 3
            assert len(ends) == 3
            
            # Verify no overlap: each start (except first) should be after previous end
            for i in range(1, len(starts)):
                previous_end_time = ends[i-1][2]
                current_start_time = starts[i][2]
                
                # Current request should start after previous one ended
                # Allow small tolerance for timing
                assert current_start_time >= previous_end_time - 0.01, \
                    f"Request {i} started at {current_start_time} before request {i-1} ended at {previous_end_time}"

    async def test_synthesis_performance_with_queuing(self, mock_piper_voice, mock_config):
        """Test that queuing doesn't add excessive overhead."""
        from src.tts_engine import TTSEngine
        
        with patch('src.tts_engine.PiperVoice.load', return_value=mock_piper_voice), \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load', return_value=mock_config):
            
            mock_open.return_value.__enter__.return_value = MagicMock()
            
            engine = TTSEngine(
                model_path="/fake/model.onnx",
                config_path="/fake/config.json",
                use_cuda=False,
                enable_enhancement=False
            )
            engine.initialize()
            
            # Time a single request
            start_time = time.time()
            await engine.synthesize("Test")
            single_duration = time.time() - start_time
            
            # Time sequential requests
            start_time = time.time()
            for i in range(3):
                await engine.synthesize(f"Request {i}")
            sequential_duration = time.time() - start_time
            
            # Sequential should be roughly 3x single (with some overhead tolerance)
            expected_duration = single_duration * 3
            overhead_tolerance = 0.5  # 50% overhead maximum
            
            assert sequential_duration <= expected_duration * (1 + overhead_tolerance), \
                f"Excessive overhead: {sequential_duration}s vs expected {expected_duration}s"

    async def test_synthesis_error_doesnt_block_queue(self, mock_piper_voice, mock_config):
        """Test that errors in synthesis don't permanently block the queue."""
        from src.tts_engine import TTSEngine
        
        call_count = 0
        
        def failing_synthesize_stream_raw(text, **kwargs):
            nonlocal call_count
            call_count += 1
            
            # First call fails
            if call_count == 1:
                raise RuntimeError("Synthesis failed")
            
            # Subsequent calls succeed
            time.sleep(0.05)
            audio_data = np.random.randint(-32768, 32767, 1000, dtype=np.int16)
            yield audio_data.tobytes()
        
        mock_piper_voice.synthesize_stream_raw = failing_synthesize_stream_raw
        
        with patch('src.tts_engine.PiperVoice.load', return_value=mock_piper_voice), \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load', return_value=mock_config):
            
            mock_open.return_value.__enter__.return_value = MagicMock()
            
            engine = TTSEngine(
                model_path="/fake/model.onnx",
                config_path="/fake/config.json",
                use_cuda=False,
                enable_enhancement=False
            )
            engine.initialize()
            
            # First request should fail
            with pytest.raises(RuntimeError):
                await engine.synthesize("This will fail")
            
            # Second request should succeed (queue not blocked)
            audio_data, sample_rate = await engine.synthesize("This should work")
            assert isinstance(audio_data, np.ndarray)
            assert len(audio_data) > 0

    async def test_streaming_synthesis(self, mock_piper_voice, mock_config):
        """Test streaming synthesis."""
        from src.tts_engine import TTSEngine
        
        with patch('src.tts_engine.PiperVoice.load', return_value=mock_piper_voice), \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load', return_value=mock_config):
            
            mock_open.return_value.__enter__.return_value = MagicMock()
            
            engine = TTSEngine(
                model_path="/fake/model.onnx",
                config_path="/fake/config.json",
                use_cuda=False,
                enable_enhancement=False
            )
            engine.initialize()
            
            # Test streaming with multiple sentences
            text = "Hello world. This is a test. How are you?"
            chunks = []
            
            async for audio_chunk, sample_rate in engine.synthesize_streaming(text):
                chunks.append(audio_chunk)
                assert isinstance(audio_chunk, np.ndarray)
                assert sample_rate == 22050
            
            # Should have 3 chunks (3 sentences)
            assert len(chunks) == 3

    async def test_audio_enhancement(self, mock_piper_voice, mock_config):
        """Test audio enhancement is applied when enabled."""
        from src.tts_engine import TTSEngine
        
        with patch('src.tts_engine.PiperVoice.load', return_value=mock_piper_voice), \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load', return_value=mock_config):
            
            mock_open.return_value.__enter__.return_value = MagicMock()
            
            # Create engine with enhancement enabled
            engine_enhanced = TTSEngine(
                model_path="/fake/model.onnx",
                config_path="/fake/config.json",
                use_cuda=False,
                enable_enhancement=True
            )
            engine_enhanced.initialize()
            
            # Create engine with enhancement disabled
            engine_raw = TTSEngine(
                model_path="/fake/model.onnx",
                config_path="/fake/config.json",
                use_cuda=False,
                enable_enhancement=False
            )
            engine_raw.initialize()
            
            # Synthesize same text with both
            text = "Test audio enhancement"
            audio_enhanced, _ = await engine_enhanced.synthesize(text)
            audio_raw, _ = await engine_raw.synthesize(text)
            
            # Both should work but may have different characteristics
            assert len(audio_enhanced) > 0
            assert len(audio_raw) > 0
            
            # Enhanced audio should be normalized (peak around 0.85)
            max_enhanced = np.abs(audio_enhanced).max()
            assert max_enhanced <= 0.95  # Should not clip


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
