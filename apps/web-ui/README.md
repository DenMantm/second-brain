# Second Brain Web UI

Voice-enabled AI assistant web interface with wake word detection.

## Architecture

```
apps/web-ui/
├── packages/
│   ├── client/          # React + TypeScript + Vite
│   └── server/          # Fastify API + WebSocket
├── docker-compose.yml   # Container orchestration
└── README.md
```

## Features

- 🎤 **Wake Word Detection** - "Hey Assistant" activation
- 🗣️ **Voice Input** - Browser-based speech recording
- 🔊 **Voice Output** - Natural TTS responses
- 💬 **Chat Interface** - Conversation history
- 🔒 **Privacy-First** - All processing runs locally
- 🐳 **Docker Ready** - Full containerization

## Quick Start

### Development Mode

```bash
# Install dependencies
npm install

# Start both client and server
npm run dev

# Or start individually
npm run dev:client  # http://localhost:5173
npm run dev:server  # http://localhost:3000
```

### Docker Mode

```bash
# Build images
npm run docker:build

# Start containers
npm run docker:up

# View logs
npm run docker:logs

# Stop containers
npm run docker:down
```

## Services Integration

The web UI connects to:
- **TTS Service** (port 3002) - Text-to-speech
- **STT Service** (port 3003) - Speech-to-text
- **LLM Service** (port 8080) - Chat responses

Make sure these services are running before starting the web UI.

## Project Structure

### Client (packages/client)

```
src/
├── components/
│   ├── VoiceAssistant.tsx    # Main voice interface
│   └── ConversationHistory.tsx
├── stores/
│   └── voiceStore.ts          # Zustand state management
├── App.tsx
└── main.tsx
```

### Server (packages/server)

```
src/
├── routes/
│   ├── tts.ts                 # TTS proxy
│   ├── stt.ts                 # STT proxy
│   └── chat.ts                # Chat endpoint
├── websocket.ts               # WebSocket handler
├── config.ts                  # Configuration
└── main.ts                    # Entry point
```

## Environment Variables

### Client

Create `packages/client/.env`:
```env
VITE_API_URL=http://localhost:3000
```

### Server

Create `packages/server/.env`:
```env
PORT=3000
TTS_SERVICE_URL=http://localhost:3002
STT_SERVICE_URL=http://localhost:3003
LLM_SERVICE_URL=http://localhost:8080
CORS_ORIGIN=http://localhost:5173
```

## Development Workflow

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Build for production
npm run build

# Clean all build artifacts
npm run clean
```

## Tech Stack

**Frontend:**
- React 18
- TypeScript 5.3
- Vite 5
- Zustand (state management)
- Web Audio API

**Backend:**
- Fastify (API framework)
- WebSocket support
- TypeScript
- Zod (validation)

**DevOps:**
- Nx (monorepo tooling)
- Docker & Docker Compose
- npm workspaces

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires:
- Microphone access
- Web Audio API
- ES2020+ support

## Next Steps

1. **Wake Word Detection** - Integrate Porcupine or TensorFlow.js
2. **LLM Integration** - Connect to local LLM service
3. **Voice Activity Detection** - Auto-stop recording on silence
4. **Conversation Memory** - Persistent chat history
5. **WebSocket Streaming** - Real-time LLM responses

## License

MIT
