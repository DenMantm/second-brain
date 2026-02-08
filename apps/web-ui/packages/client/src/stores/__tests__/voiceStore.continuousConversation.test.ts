import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVoiceStore } from '../voiceStore';

// Mock all services
vi.mock('@tensorflow/tfjs', () => ({
  ready: vi.fn().mockResolvedValue(undefined),
  browser: { fromPixels: vi.fn() },
  tidy: vi.fn((fn) => fn()),
  dispose: vi.fn(),
}));

vi.mock('../../services/wakeWord', () => {
  const mockService = {
    isInitialized: vi.fn(() => true),
    isListening: false,
    targetWords: ['go'],
    threshold: 0.8,
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    onDetected: vi.fn(),
  };
  return { getWakeWordDetection: () => mockService };
});

vi.mock('../../services/audioRecorder', () => ({
  getAudioRecorder: () => ({
    isRecording: false,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(new Float32Array()),
  }),
}));

vi.mock('../../services/stt', () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    text: 'Test speech',
    confidence: 0.95,
  }),
}));

vi.mock('../../services/tts', () => ({
  stopAudio: vi.fn(),
}));

vi.mock('../../services/llm', () => ({
  generateCompletionStream: vi.fn().mockResolvedValue({
    text: 'Test response',
  }),
}));

vi.mock('../../services/conversations', () => ({
  createNewConversation: vi.fn().mockResolvedValue({
    id: 'test-conv-id',
    title: 'Test',
    createdAt: new Date(),
  }),
  fetchConversations: vi.fn().mockResolvedValue([]),
  loadConversation: vi.fn(),
  deleteConversation: vi.fn(),
}));

vi.mock('../../services/streamingOrchestrator', () => ({
  StreamingOrchestrator: vi.fn().mockImplementation(() => ({
    onSentenceDetected: vi.fn(),
    onTTSStart: vi.fn(),
    onTTSComplete: vi.fn(),
    onTTSError: vi.fn(),
    onComplete: vi.fn(),
    processTextStream: vi.fn(),
  })),
}));

describe('VoiceStore - Continuous Conversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVoiceStore.setState({
      isListening: false,
      isRecording: false,
      isProcessing: false,
      isSpeaking: false,
      wakeWordEnabled: true,
      wakeWordDetected: false,
      currentTranscript: '',
      messages: [],
      currentConversationId: null,
    });
  });

  it('should resume wake word when empty transcript detected', async () => {
    const { transcribeAudio } = await import('../../services/stt');
    const { getWakeWordDetection } = await import('../../services/wakeWord');
    
    // Mock empty transcription (silence)
    vi.mocked(transcribeAudio).mockResolvedValue({
      text: '',
      confidence: 0,
    });
    
    const wakeWord = getWakeWordDetection();
    wakeWord.isListening = false;
    
    const store = useVoiceStore.getState();
    
    // Mock getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      } as any),
    } as any;
    
    await store.startRecording();
    
    // Verify wake word resumed when no speech detected
    expect(wakeWord.start).toHaveBeenCalled();
  });

  it('should resume wake word when only whitespace transcript detected', async () => {
    const { transcribeAudio } = await import('../../services/stt');
    const { getWakeWordDetection } = await import('../../services/wakeWord');
    
    // Mock whitespace-only transcription
    vi.mocked(transcribeAudio).mockResolvedValue({
      text: '   \n  \t  ',
      confidence: 0.1,
    });
    
    const wakeWord = getWakeWordDetection();
    wakeWord.isListening = false;
    
    const store = useVoiceStore.getState();
    
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      } as any),
    } as any;
    
    await store.startRecording();
    
    expect(wakeWord.start).toHaveBeenCalled();
  });

  it('should NOT resume wake word when valid speech detected', async () => {
    const { transcribeAudio } = await import('../../services/stt');
    const { getWakeWordDetection } = await import('../../services/wakeWord');
    
    // Mock valid speech
    vi.mocked(transcribeAudio).mockResolvedValue({
      text: 'What is the weather?',
      confidence: 0.95,
    });
    
    const wakeWord = getWakeWordDetection();
    wakeWord.isListening = false;
    vi.clearAllMocks();
    
    const store = useVoiceStore.getState();
    
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      } as any),
    } as any;
    
    // We just want to verify the logic doesn't call wake word on valid speech
    // The full LLM flow will fail without all mocks, so we'll just check
    // that the transcript was set correctly before that point
    try {
      await store.startRecording();
    } catch (error) {
      // Expected - LLM flow not fully mocked
    }
    
    // Wake word should NOT be started when processing valid speech
    expect(wakeWord.start).not.toHaveBeenCalled();
    
    // Verify transcript was set
    const state = useVoiceStore.getState();
    expect(state.currentTranscript).toBe('What is the weather?');
  });

  it('should track speaking state correctly', () => {
    const store = useVoiceStore.getState();
    
    expect(store.isSpeaking).toBe(false);
    
    store.setSpeaking(true);
    const updatedState = useVoiceStore.getState();
    expect(updatedState.isSpeaking).toBe(true);
    
    store.setSpeaking(false);
    const finalState = useVoiceStore.getState();
    expect(finalState.isSpeaking).toBe(false);
  });

  it('should maintain conversation message history', () => {
    const store = useVoiceStore.getState();
    
    store.addMessage('user', 'Hello');
    let state = useVoiceStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      role: 'user',
      content: 'Hello',
    });
    
    store.addMessage('assistant', 'Hi!');
    state = useVoiceStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hi!',
    });
  });

  it('should handle wake word detection state', () => {
    const store = useVoiceStore.getState();
    
    expect(store.wakeWordDetected).toBe(false);
    
    store.setWakeWordDetected(true);
    let state = useVoiceStore.getState();
    expect(state.wakeWordDetected).toBe(true);
    
    store.setWakeWordDetected(false);
    state = useVoiceStore.getState();
    expect(state.wakeWordDetected).toBe(false);
  });
});
