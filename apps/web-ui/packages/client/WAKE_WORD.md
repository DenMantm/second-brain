# OpenWakeWord Integration

## Overview

Second Brain now uses **OpenWakeWord** for wake word detection instead of TensorFlow.js Speech Commands. This provides:

- ✅ **Better accuracy** - Purpose-built for wake word detection
- ✅ **Built-in VAD** - Voice Activity Detection reduces false positives
- ✅ **No false positives** - Cooldown prevents multiple detections
- ✅ **100% browser-based** - No API keys or external services required
- ✅ **Multiple wake words** - 6 pre-trained models available

## Available Wake Words

### Pre-trained Models

1. **hey_jarvis** - "Hey Jarvis" (default wake word)
2. **alexa** - "Alexa"
3. **hey_mycroft** - "Hey Mycroft"
4. **hey_rhasspy** - "Hey Rhasspy"
5. **timer** - "Set a timer", "Timer" (also used as temporary stop word)
6. **weather** - "What's the weather"

## Configuration

### Wake Word (Default: "hey_jarvis")

The wake word is configured in `WakeWordManager`:

```typescript
const manager = new WakeWordManager('hey_jarvis', 0.5);
```

- **Keyword**: Any of the 6 pre-trained models above
- **Threshold**: Detection confidence (0-1), default 0.5
  - Lower = more sensitive (more false positives)
  - Higher = less sensitive (might miss activations)

### Stop Word (Default: "timer")

The stop word is configured in `StopWordManager`:

```typescript
const manager = new StopWordManager('timer', 0.6);
```

**⚠️ Note**: OpenWakeWord doesn't have a dedicated "stop" model. Currently using "timer" as a temporary stop word. To use "stop", you would need to:

1. Train a custom OpenWakeWord model for "stop" (see Training section below)
2. Use the [OpenWakeWord Colab notebook](https://colab.research.google.com/drive/1q1oe2zOyZp7UsB3jJiQ1IFn8z5YfjwEb)
3. Place the trained `.onnx` model in `public/openwakeword/models/`

## Technical Details

### Architecture

```
┌─────────────────────────────────────┐
│  WakeWordManager                     │
│  - Activates voice assistant         │
│  - Uses OpenWakeWordDetection        │
│  - Keyword: "hey_jarvis" (default)   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  OpenWakeWordDetection Service      │
│  - Wraps WakeWordEngine              │
│  - Event-driven API                  │
│  - Built-in VAD (Silero)             │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  WakeWordEngine (openwakeword-wasm)  │
│  - ONNX Runtime Web                  │
│  - 16kHz audio, 80ms frames          │
│  - Cooldown: 2000ms                  │
└─────────────────────────────────────┘
```

### Models Loaded

All models are hosted in `public/openwakeword/models/`:

- `melspectrogram.onnx` - Audio preprocessing
- `embedding_model.onnx` - Speech embeddings (Google's pre-trained model)
- `silero_vad.onnx` - Voice Activity Detection
- `<keyword>_v0.1.onnx` - Keyword-specific classifier (e.g., `hey_jarvis_v0.1.onnx`)

### Voice Activity Detection (VAD)

OpenWakeWord includes Silero VAD which:
- Detects when speech is present vs silence/noise
- Reduces false activations from background noise
- 12-frame hangover keeps detection window open long enough
- Emits `speech-start` and `speech-end` events

### Event System

```typescript
engine.on('ready', () => { /* Models loaded */ });
engine.on('speech-start', () => { /* Speech detected */ });
engine.on('speech-end', () => { /* Silence detected */ });
engine.on('detect', ({ keyword, score }) => { /* Wake word detected! */ });
engine.on('error', (error) => { /* Error occurred */ });
```

## Training Custom Models

To train your own wake word (like "stop"):

1. **Generate Training Data**
   - Use [Google Colab notebook](https://colab.research.google.com/drive/1q1oe2zOyZp7UsB3jJiQ1IFn8z5YfjwEb)
   - Generate 2000+ synthetic examples using TTS
   - Or record real examples

2. **Train Model**
   - Upload training data to Colab
   - Run training (takes <1 hour)
   - Download trained `.onnx` model

3. **Deploy Model**
   - Copy `<your_keyword>_v0.1.onnx` to `public/openwakeword/models/`
   - Update keyword in manager:
     ```typescript
     const manager = new StopWordManager('your_keyword', 0.6);
     ```

4. **Rebuild Container**
   ```bash
   docker-compose up -d --build client
   ```

## Comparison: OpenWakeWord vs TensorFlow.js

| Feature | OpenWakeWord | TensorFlow.js Speech Commands |
|---------|-------------|-------------------------------|
| **Purpose** | Wake word detection | General speech recognition |
| **VAD** | ✅ Built-in (Silero) | ❌ No VAD |
| **False Positives** | ✅ Low (cooldown + VAD) | ⚠️ High (no noise filtering) |
| **Accuracy** | ✅ High (purpose-built) | ⚠️ Medium (repurposed) |
| **Vocabulary** | 6 wake words | 18 general words |
| **Custom Training** | ✅ Easy (Colab notebook) | ❌ Difficult |
| **Browser Support** | ✅ ONNX Runtime Web | ✅ TensorFlow.js |
| **Performance** | ✅ Fast (ONNX optimized) | ✅ Fast (WebGL) |

## Troubleshooting

### "Wake word not detecting"

1. **Check threshold** - Lower it from 0.5 to 0.3
2. **Speak clearly** - Enunciate the wake word
3. **Check browser console** - Look for VAD events (`speech-start`/`speech-end`)
4. **Verify models loaded** - Should see "✅ OpenWakeWord models loaded" in console

### "Too many false positives"

1. **Raise threshold** - Increase from 0.5 to 0.7
2. **Check cooldown** - Default 2000ms should prevent rapid re-triggers
3. **VAD should help** - Built-in VAD filters non-speech noise

### "Models not loading"

1. **Check browser console** - Look for 404 errors on ONNX files
2. **Verify models exist** - `public/openwakeword/models/*.onnx` should be present
3. **Clear browser cache** - Hard refresh (Ctrl+Shift+R)
4. **Rebuild container** - `docker-compose up -d --build client`

### "Stop word doesn't work"

The stop word uses "timer" instead of "stop" by default. To trigger:
- Say "timer" or "set a timer"
- Or train a custom "stop" model (see Training section)

## Future Improvements

- [ ] Train custom "stop" model for more intuitive interruption
- [ ] Add user-configurable wake word selection in UI
- [ ] Support multiple wake words simultaneously
- [ ] Add wake word confidence visualization
- [ ] Optimize model loading (lazy load unused keywords)

## References

- [OpenWakeWord GitHub](https://github.com/dscripka/openWakeWord)
- [openwakeword-wasm-browser npm](https://www.npmjs.com/package/openwakeword-wasm-browser)
- [Training notebook](https://colab.research.google.com/drive/1q1oe2zOyZp7UsB3jJiQ1IFn8z5YfjwEb)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript.html)
- [Silero VAD](https://github.com/snakers4/silero-vad)
