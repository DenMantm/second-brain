import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVoiceStatus } from '../useVoiceStatus';
import { useVoiceStore } from '../../stores/voiceStore';

// Mock the voice store
vi.mock('../../stores/voiceStore', () => ({
  useVoiceStore: vi.fn(),
}));

describe('useVoiceStatus', () => {
  const defaultState = {
    isListening: false,
    isRecording: false,
    isSpeaking: false,
    wakeWordDetected: false,
    isProcessing: false,
    messages: [],
    streamingText: '',
    error: null,
    lastInteractionTime: null,
  };

  beforeEach(() => {
    vi.mocked(useVoiceStore).mockReturnValue(defaultState);
  });

  describe('status computation', () => {
    it('should show speaking status when isSpeaking is true', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isSpeaking: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.status.icon).toBe('🔊');
      expect(result.current.status.text).toBe('Speaking...');
    });

    it('should show processing status when isProcessing is true', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isProcessing: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.status.icon).toBe('⏳');
      expect(result.current.status.text).toBe('Transcribing...');
    });

    it('should show recording status when isRecording is true', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isRecording: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.status.icon).toBe('🎤');
      expect(result.current.status.text).toBe('Recording...');
    });

    it('should show wake word detected status', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        wakeWordDetected: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.status.icon).toBe('👂');
      expect(result.current.status.text).toBe('Wake word detected');
    });

    it('should show listening status when isListening is true', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.status.icon).toBe('👂');
      expect(result.current.status.text).toBe('Listening for wake word...');
    });

    it('should show ready status by default', () => {
      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.status.icon).toBe('⏸️');
      expect(result.current.status.text).toBe('Ready');
    });
  });

  describe('status priority', () => {
    it('should prioritize speaking over processing', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isSpeaking: true,
        isProcessing: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.status.text).toBe('Speaking...');
    });

    it('should prioritize processing over recording', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isProcessing: true,
        isRecording: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.status.text).toBe('Transcribing...');
    });

    it('should prioritize recording over wake word detected', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isRecording: true,
        wakeWordDetected: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.status.text).toBe('Recording...');
    });

    it('should prioritize wake word detected over listening', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        wakeWordDetected: true,
        isListening: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.status.text).toBe('Wake word detected');
    });
  });

  describe('button text', () => {
    it('should show "Stop Listening" when listening', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.buttonText).toBe('Stop Listening');
    });

    it('should show "Start Voice Assistant" when not listening', () => {
      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.buttonText).toBe('Start Voice Assistant');
    });
  });

  describe('hint text', () => {
    it('should show wake word hint when listening but not recording', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.hint).toBe('Say "Go" to activate');
    });

    it('should show manual trigger hint when wake word detected', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        wakeWordDetected: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.hint).toBe('Speak your question...');
    });

    it('should show recording hint when recording', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isRecording: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.hint).toBe('Recording... speak now!');
    });

    it('should show start hint when not listening', () => {
      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.hint).toBe('Click Start Voice Assistant to begin');
    });
  });

  describe('isActive flag', () => {
    it('should be true when recording', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isRecording: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.isActive).toBe(true);
    });

    it('should be true when processing', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isProcessing: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.isActive).toBe(true);
    });

    it('should be true when speaking', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isSpeaking: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.isActive).toBe(true);
    });

    it('should be false when only listening', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });

      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.isActive).toBe(false);
    });

    it('should be false when idle', () => {
      const { result } = renderHook(() => useVoiceStatus());

      expect(result.current.isActive).toBe(false);
    });
  });

  describe('memoization', () => {
    it('should memoize status when state does not change', () => {
      const { result, rerender } = renderHook(() => useVoiceStatus());

      const firstStatus = result.current.status;
      const firstButtonText = result.current.buttonText;
      const firstHint = result.current.hint;

      rerender();

      // Should be same references (memoized)
      expect(result.current.status).toBe(firstStatus);
      expect(result.current.buttonText).toBe(firstButtonText);
      expect(result.current.hint).toBe(firstHint);
    });

    it('should recompute when isSpeaking changes', () => {
      const { result, rerender } = renderHook(() => useVoiceStatus());

      const firstStatus = result.current.status;

      // Change isSpeaking
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isSpeaking: true,
      });

      rerender();

      // Should be different reference
      expect(result.current.status).not.toBe(firstStatus);
      expect(result.current.status.text).toBe('Speaking...');
    });

    it('should recompute when isListening changes', () => {
      const { result, rerender } = renderHook(() => useVoiceStatus());

      const firstButtonText = result.current.buttonText;

      // Change isListening
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });

      rerender();

      // Should be different value
      expect(result.current.buttonText).not.toBe(firstButtonText);
      expect(result.current.buttonText).toBe('Stop Listening');
    });
  });

  describe('combined states', () => {
    it('should handle full conversation flow states', () => {
      // Step 1: Start listening
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });

      let { result, rerender } = renderHook(() => useVoiceStatus());
      expect(result.current.status.text).toBe('Listening for wake word...');
      expect(result.current.hint).toBe('Say "Go" to activate');

      // Step 2: Wake word detected
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        wakeWordDetected: true,
      });
      rerender();
      expect(result.current.status.text).toBe('Wake word detected');
      expect(result.current.hint).toBe('Speak your question...');

      // Step 3: Recording
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        wakeWordDetected: true,
        isRecording: true,
      });
      rerender();
      expect(result.current.status.text).toBe('Recording...');
      expect(result.current.hint).toBe('Recording... speak now!');
      expect(result.current.isActive).toBe(true);

      // Step 4: Processing
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        isProcessing: true,
      });
      rerender();
      expect(result.current.status.text).toBe('Transcribing...');
      expect(result.current.isActive).toBe(true);

      // Step 5: Speaking
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        isSpeaking: true,
      });
      rerender();
      expect(result.current.status.text).toBe('Speaking...');
      expect(result.current.isActive).toBe(true);

      // Step 6: Back to listening
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });
      rerender();
      expect(result.current.status.text).toBe('Listening for wake word...');
      expect(result.current.isActive).toBe(false);
    });
  });
});
