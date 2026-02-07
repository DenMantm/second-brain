# Testing Guide for Second Brain Web UI

Complete testing documentation for the voice assistant web interface.

## 📋 Test Structure

```
apps/web-ui/
├── packages/
│   ├── client/
│   │   └── e2e/                    # Playwright E2E tests
│   │       ├── voice-assistant.spec.ts
│   │       └── api-integration.spec.ts
│   └── server/
│       └── src/__tests__/          # Vitest unit tests
│           ├── routes/
│           │   ├── tts.test.ts
│           │   ├── stt.test.ts
│           │   └── chat.test.ts
│           ├── websocket.test.ts
│           └── config.test.ts
└── tests/
    └── integration/                # Full-stack integration tests
        └── full-stack.test.ts
```

## 🧪 Test Types

### 1. Client E2E Tests (Playwright)

**Location:** `packages/client/e2e/`

Tests the full user experience in a real browser:
- UI rendering and responsiveness
- User interactions (clicks, keyboard, etc.)
- Microphone permissions
- WebSocket connections
- API integration
- Accessibility (ARIA, keyboard navigation)

**Run Commands:**
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# View test report
npm run test:e2e:report
```

**Test Coverage:**
- ✅ App header and branding
- ✅ Voice assistant controls
- ✅ Conversation history display
- ✅ Microphone permission handling
- ✅ Audio visualization
- ✅ Error handling
- ✅ Mobile responsiveness
- ✅ Accessibility compliance

### 2. Server Unit Tests (Vitest)

**Location:** `packages/server/src/__tests__/`

Tests individual server components in isolation:
- Route handlers
- WebSocket logic
- Configuration
- Error handling

**Run Commands:**
```bash
# Run all unit tests
npm run test:server

# Watch mode (re-run on changes)
cd packages/server && npm run test:watch

# With UI
cd packages/server && npm run test:ui

# With coverage report
cd packages/server && npm run test:coverage
```

**Test Coverage:**
- ✅ TTS route proxying
- ✅ STT route proxying
- ✅ Chat endpoint logic
- ✅ Health check endpoints
- ✅ WebSocket route registration
- ✅ Configuration validation
- ✅ Error responses

### 3. Integration Tests (Vitest)

**Location:** `tests/integration/`

Tests the entire stack working together:
- Client ↔ Server communication
- Server ↔ Service integration
- End-to-end data flow
- CORS configuration

**Run Commands:**
```bash
# Run integration tests
npm run test:integration

# Run all tests (unit + E2E + integration)
npm run test:all
```

**Test Coverage:**
- ✅ Server health checks
- ✅ TTS service connectivity
- ✅ STT service connectivity
- ✅ Chat API responses
- ✅ Client accessibility
- ✅ CORS headers

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
cd apps/web-ui
npm install

# Install Playwright browsers (first time only)
cd packages/client
npx playwright install
```

### Running Tests Locally

**Option 1: Full Test Suite**
```bash
# From web-ui root
npm run test:all
```

**Option 2: Individual Test Suites**
```bash
# Server unit tests (fast)
npm run test:server

# Client E2E tests (requires services)
npm run test:e2e

# Integration tests (requires services)
npm run test:integration
```

### Running with Services

For E2E and integration tests, start the services first:

**Terminal 1 - Start Server:**
```bash
cd apps/web-ui/packages/server
cp .env.example .env
npm run dev
```

**Terminal 2 - Start Client:**
```bash
cd apps/web-ui/packages/client
npm run dev
```

**Terminal 3 - Run Tests:**
```bash
cd apps/web-ui
npm run test:e2e
```

## 📊 Test Results

### Expected Output

**Server Unit Tests:**
```
✓ src/__tests__/routes/tts.test.ts (4)
✓ src/__tests__/routes/stt.test.ts (3)
✓ src/__tests__/routes/chat.test.ts (5)
✓ src/__tests__/websocket.test.ts (2)
✓ src/__tests__/config.test.ts (5)

Test Files  5 passed (5)
     Tests  19 passed (19)
```

**Client E2E Tests:**
```
✓ e2e/voice-assistant.spec.ts (15)
✓ e2e/api-integration.spec.ts (5)

  20 passed (20)
```

**Integration Tests:**
```
✓ tests/integration/full-stack.test.ts (6)

  6 passed (6)
```

## 🐛 Debugging Tests

### Playwright E2E Tests

```bash
# Run in debug mode
cd packages/client
npx playwright test --debug

# Run specific test
npx playwright test voice-assistant.spec.ts:12

# View trace
npx playwright show-trace trace.zip
```

### Vitest Unit Tests

```bash
# Run specific test file
cd packages/server
npm run test -- routes/chat.test.ts

# Run with verbose output
npm run test -- --reporter=verbose

# Open UI for interactive debugging
npm run test:ui
```

## 📝 Writing New Tests

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('should display new feature', async ({ page }) => {
  await page.goto('/');
  
  const feature = page.locator('.new-feature');
  await expect(feature).toBeVisible();
  await expect(feature).toContainText('Expected text');
});
```

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../myModule';

describe('My Function', () => {
  it('should return expected value', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

## 🎯 Coverage Goals

| Component | Target Coverage | Current |
|-----------|----------------|---------|
| Server Routes | 80% | ✅ |
| Server Config | 100% | ✅ |
| Client UI | 70% | ✅ |
| Integration | 60% | ✅ |

## 🔧 CI/CD Integration

Tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Install dependencies
  run: npm ci
  
- name: Run unit tests
  run: npm run test:server
  
- name: Install Playwright
  run: npx playwright install --with-deps
  
- name: Run E2E tests
  run: npm run test:e2e
```

## 🚨 Common Issues

### Issue: Playwright browsers not installed
**Solution:**
```bash
cd packages/client
npx playwright install
```

### Issue: Tests timeout
**Solution:** Increase timeout in config:
```typescript
// playwright.config.ts
timeout: 60_000, // 60 seconds
```

### Issue: Services not running
**Solution:** Start dev servers before E2E tests:
```bash
npm run dev:server &
npm run dev:client &
npm run test:e2e
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## ✅ Test Checklist

Before committing:
- [ ] All unit tests pass (`npm run test:server`)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] No console errors in tests
- [ ] Coverage meets targets
- [ ] New features have tests
- [ ] Tests are documented

---

**Last Updated:** February 7, 2026
**Maintainer:** Second Brain Team
