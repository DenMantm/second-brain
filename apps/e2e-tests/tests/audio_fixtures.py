"""Shared pytest fixtures for audio testing."""

import pytest
from pathlib import Path
from .test_helpers import save_test_audio


@pytest.fixture(scope="session")
def test_audio_dir(test_config) -> Path:
    """Create and return test audio directory."""
    audio_dir = test_config["test_data_dir"] / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    return audio_dir


@pytest.fixture(scope="session")
def test_audio_short(test_audio_dir) -> Path:
    """Generate short test audio (1 second)."""
    audio_path = test_audio_dir / "test_short.wav"
    if not audio_path.exists():
        save_test_audio(audio_path, audio_type="speech", duration=1.0)
    return audio_path


@pytest.fixture(scope="session")
def test_audio_medium(test_audio_dir) -> Path:
    """Generate medium test audio (5 seconds)."""
    audio_path = test_audio_dir / "test_medium.wav"
    if not audio_path.exists():
        save_test_audio(audio_path, audio_type="speech", duration=5.0)
    return audio_path


@pytest.fixture(scope="session")
def test_audio_long(test_audio_dir) -> Path:
    """Generate long test audio (30 seconds)."""
    audio_path = test_audio_dir / "test_long.wav"
    if not audio_path.exists():
        save_test_audio(audio_path, audio_type="speech", duration=30.0)
    return audio_path


@pytest.fixture
def sample_text() -> str:
    """Sample text for TTS testing."""
    return "Hello, this is a test of the text to speech system."


@pytest.fixture
def sample_text_short() -> str:
    """Short sample text."""
    return "Hello world."


@pytest.fixture
def sample_text_long() -> str:
    """Long sample text."""
    return (
        "The quick brown fox jumps over the lazy dog. "
        "This is a longer test sentence to verify that the text to speech "
        "system can handle multiple sentences and longer durations properly. "
        "Performance should remain consistent across different text lengths."
    )
