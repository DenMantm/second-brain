# Implementing Vitest Browser Mode for React 18 Testing

## Why Browser Mode?

Vitest Browser Mode runs tests in **real browsers** (Chrome, Firefox, Safari) instead of JSDOM/happy-dom. This completely avoids React 18 concurrent rendering issues because tests run in an actual browser environment.

## Installation

```bash
cd apps/web-ui/packages/client
npm install -D @vitest/browser playwright
# or
npm install -D @vitest/browser webdriverio
```

## Configuration

Update `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use browser mode for component tests
    browser: {
      enabled: true,
      name: 'chromium', // or 'firefox', 'webkit'
      provider: 'playwright', // or 'webdriverio'
      headless: true,
    },
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

## Running Tests

```bash
# Run all tests in browser
npm test

# Run specific test file
npm test -- src/components/__tests__/VoiceControls.test.tsx

# Run with UI
npm test -- --ui

# Run with specific browser
npm test -- --browser=firefox
```

## Benefits

✅ **No React 18 concurrent rendering issues**
✅ **Tests actual browser behavior**
✅ **Real DOM implementation**
✅ **Accurate user interaction simulation**
✅ **Can test real wake word detection (with mocking)**
✅ **Supports Web Audio API natively**
✅ **Catches browser-specific bugs**

## Migration Guide

### Before (JSDOM)
```typescript
import { render, screen } from '@testing-library/react';

test('renders button', () => {
  render(<VoiceControls isPermissionDenied={false} />);
  expect(screen.getByText('Start Voice Assistant')).toBeInTheDocument();
});
```

### After (Browser Mode)
```typescript
// No changes needed! Same API works in browser mode
import { render, screen } from '@testing-library/react';

test('renders button', () => {
  render(<VoiceControls isPermissionDenied={false} />);
  expect(screen.getByText('Start Voice Assistant')).toBeInTheDocument();
});
```

**All existing tests work without modification!**

## Performance

- **First run**: ~5-10 seconds (browser startup)
- **Watch mode**: ~1-2 seconds per test file
- **Headless mode**: Faster than headed
- **Parallel execution**: Supported

## Debugging

```bash
# Run tests with browser UI visible
npm test -- --browser.headless=false

# Pause on test failure
npm test -- --browser.headless=false --inspect-brk

# Use browser DevTools
# Tests will pause and you can inspect in real browser
```

## Alternative: Keep JSDOM for Simple Tests

You can use browser mode for component tests and JSDOM for simple unit tests:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    browser: {
      enabled: process.env.BROWSER_MODE === 'true',
      name: 'chromium',
      provider: 'playwright',
    },
    environment: process.env.BROWSER_MODE === 'true' ? undefined : 'jsdom',
  },
});
```

Run with:
```bash
# Browser mode
BROWSER_MODE=true npm test

# JSDOM mode (faster, but React 18 issues persist)
npm test
```

## Resources

- [Vitest Browser Mode Docs](https://vitest.dev/guide/browser/)
- [Playwright Provider](https://vitest.dev/guide/browser/#playwright-provider)
- [WebdriverIO Provider](https://vitest.dev/guide/browser/#webdriverio-provider)
- [Migration Guide](https://vitest.dev/guide/migration#browser-mode)

## Estimated Effort

- **Installation**: 5 minutes
- **Configuration**: 10 minutes  
- **Testing existing tests**: 15 minutes
- **Total**: ~30 minutes to fully migrate

## Expected Outcome

✅ All 183 tests (hook + integration + component) will pass
✅ Tests run in real browser environment
✅ No more React 18 concurrent rendering errors
✅ More confidence in production behavior
