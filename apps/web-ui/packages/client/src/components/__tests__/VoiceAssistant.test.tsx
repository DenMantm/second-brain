import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import VoiceAssistant from '../VoiceAssistant';
import { useVoiceStore } from '../../stores/voiceStore';

// Mock the voice store
vi.mock('../../stores/voiceStore', () => ({
  useVoiceStore: vi.fn(),
}));

// Mock child components to test integration
vi.mock('../StatusDisplay', () => ({
  StatusDisplay: () => <div data-testid="status-display">Status Display</div>,
}));

vi.mock('../VoiceControls', () => ({
  VoiceControls: ({ isPermissionDenied }: { isPermissionDenied: boolean }) => (
    <div data-testid="voice-controls" data-permission-denied={isPermissionDenied}>
      Voice Controls
    </div>
  ),
}));

describe('VoiceAssistant Integration Tests', () => {
  const defaultState = {
    messages: [],
    streamingText: '',
    isListening: false,
    isRecording: false,
    isSpeaking: false,
    wakeWordDetected: false,
    isProcessing: false,
    error: null,
    lastInteractionTime: null,
  };

  // Mock navigator.permissions
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful permission query
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: vi.fn().mockResolvedValue({
          state: 'granted',
          onchange: null,
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  describe('Component composition', () => {
    it('should render StatusDisplay component', () => {
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);

      render(<VoiceAssistant />);
      
      expect(screen.getByTestId('status-display')).toBeInTheDocument();
    });

    it('should render VoiceControls component', () => {
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);

      render(<VoiceAssistant />);
      
      expect(screen.getByTestId('voice-controls')).toBeInTheDocument();
    });

    it('should render conversation history', () => {
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);

      const { container } = render(<VoiceAssistant />);
      
      const conversationHistory = container.querySelector('.conversation-history');
      expect(conversationHistory).toBeInTheDocument();
    });
  });

  describe('Microphone permission handling', () => {
    it('should pass permission state to VoiceControls', async () => {
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);

      render(<VoiceAssistant />);
      
      // Wait for permission check to complete
      await vi.waitFor(() => {
        const controls = screen.getByTestId('voice-controls');
        expect(controls.getAttribute('data-permission-denied')).toBe('false');
      });
    });

    it('should disable controls when permission is denied', async () => {
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);
      
      // Mock denied permission
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: vi.fn().mockResolvedValue({
            state: 'denied',
            onchange: null,
          }),
        },
        writable: true,
        configurable: true,
      });

      render(<VoiceAssistant />);
      
      await vi.waitFor(() => {
        const controls = screen.getByTestId('voice-controls');
        expect(controls.getAttribute('data-permission-denied')).toBe('true');
      });
    });
  });

  describe('Conversation display', () => {
    it('should display user messages', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date() },
        ],
      });

      render(<VoiceAssistant />);
      
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('👤 You')).toBeInTheDocument();
    });

    it('should display assistant messages', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        messages: [
          { role: 'assistant', content: 'Hi there!', timestamp: new Date() },
        ],
      });

      render(<VoiceAssistant />);
      
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
      expect(screen.getByText('🤖 Assistant')).toBeInTheDocument();
    });

    it('should display system messages', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        messages: [
          { role: 'system', content: 'Tool call: search_youtube', timestamp: new Date() },
        ],
      });

      render(<VoiceAssistant />);

      expect(screen.getByText('Tool call: search_youtube')).toBeInTheDocument();
      expect(screen.getByText('ℹ️ System')).toBeInTheDocument();
    });

    it('should display streaming text', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        streamingText: 'Typing in progress...',
      });

      render(<VoiceAssistant />);
      
      expect(screen.getByText('Typing in progress...')).toBeInTheDocument();
      // Streaming messages don't show the role label, just the content
    });

    it('should display multiple messages in order', () => {
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        messages: [
          { role: 'user', content: 'First message', timestamp: new Date() },
          { role: 'assistant', content: 'Second message', timestamp: new Date() },
          { role: 'user', content: 'Third message', timestamp: new Date() },
        ],
      });

      const { container } = render(<VoiceAssistant />);
      
      const messages = container.querySelectorAll('.message');
      expect(messages).toHaveLength(3);
      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
      expect(screen.getByText('Third message')).toBeInTheDocument();
    });

    it('should show empty state when no messages', () => {
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);

      const { container } = render(<VoiceAssistant />);
      
      const messages = container.querySelectorAll('.message');
      expect(messages).toHaveLength(0);
    });
  });

  describe('Layout structure', () => {
    it('should have correct CSS classes', () => {
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);

      const { container } = render(<VoiceAssistant />);
      
      expect(container.querySelector('.voice-assistant')).toBeInTheDocument();
      expect(container.querySelector('.conversation-history')).toBeInTheDocument();
    });

    it('should maintain component order', () => {
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);

      const { container } = render(<VoiceAssistant />);
      
      const voiceAssistant = container.querySelector('.voice-assistant');
      const children = voiceAssistant?.children;
      
      expect(children).toHaveLength(3);
      expect(children?.[0]).toHaveAttribute('data-testid', 'status-display');
      expect(children?.[1]).toHaveAttribute('data-testid', 'voice-controls');
      expect(children?.[2]).toHaveClass('conversation-history');
    });
  });

  describe('State reactivity', () => {
    it('should update when messages change', () => {
      const { rerender } = render(<VoiceAssistant />);
      
      // Initial state - no messages
      vi.mocked(useVoiceStore).mockReturnValue(defaultState);
      rerender(<VoiceAssistant />);
      expect(screen.queryByText('Test message')).not.toBeInTheDocument();
      
      // Add a message
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        messages: [
          { role: 'user', content: 'Test message', timestamp: new Date() },
        ],
      });
      rerender(<VoiceAssistant />);
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should update when streaming text changes', () => {
      const { rerender } = render(<VoiceAssistant />);
      
      // Start streaming
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        streamingText: 'Hello',
      });
      rerender(<VoiceAssistant />);
      expect(screen.getByText('Hello')).toBeInTheDocument();
      
      // Update streaming text
      vi.mocked(useVoiceStore).mockReturnValue({
        ...defaultState,
        streamingText: 'Hello world',
      });
      rerender(<VoiceAssistant />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });
});
