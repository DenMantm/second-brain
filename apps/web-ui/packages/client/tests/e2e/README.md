# End-to-End Testing Guide

## Why E2E Tests Are Needed

The stop word/wake word feature bugs revealed critical gaps in our testing strategy:

### Bugs That Would Be Caught by E2E Tests

1. **Shared Singleton State** - TensorFlow detection service is shared between WakeWordManager and StopWordManager
   - Unit tests use separate mocks and can't detect this
   - E2E tests would use the real singleton service

2. **Async Flow Completion** - `setSpeaking()` must be awaited in callbacks
   - Unit tests mock async operations and don't verify completion
   - E2E tests would fail if state doesn't update

3. **Detection Service Switching** - Service must be reinitialized when switching between wake/stop words
   - Unit tests don't verify the service configuration persists correctly
   - E2E tests would detect wrong word being listened for

4. **Browser-Specific APIs** - TensorFlow.js, Web Audio, MediaRecorder
   - Cannot run in Node.js/Vitest
   - Must test in real browser environment

## Recommended E2E Test Framework

**Playwright** - Modern, fast, reliable browser automation
- Built-in test runner
- Multi-browser support (Chromium, Firefox, WebKit)
- Excellent debugging tools
- Built-in TypeScript support

## Setup Instructions

```bash
# Install Playwright
cd apps/web-ui/packages/client
npm install -D @playwright/test

# Install browsers
npx playwright install chromium

# Create config
npx playwright init
```

## Critical E2E Test Scenarios

### 1. Wake Word to Stop Word Switching

```typescript
import { test, expect } from '@playwright/test';

test('wake word switches to stop word during TTS', async ({ page }) => {
  await page.goto('https://localhost:8443');
  
  // Enable wake word and stop word in settings
  await page.click('[data-testid="settings-button"]');
  await page.check('[data-testid="wake-word-enabled"]');
  await page.check('[data-testid="stop-word-enabled"]');
  
  // Trigger wake word
  // NOTE: This requires simulating audio input - see "Testing Audio" section
  
  // Type a message that triggers TTS
  await page.fill('[data-testid="message-input"]', 'Say something long');
  await page.click('[data-testid="send-button"]');
  
  // While TTS is playing, stop word detection should be active
  await expect(page.locator('[data-testid="listening-for"]')).toContainText('stop');
  
  // After TTS completes, wake word detection should resume
  await page.waitForSelector('[data-testid="tts-complete"]');
  await expect(page.locator('[data-testid="listening-for"]')).toContainText('go');
});
```

### 2. Stop Word Interrupts TTS

```typescript
test('stop word interrupts assistant speech', async ({ page }) => {
  await page.goto('https://localhost:8443');
  
  // Start a long response
  await page.fill('[data-testid="message-input"]', 'Tell me a long story');
  await page.click('[data-testid="send-button"]');
  
  // Wait for TTS to start
  await page.waitForSelector('[data-testid="tts-playing"]');
  
  // Simulate saying stop word
  // NOTE: See "Testing Audio" section for implementation
  
  // TTS should stop
  await expect(page.locator('[data-testid="tts-playing"]')).not.toBeVisible({ timeout: 1000 });
});
```

### 3. Wake Word Works After Stop Word Used

```typescript
test('wake word detection works after stop word was used', async ({ page }) => {
  await page.goto('https://localhost:8443');
  
  // Use stop word to interrupt TTS
  await page.fill('[data-testid="message-input"]', 'Say something');
  await page.click('[data-testid="send-button"]');
  await page.waitForSelector('[data-testid="tts-playing"]');
  // Trigger stop word...
  
  // Wait for wake word to be active again
  await expect(page.locator('[data-testid="listening-for"]')).toContainText('go');
  
  // Trigger wake word - should work
  // This test would have caught the singleton overwrite bug
});
```

### 4. Detection Service Reinitializes Correctly

```typescript
test('detection service switches between words without confusion', async ({ page }) => {
  await page.goto('https://localhost:8443');
  
  // Rapid mode switching
  for (let i = 0; i < 3; i++) {
    // Start TTS (switches to stop word)
    await page.fill('[data-testid="message-input"]', `Message ${i}`);
    await page.click('[data-testid="send-button"]');
    await page.waitForSelector('[data-testid="tts-playing"]');
    
    // Wait for TTS to finish (switches back to wake word)
    await page.waitForSelector('[data-testid="tts-complete"]');
  }
  
  // Wake word should still work
  await expect(page.locator('[data-testid="listening-for"]')).toContainText('go');
});
```

## Testing Audio Input

Testing TensorFlow.js wake word detection requires simulating audio input. Options:

### Option 1: Mock getUserMedia (Unit Test Approach)
```typescript
await page.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    // Return a fake MediaStream with wake word audio
    // This is complex - requires encoding wake word as audio
  };
});
```

### Option 2: Use Web Audio API to Generate Test Audio
```typescript
await page.evaluate(() => {
  // Generate audio that matches wake word pattern
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  // ... configure to produce wake word pattern
});
```

### Option 3: Data-Testid Triggers (Simplest)
Add hidden test buttons in development mode:

```typescript
// In Settings.tsx (dev mode only)
{process.env.NODE_ENV === 'development' && (
  <>
    <button data-testid="trigger-wake-word" onClick={() => {
      // Manually trigger wake word callback
      wakeWordManager.simulateDetection();
    }}>
      Trigger Wake Word
    </button>
    <button data-testid="trigger-stop-word" onClick={() => {
      stopWordManager.simulateDetection();
    }}>
      Trigger Stop Word
    </button>
  </>
)}
```

## Running E2E Tests

```bash
# Run tests
npx playwright test

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test
npx playwright test wake-word.spec.ts

# Debug mode
npx playwright test --debug

# Generate code from interactions
npx playwright codegen https://localhost:8443
```

## CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Start dev server
  run: docker-compose up -d

- name: Wait for server
  run: npx wait-on https://localhost:8443

- name: Run E2E tests
  run: npx playwright test

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Test Data Requirements

E2E tests need:
- SSL certificates (already in `/certs` for localhost)
- Sample TTS audio files
- Sample wake word audio patterns
- Test user settings

## Performance Considerations

E2E tests are slower than unit tests:
- Run unit tests first (fast feedback)
- Run E2E tests on PR (critical paths)
- Run full E2E suite nightly (comprehensive coverage)

## Debugging E2E Test Failures

1. **Use headed mode** - `npx playwright test --headed`
2. **Screenshots** - Playwright captures on failure
3. **Video recording** - Enable in config
4. **Trace viewer** - `npx playwright show-trace trace.zip`
5. **Debug mode** - `npx playwright test --debug`

## Current Testing Strategy

**Unit Tests** (Vitest)
- ✅ Service logic (WakeWordManager, StopWordManager)
- ✅ State management (voiceStore, settingsStore)
- ✅ React components (Settings UI)
- ❌ Cannot test TensorFlow.js in Node.js
- ❌ Cannot test browser APIs
- ❌ Mocks hide integration bugs

**Integration Tests** (Vitest with mocks)
- ✅ Service coordination (wake/stop word switching)
- ✅ Async flow verification
- ✅ State transitions
- ❌ Mocks don't catch singleton bugs
- ❌ Still can't test real TensorFlow

**E2E Tests** (Playwright) - **TODO**
- ✅ Real browser environment
- ✅ Real TensorFlow.js models
- ✅ Real audio processing
- ✅ Catches singleton bugs
- ✅ Catches async bugs
- ✅ End-to-end user flows

## Next Steps

1. Set up Playwright config
2. Create test helpers for audio simulation
3. Implement critical path tests (wake/stop word switching)
4. Add to CI/CD pipeline
5. Document test patterns for future features

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Testing Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Testing)
- [Testing MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
- [TensorFlow.js in Browser](https://www.tensorflow.org/js/guide/platform_environment)
