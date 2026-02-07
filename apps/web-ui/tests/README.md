# Integration Tests

Full-stack integration tests for the Second Brain web UI.

## Running Tests

```bash
# From web-ui root directory

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:integration:coverage
```

## Test Scenarios

### Server Health Checks
- Server health endpoint responds correctly
- TTS service connectivity verification
- STT service connectivity verification

### API Endpoints
- Chat message processing
- Error handling
- Response validation

### Client Accessibility
- Client application serves correctly
- HTML content validation

### CORS Configuration
- Cross-origin requests allowed from client
- Proper headers configured

## Prerequisites

Before running integration tests:

1. Start the API server:
   ```bash
   cd packages/server
   npm run dev
   ```

2. Start the client:
   ```bash
   cd packages/client
   npm run dev
   ```

3. Ensure TTS and STT services are running (optional):
   ```bash
   # From second-brain root
   docker-compose up tts-service stt-service
   ```

## Environment Variables

Set these environment variables if using non-default ports:

```bash
export API_URL=http://localhost:3000
export CLIENT_URL=http://localhost:5173
```

## CI/CD Integration

These tests are designed to be run in CI/CD pipelines. They will gracefully skip tests if services are not available, making them suitable for both local development and automated testing environments.
