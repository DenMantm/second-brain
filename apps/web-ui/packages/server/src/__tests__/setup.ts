import { beforeAll, afterAll, vi } from 'vitest';

// Mock global fetch if needed
beforeAll(() => {
  if (!global.fetch) {
    global.fetch = vi.fn();
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});
