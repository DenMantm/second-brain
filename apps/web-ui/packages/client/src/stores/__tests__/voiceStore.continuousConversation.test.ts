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
    init: vi.fn().mockResolvedValue(undefined), // Alias for initialize
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    onDetected: vi.fn(),
    getIsListening: vi.fn(() => false),
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
    segments: [],
    language: 'en',
    language_probability: 0.95,
    duration: 1.0,
    inference_time: 0.5,
  }),
}));

vi.mock('../../services/tts', () => ({
  stopAudio: vi.fn(),
}));

vi.mock('../../services/llm', () => ({
  generateCompletionStream: vi.fn().mockImplementation(async function* () {
    yield { type: 'text', content: 'Test response' };
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
  StreamingOrchestrator: vi.fn().mockImplementation((options) => ({
    onSentenceDetected: vi.fn(),
    onTTSStart: vi.fn(),
    onTTSComplete: vi.fn(),
    onTTSError: vi.fn(),
    onComplete: vi.fn(),
    processTextStream: vi.fn(),
    processTextChunk: vi.fn(async () => {}),
    flush: vi.fn(async () => {
      await options?.onComplete?.();
    }),
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
      segments: [],
      language: 'en',
      language_probability: 0,
      duration: 0,
      inference_time: 0,
    });
    
    const wakeWord = getWakeWordDetection();
    
    // Initialize wake word first
    await wakeWord.initialize(['go'], 0.8);
    
    const store = useVoiceStore.getState();
    store.setWakeWordEnabled(true);
    
    // Mock getUserMedia
    Object.defineProperty(global.navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        } as any),
      },
    });
    
    await store.startRecording();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify wake word resumed when no speech detected
    expect(wakeWord.start).toHaveBeenCalled();
  });

  it('should resume wake word when only whitespace transcript detected', async () => {
    const { transcribeAudio } = await import('../../services/stt');
    const { getWakeWordDetection } = await import('../../services/wakeWord');
    
    // Mock whitespace-only transcription
    vi.mocked(transcribeAudio).mockResolvedValue({
      text: '   \n  \t  ',
      segments: [],
      language: 'en',
      language_probability: 0.1,
      duration: 0.2,
      inference_time: 0.1,
    });
    
    const wakeWord = getWakeWordDetection();
    
    // Initialize wake word first
    await wakeWord.initialize(['go'], 0.8);
    
    const store = useVoiceStore.getState();
    store.setWakeWordEnabled(true);
    
    Object.defineProperty(global.navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        } as any),
      },
    });
    
    await store.startRecording();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(wakeWord.start).toHaveBeenCalled();
  });

  it('should NOT resume wake word when valid speech detected', async () => {
    const { transcribeAudio } = await import('../../services/stt');
    const { getWakeWordDetection } = await import('../../services/wakeWord');
    
    // Mock valid speech
    vi.mocked(transcribeAudio).mockResolvedValue({
      text: 'What is the weather?',
      segments: [],
      language: 'en',
      language_probability: 0.95,
      duration: 2.0,
      inference_time: 0.8,
    });
    
    const wakeWord = getWakeWordDetection();
    
    // Initialize wake word first
    await wakeWord.initialize(['go'], 0.8);
    vi.clearAllMocks();
    
    const store = useVoiceStore.getState();
    store.setWakeWordEnabled(true);
    
    Object.defineProperty(global.navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        } as any),
      },
    });
    
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

    store.addMessage('system', 'Tool call: search_youtube');
    state = useVoiceStore.getState();
    expect(state.messages).toHaveLength(3);
    expect(state.messages[2]).toMatchObject({
      role: 'system',
      content: 'Tool call: search_youtube',
    });
  });

  it('should clear speaking state after tool call in stream', async () => {
    const store = useVoiceStore.getState();
    const { generateCompletionStream } = await import('../../services/llm');

    vi.mocked(generateCompletionStream).mockImplementationOnce(async function* () {
      yield {
        type: 'tool_call',
        data: {
          name: 'search_youtube',
          args: { query: 'scarecrow' },
          result: { success: true, message: 'Found 2 videos for "scarecrow"' },
        },
      };
      yield { type: 'text', content: 'Here are some results.' };
    });

    const originalStartRecording = store.startRecording;
    let callCount = 0;
    (store as any).startRecording = async () => {
      callCount += 1;
      if (callCount > 1) {
        return;
      }
      return originalStartRecording();
    };

    await store.startRecording();

    const state = useVoiceStore.getState();
    expect(state.isSpeaking).toBe(false);
    expect(state.messages.some(m => m.role === 'system')).toBe(true);
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
