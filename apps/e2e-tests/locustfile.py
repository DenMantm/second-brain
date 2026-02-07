"""Performance testing with Locust."""

from locust import HttpUser, TaskSet, task, between


class TTSTaskSet(TaskSet):
    """TTS service tasks."""

    @task(3)
    def synthesize_short(self):
        """Synthesize short text."""
        self.client.post(
            "/api/tts/synthesize",
            json={
                "text": "Hello, this is a test.",
                "format": "wav"
            }
        )

    @task(1)
    def synthesize_long(self):
        """Synthesize longer text."""
        self.client.post(
            "/api/tts/synthesize",
            json={
                "text": "This is a longer text for testing performance under load. " * 5,
                "format": "wav"
            }
        )

    @task(2)
    def get_voices(self):
        """Get available voices."""
        self.client.get("/api/tts/voices")

    @task(1)
    def health_check(self):
        """Health check."""
        self.client.get("/api/tts/health")


class TTSUser(HttpUser):
    """TTS service user simulation."""
    tasks = [TTSTaskSet]
    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks
    host = "http://localhost:3002"


class STTTaskSet(TaskSet):
    """STT service tasks (placeholder)."""

    @task
    def health_check(self):
        """Health check."""
        self.client.get("/api/stt/health")


class STTUser(HttpUser):
    """STT service user simulation."""
    tasks = [STTTaskSet]
    wait_time = between(2, 5)
    host = "http://localhost:3001"
