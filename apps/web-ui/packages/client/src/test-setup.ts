/**
 * Global test setup for Vitest
 * Mocks browser APIs that don't exist in Node.js test environment
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';

// OFFICIAL FIX for React 18 + Testing Library
// Source: https://github.com/testing-library/react-testing-library/issues/1413
// Setting this global variable tells React Testing Library to properly handle React 18's concurrent rendering
if (typeof window !== 'undefined') {
  window.IS_REACT_ACT_ENVIRONMENT = true;
} else if (typeof global !== 'undefined') {
  global.IS_REACT_ACT_ENVIRONMENT = true;
}

// Browser mode: Real browser APIs exist, skip mocks
// Node.js mode: Need to mock browser APIs
const isBrowserMode = typeof window !== 'undefined' && typeof navigator !== 'undefined';

if (!isBrowserMode) {
  // Mock navigator.mediaDevices (Node.js only)
  const mockMediaStream = {
    getTracks: () => [
      {
        stop: vi.fn(),
        kind: 'audio',
        enabled: true,
        id: 'mock-track-id',
      },
    ],
  };

  Object.defineProperty(global, 'navigator', {
    writable: true,
    value: {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
      userAgent: 'test-agent',
    },
  });

  // Mock window object (Node.js only)
  Object.defineProperty(global, 'window', {
    writable: true,
    value: {
      AudioContext: vi.fn().mockImplementation(() => ({
        createBufferSource: vi.fn().mockReturnValue({
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          buffer: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
        decodeAudioData: vi.fn().mockResolvedValue({
          duration: 1.0,
          length: 44100,
          numberOfChannels: 1,
          sampleRate: 44100,
        }),
        destination: {},
        state: 'running',
        suspend: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      })),
      webkitAudioContext: undefined,
      location: {
        href: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
      },
    },
  });
}
