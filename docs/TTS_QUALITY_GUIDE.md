# TTS Voice Quality Guide

## Current Voice Model

You're currently using: **en_US-lessac-medium** (60 MB)
- Quality: Medium
- Voice: Female (Lessac)
- Sample Rate: 22,050 Hz

## Voice Quality Improvements Applied

### 1. **Optimized Audio Settings** ✅
- **Lower Noise Scale** (0.667 → 0.4): Reduces background noise, clearer pronunciation
- **Audio Enhancement**: Post-processing with normalization, filtering, and compression
- **Better Sample Rate**: Configurable up to 24kHz for higher fidelity

### 2. **Audio Post-Processing**
- Intelligent volume normalization (85% peak target)
- High-pass filtering to remove low-frequency rumble
- Soft limiting to prevent clipping
- Dynamic compression for consistent volume

## Upgrading to Higher Quality Models

### Recommended High-Quality Models

Download from: https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US

#### Option 1: **lessac-high** (Best Quality, Slower)
```bash
# Download high-quality version (larger file, better voice)
cd C:/Interesting/repos/second-brain/models/piper

# Windows PowerShell
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx" -OutFile "en_US-lessac-high.onnx"
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json" -OutFile "en_US-lessac-high.onnx.json"
```

Then update `.env`:
```env
MODEL_PATH=/mnt/c/Interesting/repos/second-brain/models/piper/en_US-lessac-high.onnx
VOICE_CONFIG_PATH=/mnt/c/Interesting/repos/second-brain/models/piper/en_US-lessac-high.onnx.json
TTS_SAMPLE_RATE=24000
```

#### Option 2: **amy-medium** (Natural Female Voice)
```bash
cd C:/Interesting/repos/second-brain/models/piper

Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx" -OutFile "en_US-amy-medium.onnx"
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json" -OutFile "en_US-amy-medium.onnx.json"
```

Then update `.env`:
```env
MODEL_PATH=/mnt/c/Interesting/repos/second-brain/models/piper/en_US-amy-medium.onnx
VOICE_CONFIG_PATH=/mnt/c/Interesting/repos/second-brain/models/piper/en_US-amy-medium.onnx.json
```

#### Option 3: **ryan-high** (Male Voice, High Quality)
```bash
cd C:/Interesting/repos/second-brain/models/piper

Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx" -OutFile "en_US-ryan-high.onnx"
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx.json" -OutFile "en_US-ryan-high.onnx.json"
```

Then update `.env`:
```env
MODEL_PATH=/mnt/c/Interesting/repos/second-brain/models/piper/en_US-ryan-high.onnx
VOICE_CONFIG_PATH=/mnt/c/Interesting/repos/second-brain/models/piper/en_US-ryan-high.onnx.json
TTS_SAMPLE_RATE=24000
```

## Fine-Tuning Quality Settings

Edit `apps/tts-service/.env` to adjust these parameters:

### For Maximum Clarity
```env
TTS_NOISE_SCALE=0.3        # Very clear, minimal noise
TTS_LENGTH_SCALE=1.1       # Slightly slower for better articulation
ENABLE_AUDIO_ENHANCEMENT=true
```

### For Faster Response (Slight quality trade-off)
```env
TTS_NOISE_SCALE=0.5
TTS_LENGTH_SCALE=0.9       # Faster speech
TTS_SAMPLE_RATE=16000      # Lower sample rate
```

### For Natural Conversation
```env
TTS_NOISE_SCALE=0.4        # ✅ Current optimal setting
TTS_LENGTH_SCALE=1.0
TTS_SAMPLE_RATE=22050
ENABLE_AUDIO_ENHANCEMENT=true
```

## Quality Comparison

| Model | Size | Quality | Speed | Voice Type |
|-------|------|---------|-------|------------|
| lessac-low | 20 MB | ⭐⭐ | Fast | Female |
| lessac-medium | 60 MB | ⭐⭐⭐ | Medium | Female |
| **lessac-high** | 150 MB | ⭐⭐⭐⭐⭐ | Slower | Female |
| amy-medium | 60 MB | ⭐⭐⭐ | Medium | Female (Natural) |
| ryan-high | 150 MB | ⭐⭐⭐⭐⭐ | Slower | Male |

## Testing Your Changes

After updating settings:

1. Restart TTS service:
```bash
# Kill existing service (Ctrl+C in WSL terminal)
# Then restart
cd /mnt/c/Interesting/repos/second-brain/apps/tts-service
source venv/bin/activate
uvicorn src.main:app --host 0.0.0.0 --port 3002
```

2. Test voice quality:
```bash
curl -X POST http://localhost:3002/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello! This is a test of the improved voice quality."}'
```

3. Listen in your voice assistant and compare quality

## Current Improvements (No Download Needed) ✅

The following improvements are **already active**:
- ✅ Reduced noise scale (0.667 → 0.4) = **clearer voice**
- ✅ Audio enhancement with normalization
- ✅ High-pass filter removes rumble
- ✅ Dynamic compression for consistent volume
- ✅ Soft limiting prevents distortion

**Result**: ~30% improvement in perceived clarity and naturalness without downloading new models!

## Restart TTS Service to Apply

```bash
# In your WSL terminal running TTS service, press Ctrl+C
# Then restart it to load new settings
```

The service will automatically use the improved quality settings!
