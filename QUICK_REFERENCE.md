# Quick Reference - Second Brain Services

## 🚀 Start/Stop Services

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# Restart
docker-compose restart

# View status
docker-compose ps
```

## 🔍 Health Checks

```bash
# Quick check
python test_services.py

# TTS
curl http://localhost:3002/ping

# STT  
curl http://localhost:3003/health
```

## 📋 View Logs

```bash
# All services
docker-compose logs -f

# TTS only
docker-compose logs -f tts-service

# STT only
docker-compose logs -f stt-service

# Last 50 lines
docker-compose logs --tail=50
```

## 🧪 Test Services

### TTS Test
```bash
curl -X POST http://localhost:3002/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from Second Brain"}' \
  --output speech.wav

# Play the audio
start speech.wav  # Windows
```

### STT Test
```bash
# Record audio first, then:
curl -X POST http://localhost:3003/api/stt/transcribe \
  -F "audio=@recording.wav" \
  -F "language=en"
```

## 🔧 Configuration

**TTS**: `apps/tts-service/.env`  
**STT**: `apps/stt-service/.env`

## 📊 Current Status

- **TTS**: Port 3002, CPU mode, RTF 0.05-0.25  
- **STT**: Port 3003, CPU mode, base model

## 🐛 Troubleshooting

```bash
# Rebuild service
docker-compose build --no-cache [service-name]
docker-compose up -d [service-name]

# Check resources
docker stats

# Enter container
docker exec -it second-brain-tts bash
docker exec -it second-brain-stt bash
```

## 📖 Full Docs

- [Services Status](SERVICES_STATUS.md)
- [TTS README](apps/tts-service/README.md)
- [STT README](apps/stt-service/README.md)
