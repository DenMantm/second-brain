# TTS HTTP Service

A standalone HTTP service for Text-to-Speech (TTS) generation, supporting multiple TTS engines including Piper and Qwen3 (Kokoro is planned but not implemented yet).

## Features

- **Multiple TTS Engines**: Choose between Piper (lightweight) or Qwen3 (high-quality with voice cloning). Kokoro support is planned but not implemented yet.
- **GPU Acceleration**: Automatic CUDA support for faster inference
- **RESTful API**: Simple HTTP endpoints for easy integration
- **Streaming Support**: Low-latency audio generation
- **Voice Selection**: Multiple voices available per engine

## What Is Qwen3-TTS

Qwen3-TTS is a multilingual TTS model family from Qwen (Alibaba Cloud), released in January 2026. It targets high-quality, low-latency speech generation with support for voice design, voice cloning from short reference audio, and instruction-driven control of tone, emotion, and prosody.

Key capabilities:
- Voice cloning from short reference audio
- Voice design from natural language descriptions
- Instruction-based control of speaking style
- Multilingual support across 10 major languages
- Streaming-friendly architecture with low first-audio latency

Model choices (overview):
- 1.7B models for maximum quality and control
- 0.6B models for faster inference and lower VRAM use (default in this service)
- VoiceDesign models for creating new voices from descriptions
- CustomVoice models with preset voices and style control
- Base models optimized for voice cloning and fine-tuning

## Quick Start

### 1. Installation

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install specific TTS engine (choose one or more)

# For Kokoro (planned, not implemented yet in this service):
# pip install git+https://github.com/remsky/Kokoro-FastAPI.git

# For Piper (lightweight):
pip install piper-tts

# For Qwen3 (already in requirements.txt via transformers)
```

### 2. Start the Service

```bash
# Kokoro is planned but not implemented yet in this service.

# Using Piper
python tts_service.py --model piper --port 8083

# Using Qwen3
python tts_service.py --model qwen3 --port 8083

# Use CPU instead of GPU
# (configure MODEL_TYPE and run the service as normal)
```

Or use the local helper script:

```powershell
./start.ps1
```

### 3. Test the Service

```bash
# Generate speech
python tts_client.py "Hello, this is a test" --output test.wav

# List available voices
python tts_client.py --list-voices

# Use specific voice and speed
python tts_client.py "This is faster speech" --voice af_bella --speed 1.2
```

## API Reference

### POST /api/tts

Generate TTS audio from text.

**Request:**
```json
{
  "text": "Hello, world!",
  "voice": "default",
  "speed": 1.0,
  "streaming": false
}
```

**Response:**
- Content-Type: `audio/wav`
- Binary WAV audio file

**cURL Example:**
```bash
curl -X POST http://localhost:8083/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world"}' \
  --output speech.wav
```

### GET /api/voices

List available voices for the current TTS engine.

**Response:**
```json
{
  "voices": ["af", "af_bella", "af_sarah", "am_adam", ...]
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model": "KokoroTTS",
  "device": "cuda"
}
```

## Available Voices

### Kokoro TTS
- Not implemented yet in this service (placeholder only)

### Piper TTS
- `en_US-lessac-medium` - US English (default)
- `en_US-amy-medium` - US English (Amy)
- `en_GB-alan-medium` - British English (Alan)

### Qwen3 TTS
- `default` - Standard voice
- `custom` - Voice cloning (requires setup)

## Integration Examples

### Python

```python
import requests

# Generate speech
response = requests.post(
    "http://localhost:8083/api/tts",
    json={
        "text": "Hello from Python!",
        "voice": "af_bella",
        "speed": 1.0
    }
)

# Save to file
with open("output.wav", "wb") as f:
    f.write(response.content)
```

### JavaScript/TypeScript

```typescript
async function generateSpeech(text: string): Promise<Blob> {
  const response = await fetch('http://localhost:8083/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text,
      voice: 'default',
      speed: 1.0
    })
  });
  
  return await response.blob();
}

// Usage
const audioBlob = await generateSpeech("Hello from JavaScript!");
const audioUrl = URL.createObjectURL(audioBlob);
const audio = new Audio(audioUrl);
audio.play();
```

### cURL

```bash
# Generate and save speech
curl -X POST http://localhost:8083/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Testing TTS service", "voice": "af_bella"}' \
  --output speech.wav

# Play immediately with ffplay
curl -X POST http://localhost:8083/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello!"}' \
  --output - | ffplay -nodisp -autoexit -
```

## Performance Comparison

Based on RTX 5060 Ti 16GB (similar to RTX 4060 Ti):

| Engine | First Token | Full Sentence | Quality | VRAM Usage |
|--------|-------------|---------------|---------|------------|
| Kokoro (planned) | ~100-200ms | ~400-700ms | ★★★★☆ | ~1-2 GB |
| Piper | ~50-100ms | ~300-500ms | ★★★☆☆ | ~500 MB |
| Qwen3 1.7B | ~200-400ms | ~600-900ms | ★★★★★ | ~4-6 GB |

## Troubleshooting

### Windows Notes (SoX and hf_xet)

- Qwen3 may log a warning if `sox` is not installed. This is optional unless you rely on SoX-based audio utilities.
- Hugging Face may warn about `hf_xet` missing; it only affects download performance and is safe to ignore.

### CUDA Out of Memory

If you get CUDA OOM errors:

```bash
# Use CPU instead
# (configure MODEL_TYPE and run the service as normal)

# Or use a lighter model
python tts_service.py --model piper
```

### Import Errors

Make sure you've installed the specific TTS engine:

```bash
# For Kokoro
pip install git+https://github.com/remsky/Kokoro-FastAPI.git

# For Piper
pip install piper-tts
```

### Slow Performance

1. Ensure you're using GPU: Check `--device cuda`
2. Try a lighter model: `--model piper`
3. Check GPU utilization: `nvidia-smi`

## Configuration

### Environment Variables

Create a `.env` file:

```bash
TTS_MODEL=piper
TTS_PORT=8083
TTS_HOST=0.0.0.0
TTS_DEVICE=cuda
LOG_LEVEL=info
```

### Production Deployment

For production use, run with Gunicorn:

```bash
pip install gunicorn

gunicorn tts_service:app \
  --workers 2 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8083
```

## From Fulloch Project

If you want to use the complete Fulloch setup mentioned in the Reddit post:

```bash
# Clone Fulloch
git clone https://github.com/liampetti/fulloch
cd fulloch

# Run the launch script (Linux)
./launch.sh

# Or manually start components
python main.py --model qwen3 --tts kokoro
```

## License

MIT License - feel free to use in your projects!

## Credits

- Fulloch project: https://github.com/liampetti/fulloch
- Kokoro TTS: https://github.com/remsky/Kokoro-FastAPI
- Piper TTS: https://github.com/rhasspy/piper
- Qwen3: https://huggingface.co/Qwen

## Related Documentation

- [System Design](./SYSTEM_DESIGN.md)
- [Local PC Server Setup](./LOCAL_PC_SERVER.md)
- [Chunked Playback Implementation](./CHUNKED_PLAYBACK.md)
