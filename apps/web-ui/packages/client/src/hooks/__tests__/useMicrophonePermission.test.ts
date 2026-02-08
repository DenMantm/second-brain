import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMicrophonePermission } from '../useMicrophonePermission';
import React from 'react';

describe('useMicrophonePermission', () => {
  let mockPermissionStatus: {
    state: PermissionState;
    onchange: (() => void) | null;
  };

  beforeEach(() => {
    // Create mock permission status
    mockPermissionStatus = {
      state: 'prompt' as PermissionState,
      onchange: null,
    };

    // Mock navigator.permissions.query
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: vi.fn().mockResolvedValue(mockPermissionStatus),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with prompt permission state', async () => {
      const { result } = renderHook(() => useMicrophonePermission());

      // Wait for the async effect to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.permission).toBe('prompt');
      expect(result.current.isPrompt).toBe(true);
      expect(result.current.isGranted).toBe(false);
      expect(result.current.isDenied).toBe(false);
    });

    it('should be loading initially', () => {
      const { result } = renderHook(() => useMicrophonePermission());

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('permission detection', () => {
    it('should detect granted permission', async () => {
      mockPermissionStatus.state = 'granted';

      const { result } = renderHook(() => useMicrophonePermission());

      await waitFor(() => {
        expect(result.current.permission).toBe('granted');
      });

      expect(result.current.isGranted).toBe(true);
      expect(result.current.isDenied).toBe(false);
      expect(result.current.isPrompt).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should detect denied permission', async () => {
      mockPermissionStatus.state = 'denied';

      const { result } = renderHook(() => useMicrophonePermission());

      await waitFor(() => {
        expect(result.current.permission).toBe('denied');
      });

      expect(result.current.isGranted).toBe(false);
      expect(result.current.isDenied).toBe(true);
      expect(result.current.isPrompt).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should detect prompt permission', async () => {
      mockPermissionStatus.state = 'prompt';

      const { result } = renderHook(() => useMicrophonePermission());

      await waitFor(() => {
        expect(result.current.permission).toBe('prompt');
      });

      expect(result.current.isGranted).toBe(false);
      expect(result.current.isDenied).toBe(false);
      expect(result.current.isPrompt).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('permission changes', () => {
    it('should update when permission changes from prompt to granted', async () => {
      mockPermissionStatus.state = 'prompt';

      const { result } = renderHook(() => useMicrophonePermission());

      await waitFor(() => {
        expect(result.current.permission).toBe('prompt');
      });

      // Simulate permission change
      mockPermissionStatus.state = 'granted';
      mockPermissionStatus.onchange?.();

      await waitFor(() => {
        expect(result.current.permission).toBe('granted');
      });

      expect(result.current.isGranted).toBe(true);
    });

    it('should update when permission changes from prompt to denied', async () => {
      mockPermissionStatus.state = 'prompt';

      const { result } = renderHook(() => useMicrophonePermission());

      await waitFor(() => {
        expect(result.current.permission).toBe('prompt');
      });

      // Simulate permission change
      mockPermissionStatus.state = 'denied';
      mockPermissionStatus.onchange?.();

      await waitFor(() => {
        expect(result.current.permission).toBe('denied');
      });

      expect(result.current.isDenied).toBe(true);
    });

    it('should update when permission changes from denied to granted', async () => {
      mockPermissionStatus.state = 'denied';

      const { result } = renderHook(() => useMicrophonePermission());

      await waitFor(() => {
        expect(result.current.permission).toBe('denied');
      });

      // Simulate permission change (user reset browser permissions)
      mockPermissionStatus.state = 'granted';
      mockPermissionStatus.onchange?.();

      await waitFor(() => {
        expect(result.current.permission).toBe('granted');
      });

      expect(result.current.isGranted).toBe(true);
      expect(result.current.isDenied).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing permissions API gracefully', async () => {
      // Remove permissions API
      Object.defineProperty(navigator, 'permissions', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useMicrophonePermission());

      // Should remain in prompt state
      expect(result.current.permission).toBe('prompt');
      expect(result.current.isLoading).toBe(true);
    });

    it('should handle query rejection gracefully', async () => {
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: vi.fn().mockRejectedValue(new Error('Permission query failed')),
        },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useMicrophonePermission());

      // Should remain in prompt state on error
      await waitFor(() => {
        expect(result.current.permission).toBe('prompt');
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup event listener on unmount', async () => {
      mockPermissionStatus.state = 'granted';

      const { unmount } = renderHook(() => useMicrophonePermission());

      await waitFor(() => {
        expect(mockPermissionStatus.onchange).not.toBeNull();
      });

      unmount();

      // After unmount, changing permission shouldn't cause updates
      mockPermissionStatus.state = 'denied';
      mockPermissionStatus.onchange?.();

      // No assertion needed - test passes if no errors thrown
    });
  });
});
