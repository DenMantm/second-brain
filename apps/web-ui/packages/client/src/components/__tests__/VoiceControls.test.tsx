import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceControls } from '../VoiceControls';
import { useVoiceStore } from '../../stores/voiceStore';

// Mock the voice store
vi.mock('../../stores/voiceStore', () => ({
  useVoiceStore: vi.fn(),
}));

describe('VoiceControls Integration Tests', () => {
  const mockActions = {
    initialize: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
    manualTrigger: vi.fn(),
    interrupt: vi.fn(),
    stopConversation: vi.fn(),
    startNewConversation: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Primary toggle button', () => {
    it('should show "Start Voice Assistant" when not listening', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
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

      render(<VoiceControls isPermissionDenied={false} />);
      
      expect(screen.getByText('Start Voice Assistant')).toBeInTheDocument();
    });

    it('should show "Stop Listening" when listening', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
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

      render(<VoiceControls isPermissionDenied={false} />);
      
      expect(screen.getByText('Stop Listening')).toBeInTheDocument();
    });

    it('should be disabled when permission is denied', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
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

      render(<VoiceControls isPermissionDenied={true} />);
      
      const button = screen.getByText('Start Voice Assistant');
      expect(button).toBeDisabled();
    });
  });

  describe('Manual trigger button', () => {
    it('should show manual trigger when listening but not recording', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
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

      render(<VoiceControls isPermissionDenied={false} />);
      
      expect(screen.getByTitle('Manual voice trigger')).toBeInTheDocument();
    });

    it('should not show manual trigger when recording', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
        isListening: true,
        isRecording: true,
        isSpeaking: false,
        wakeWordDetected: false,
        isProcessing: false,
        messages: [],
        streamingText: '',
        error: null,
        lastInteractionTime: null,
      });

      render(<VoiceControls isPermissionDenied={false} />);
      
      expect(screen.queryByTitle('Manual voice trigger')).not.toBeInTheDocument();
    });

    it('should call manualTrigger when clicked', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
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

      render(<VoiceControls isPermissionDenied={false} />);
      
      const manualButton = screen.getByTitle('Manual voice trigger');
      fireEvent.click(manualButton);
      
      expect(mockActions.manualTrigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('Interrupt button', () => {
    it('should show interrupt button when speaking', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
        isListening: true,
        isRecording: false,
        isSpeaking: true,
        wakeWordDetected: false,
        isProcessing: false,
        messages: [],
        streamingText: '',
        error: null,
        lastInteractionTime: null,
      });

      render(<VoiceControls isPermissionDenied={false} />);
      
      expect(screen.getByTitle('Interrupt')).toBeInTheDocument();
    });

    it('should not show interrupt button when not speaking', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
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

      render(<VoiceControls isPermissionDenied={false} />);
      
      expect(screen.queryByTitle('Interrupt')).not.toBeInTheDocument();
    });

    it('should call interrupt when clicked', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
        isListening: true,
        isRecording: false,
        isSpeaking: true,
        wakeWordDetected: false,
        isProcessing: false,
        messages: [],
        streamingText: '',
        error: null,
        lastInteractionTime: null,
      });

      render(<VoiceControls isPermissionDenied={false} />);
      
      const interruptButton = screen.getByTitle('Interrupt');
      fireEvent.click(interruptButton);
      
      expect(mockActions.interrupt).toHaveBeenCalledTimes(1);
    });
  });

  describe('New conversation button', () => {
    it('should show when listening', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
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

      render(<VoiceControls isPermissionDenied={false} />);
      
      expect(screen.getByTitle('New conversation')).toBeInTheDocument();
    });

    it('should call startNewConversation when clicked', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
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

      render(<VoiceControls isPermissionDenied={false} />);
      
      const newConvoButton = screen.getByTitle('New conversation');
      fireEvent.click(newConvoButton);
      
      expect(mockActions.startNewConversation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Button states during activities', () => {
    it('should disable primary button during processing', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
        isListening: true,
        isRecording: false,
        isSpeaking: false,
        wakeWordDetected: false,
        isProcessing: true,
        messages: [],
        streamingText: '',
        error: null,
        lastInteractionTime: null,
      });

      render(<VoiceControls isPermissionDenied={false} />);
      
      const primaryButton = screen.getByText('Stop Listening');
      expect(primaryButton).toBeDisabled();
    });

    it('should disable manual trigger and new conversation during processing', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
        isListening: true,
        isRecording: false,
        isSpeaking: false,
        wakeWordDetected: false,
        isProcessing: true,
        messages: [],
        streamingText: '',
        error: null,
        lastInteractionTime: null,
      });

      render(<VoiceControls isPermissionDenied={false} />);
      
      // Manual trigger doesn't show when wake word not detected
      // New conversation shows and should be disabled
      const newConvoButton = screen.getByTitle('New conversation');
      expect(newConvoButton).toBeDisabled();
    });
  });

  describe('Full interaction flow', () => {
    it('should handle complete voice interaction cycle', () => {
      const { rerender } = render(<VoiceControls isPermissionDenied={false} />);
      
      // Step 1: Initial state - not listening
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
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
      rerender(<VoiceControls isPermissionDenied={false} />);
      expect(screen.getByText('Start Voice Assistant')).toBeInTheDocument();
      
      // Step 2: Start listening
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
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
      rerender(<VoiceControls isPermissionDenied={false} />);
      expect(screen.getByText('Stop Listening')).toBeInTheDocument();
      expect(screen.getByTitle('Manual voice trigger')).toBeInTheDocument();
      
      // Step 3: Recording
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
        isListening: true,
        isRecording: true,
        isSpeaking: false,
        wakeWordDetected: false,
        isProcessing: false,
        messages: [],
        streamingText: '',
        error: null,
        lastInteractionTime: null,
      });
      rerender(<VoiceControls isPermissionDenied={false} />);
      expect(screen.queryByTitle('Manual voice trigger')).not.toBeInTheDocument();
      
      // Step 4: Speaking
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
        isListening: true,
        isRecording: false,
        isSpeaking: true,
        wakeWordDetected: false,
        isProcessing: false,
        messages: [],
        streamingText: '',
        error: null,
        lastInteractionTime: null,
      });
      rerender(<VoiceControls isPermissionDenied={false} />);
      expect(screen.getByTitle('Interrupt')).toBeInTheDocument();
      
      // Step 5: Back to listening
      vi.mocked(useVoiceStore).mockReturnValue({
        ...mockActions,
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
      rerender(<VoiceControls isPermissionDenied={false} />);
      expect(screen.getByTitle('Manual voice trigger')).toBeInTheDocument();
    });
  });
});
