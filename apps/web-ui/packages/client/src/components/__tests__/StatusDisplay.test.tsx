import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusDisplay } from '../StatusDisplay';
import { useVoiceStore } from '../../stores/voiceStore';

// Mock the voice store
vi.mock('../../stores/voiceStore', () => ({
  useVoiceStore: vi.fn(),
}));

describe('StatusDisplay Integration Tests', () => {
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
    vi.clearAllMocks();
  });

  describe('Status text display', () => {
    it('should show "Ready" when idle', () => {
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);

      render(<StatusDisplay />);
      
      expect(screen.getByText('⏸️')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('should show "Listening for wake word..." when listening', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('👂')).toBeInTheDocument();
      expect(screen.getByText('Listening for wake word...')).toBeInTheDocument();
    });

    it('should show "Wake word detected" when wake word is detected', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        wakeWordDetected: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('👂')).toBeInTheDocument();
      expect(screen.getByText('Wake word detected')).toBeInTheDocument();
    });

    it('should show "Recording..." when recording', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isRecording: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('🎤')).toBeInTheDocument();
      expect(screen.getByText('Recording...')).toBeInTheDocument();
    });

    it('should show "Transcribing..." when processing', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isProcessing: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('⏳')).toBeInTheDocument();
      expect(screen.getByText('Transcribing...')).toBeInTheDocument();
    });

    it('should show "Speaking..." when AI is speaking', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isSpeaking: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('🔊')).toBeInTheDocument();
      expect(screen.getByText('Speaking...')).toBeInTheDocument();
    });
  });

  describe('Hint text display', () => {
    it('should show wake word hint when listening', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('Say "Go" to activate')).toBeInTheDocument();
    });

    it('should show manual trigger hint when wake word detected', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        wakeWordDetected: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('Speak your question...')).toBeInTheDocument();
    });

    it('should show recording hint when recording', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isRecording: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('Recording... speak now!')).toBeInTheDocument();
    });

    it('should not show hint when idle', () => {
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);

      render(<StatusDisplay />);
      
      const hintElement = screen.queryByText(/Say|Press|Speak/);
      expect(hintElement).not.toBeInTheDocument();
    });
  });

  describe('Visualization display', () => {
    it('should show visualization when listening', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });

      const { container } = render(<StatusDisplay />);
      
      const visualization = container.querySelector('.visualization');
      expect(visualization).toBeInTheDocument();
    });

    it('should show active visualization when recording', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        isRecording: true,
      });

      const { container } = render(<StatusDisplay />);
      
      const bars = container.querySelectorAll('.bar.active');
      expect(bars.length).toBeGreaterThan(0);
    });

    it('should not show visualization when not listening', () => {
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);

      const { container } = render(<StatusDisplay />);
      
      const visualization = container.querySelector('.visualization');
      expect(visualization).not.toBeInTheDocument();
    });
  });

  describe('Status priority', () => {
    it('should prioritize speaking over all other states', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        isRecording: true,
        isProcessing: true,
        isSpeaking: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('Speaking...')).toBeInTheDocument();
    });

    it('should prioritize processing over recording', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        isRecording: true,
        isProcessing: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('Transcribing...')).toBeInTheDocument();
    });

    it('should prioritize recording over wake word', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        wakeWordDetected: true,
        isRecording: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('Recording...')).toBeInTheDocument();
    });

    it('should prioritize wake word over listening', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        wakeWordDetected: true,
      });

      render(<StatusDisplay />);
      
      expect(screen.getByText('Wake word detected')).toBeInTheDocument();
    });
  });

  describe('Full conversation flow', () => {
    it('should show correct status through complete interaction', () => {
      const { rerender } = render(<StatusDisplay />);
      
      // Step 1: Ready
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);
      rerender(<StatusDisplay />);
      expect(screen.getByText('Ready')).toBeInTheDocument();
      
      // Step 2: Listening
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });
      rerender(<StatusDisplay />);
      expect(screen.getByText('Listening for wake word...')).toBeInTheDocument();
      expect(screen.getByText('Say "Go" to activate')).toBeInTheDocument();
      
      // Step 3: Wake word detected
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        wakeWordDetected: true,
      });
      rerender(<StatusDisplay />);
      expect(screen.getByText('Wake word detected')).toBeInTheDocument();
      expect(screen.getByText('Speak your question...')).toBeInTheDocument();
      
      // Step 4: Recording
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        wakeWordDetected: true,
        isRecording: true,
      });
      rerender(<StatusDisplay />);
      expect(screen.getByText('Recording...')).toBeInTheDocument();
      expect(screen.getByText('Recording... speak now!')).toBeInTheDocument();
      
      // Step 5: Processing
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        isProcessing: true,
      });
      rerender(<StatusDisplay />);
      expect(screen.getByText('Transcribing...')).toBeInTheDocument();
      
      // Step 6: Speaking
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
        isSpeaking: true,
      });
      rerender(<StatusDisplay />);
      expect(screen.getByText('Speaking...')).toBeInTheDocument();
      
      // Step 7: Back to listening
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        isListening: true,
      });
      rerender(<StatusDisplay />);
      expect(screen.getByText('Listening for wake word...')).toBeInTheDocument();
    });
  });
});
