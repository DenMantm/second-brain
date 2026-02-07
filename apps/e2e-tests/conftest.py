"""pytest configuration and shared fixtures."""

import asyncio
import os
from pathlib import Path
from typing import AsyncGenerator, Generator

import httpx
import pytest
from dotenv import load_dotenv

# Load test environment
load_dotenv()

# Configure pytest-asyncio
pytest_plugins = ('pytest_asyncio',)

# Import test fixtures
from tests.audio_fixtures import *  # noqa


# Test Configuration
@pytest.fixture(scope="session")
def test_config():
    """Test configuration."""
    return {
        "tts_url": os.getenv("TTS_SERVICE_URL", "http://localhost:3002"),
        "stt_url": os.getenv("STT_SERVICE_URL", "http://localhost:3003"),
        "api_url": os.getenv("API_SERVICE_URL", "http://localhost:3000"),
        "web_url": os.getenv("WEB_UI_URL", "http://localhost:5173"),
        "timeout": int(os.getenv("TEST_TIMEOUT", "30")),
        "retry_attempts": int(os.getenv("RETRY_ATTEMPTS", "3")),
        "test_data_dir": Path(os.getenv("TEST_DATA_DIR", "./test_data")),
    }


# Async Event Loop - removed as pytest-asyncio handles it


# HTTP Clients
@pytest.fixture
async def tts_client(test_config) -> AsyncGenerator[httpx.AsyncClient, None]:
    """HTTP client for TTS service."""
    async with httpx.AsyncClient(
        base_url=test_config["tts_url"],
        timeout=test_config["timeout"]
    ) as client:
        yield client


@pytest.fixture
async def stt_client(test_config) -> AsyncGenerator[httpx.AsyncClient, None]:
    """HTTP client for STT service."""
    async with httpx.AsyncClient(
        base_url=test_config["stt_url"],
        timeout=test_config["timeout"]
    ) as client:
        yield client


@pytest.fixture
async def api_client(test_config) -> AsyncGenerator[httpx.AsyncClient, None]:
    """HTTP client for API service."""
    async with httpx.AsyncClient(
        base_url=test_config["api_url"],
        timeout=test_config["timeout"]
    ) as client:
        yield client


# Test Data Fixtures
@pytest.fixture
def sample_text():
    """Sample text for TTS testing."""
    return "Hello, this is a test of the text to speech service."


@pytest.fixture
def sample_long_text():
    """Long text for TTS testing."""
    return " ".join([
        "This is a longer text sample for testing streaming capabilities.",
        "It contains multiple sentences to ensure proper handling of text chunking.",
        "The synthesis engine should process this smoothly and efficiently."
    ])


@pytest.fixture
def test_audio_file(test_config):
    """Path to test audio file for STT testing."""
    audio_dir = test_config["test_data_dir"] / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    return audio_dir / "test_audio.wav"


# Service Health Checks
@pytest.fixture(autouse=True)
async def check_services_health(request, test_config):
    """Check if services are running before tests."""
    # Skip health check for unit tests
    if "unit" in request.keywords:
        return
    
    # Determine which services to check based on test module
    services = {}
    test_file = str(request.fspath)
    
    if "test_tts" in test_file or "test_integration" in test_file:
        services["TTS"] = test_config["tts_url"]
    
    if "test_stt" in test_file or "test_integration" in test_file:
        services["STT"] = test_config["stt_url"]
    
    async with httpx.AsyncClient(timeout=5) as client:
        for service_name, url in services.items():
            try:
                response = await client.get(f"{url}/ping")
                if response.status_code != 200:
                    pytest.skip(f"{service_name} service not healthy")
            except Exception as e:
                pytest.skip(f"{service_name} service not available at {url}: {e}")


# Pytest Hooks
def pytest_configure(config):
    """Configure pytest."""
    config.addinivalue_line(
        "markers", "unit: mark test as unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "e2e: mark test as end-to-end test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )
    config.addinivalue_line(
        "markers", "websocket: mark test as websocket test"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection."""
    for item in items:
        # Auto-mark tests based on path
        if "e2e" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)
        if "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        if "websocket" in item.name.lower():
            item.add_marker(pytest.mark.websocket)
