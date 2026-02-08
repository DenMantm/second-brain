import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceControls } from '../useVoiceControls';
import { useVoiceStore } from '../../stores/voiceStore';

// Mock the voice store
vi.mock('../../stores/voiceStore', () => ({
  useVoiceStore: vi.fn(),
}));

describe('useVoiceControls', () => {
  let mockStoreActions: {
    initialize: ReturnType<typeof vi.fn>;
    startListening: ReturnType<typeof vi.fn>;
    stopListening: ReturnType<typeof vi.fn>;
    manualTrigger: ReturnType<typeof vi.fn>;
    interrupt: ReturnType<typeof vi.fn>;
    stopConversation: ReturnType<typeof vi.fn>;
    startNewConversation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create mock functions
    mockStoreActions = {
      initialize: vi.fn().mockResolvedValue(undefined),
      startListening: vi.fn().mockResolvedValue(undefined),
      stopListening: vi.fn().mockResolvedValue(undefined),
      manualTrigger: vi.fn().mockResolvedValue(undefined),
      interrupt: vi.fn(),
      stopConversation: vi.fn(),
      startNewConversation: vi.fn(),
    };

    // Mock useVoiceStore to return our mock actions and state
    vi.mocked(useVoiceStore).mockReturnValue({
      ...mockStoreActions,
      isListening: false,
      isRecording: false,
      isSpeaking: false,
      wakeWordDetected: false,
      isProcessing: false,
      messages: [],
      streamingText: '',
      error: null,
      lastInteractionTime: null,
    });
  });

  describe('handleInitialize', () => {
    it('should call initialize and startListening', async () => {
      const { result } = renderHook(() => useVoiceControls());

      await act(async () => {
        await result.current.handleInitialize();
      });

      expect(mockStoreActions.initialize).toHaveBeenCalledTimes(1);
      expect(mockStoreActions.startListening).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Initialization failed');
      mockStoreActions.initialize.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useVoiceControls());

      await expect(async () => {
        await act(async () => {
          await result.current.handleInitialize();
        });
      }).rejects.toThrow('Initialization failed');

      expect(mockStoreActions.initialize).toHaveBeenCalledTimes(1);
      expect(mockStoreActions.startListening).not.toHaveBeenCalled();
    });

    it('should not start listening if initialization fails', async () => {
      mockStoreActions.initialize.mockRejectedValueOnce(new Error('Failed'));

      const { result } = renderHook(() => useVoiceControls());

      await expect(async () => {
        await act(async () => {
          await result.current.handleInitialize();
        });
      }).rejects.toThrow('Failed');

      expect(mockStoreActions.startListening).not.toHaveBeenCalled();
    });
  });

  describe('handleStop', () => {
    it('should call stopListening', async () => {
      const { result } = renderHook(() => useVoiceControls());

      await act(async () => {
        await result.current.handleStop();
      });

      expect(mockStoreActions.stopListening).toHaveBeenCalledTimes(1);
    });

    it('should throw stop errors', async () => {
      mockStoreActions.stopListening.mockRejectedValueOnce(new Error('Stop failed'));

      const { result } = renderHook(() => useVoiceControls());

      // Should throw since there's no try/catch
      await expect(async () => {
        await act(async () => {
          await result.current.handleStop();
        });
      }).rejects.toThrow('Stop failed');

      expect(mockStoreActions.stopListening).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleToggle', () => {
    it('should initialize when not listening', async () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockStoreActions,
        isListening: false,
        isRecording: false,
        isSpeaking: false,
        wakeWordDetected: false,
        isProcessing: false,
        messages: [],
        streamingText: '',
        error: null,
        lastInteractionTime: null,
      });

      const { result } = renderHook(() => useVoiceControls());

      await act(async () => {
        await result.current.handleToggle();
      });

      expect(mockStoreActions.initialize).toHaveBeenCalledTimes(1);
      expect(mockStoreActions.startListening).toHaveBeenCalledTimes(1);
    });

    it('should stop when listening', async () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockStoreActions,
        isListening: true,
        isRecording: false,
        isSpeaking: false,
        wakeWordDetected: false,
        isProcessing: false,
        messages: [],
        streamingText: '',
        error: null,
        lastInteractionTime: null,
      });

      const { result } = renderHook(() => useVoiceControls());

      await act(async () => {
        await result.current.handleToggle();
      });

      expect(mockStoreActions.stopListening).toHaveBeenCalledTimes(1);
    });

    it('should toggle between states correctly', async () => {
      const { result, rerender } = renderHook(() => useVoiceControls());

      // First toggle: start
      await act(async () => {
        await result.current.handleToggle();
      });

      expect(mockStoreActions.initialize).toHaveBeenCalledTimes(1);

      // Change state to listening
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockStoreActions,
        isListening: true,
        isRecording: false,
        isSpeaking: false,
        wakeWordDetected: false,
        isProcessing: false,
        messages: [],
        streamingText: '',
        error: null,
        lastInteractionTime: null,
      });

      rerender();

      // Second toggle: stop
      await act(async () => {
        await result.current.handleToggle();
      });

      expect(mockStoreActions.stopListening).toHaveBeenCalledTimes(1);
    });
  });

  describe('interrupt', () => {
    it('should call store interrupt action', () => {
      const { result } = renderHook(() => useVoiceControls());

      act(() => {
        result.current.interrupt();
      });

      expect(mockStoreActions.interrupt).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopConversation', () => {
    it('should call store stopConversation action', () => {
      const { result } = renderHook(() => useVoiceControls());

      act(() => {
        result.current.stopConversation();
      });

      expect(mockStoreActions.stopConversation).toHaveBeenCalledTimes(1);
    });
  });

  describe('startNewConversation', () => {
    it('should call store startNewConversation action', () => {
      const { result } = renderHook(() => useVoiceControls());

      act(() => {
        result.current.startNewConversation();
      });

      expect(mockStoreActions.startNewConversation).toHaveBeenCalledTimes(1);
    });
  });

  describe('manualTrigger', () => {
    it('should call manualTrigger', async () => {
      const { result } = renderHook(() => useVoiceControls());

      await act(async () => {
        await result.current.manualTrigger();
      });

      expect(mockStoreActions.manualTrigger).toHaveBeenCalledTimes(1);
    });

    it('should throw trigger errors', async () => {
      mockStoreActions.manualTrigger.mockRejectedValueOnce(new Error('Trigger failed'));

      const { result } = renderHook(() => useVoiceControls());

      // Should throw since there's no try/catch
      await expect(async () => {
        await act(async () => {
          await result.current.manualTrigger();
        });
      }).rejects.toThrow('Trigger failed');

      expect(mockStoreActions.manualTrigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('memoization', () => {
    it('should memoize handlers with useCallback', () => {
      const { result, rerender } = renderHook(() => useVoiceControls());

      const firstHandleInitialize = result.current.handleInitialize;
      const firstHandleStop = result.current.handleStop;
      const firstInterrupt = result.current.interrupt;

      rerender();

      // Handlers should be the same reference (memoized)
      expect(result.current.handleInitialize).toBe(firstHandleInitialize);
      expect(result.current.handleStop).toBe(firstHandleStop);
      expect(result.current.interrupt).toBe(firstInterrupt);
    });

    it('should update memoized handlers when dependencies change', () => {
      const { result, rerender } = renderHook(() => useVoiceControls());

      const firstHandleToggle = result.current.handleToggle;

      // Change isListening state
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockStoreActions,
        isListening: true,
        isRecording: false,
        isSpeaking: false,
        wakeWordDetected: false,
        isProcessing: false,
        messages: [],
        streamingText: '',
        error: null,
        lastInteractionTime: null,
      });

      rerender();

      // handleToggle should be a new reference since isListening changed
      expect(result.current.handleToggle).not.toBe(firstHandleToggle);
    });
  });

  describe('error handling', () => {
    it('should log errors to console', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      mockStoreActions.initialize.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useVoiceControls());

      await expect(async () => {
        await act(async () => {
          await result.current.handleInitialize();
        });
      }).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to initialize voice assistant:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
