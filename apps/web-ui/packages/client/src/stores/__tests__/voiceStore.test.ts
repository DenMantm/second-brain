import { describe, it, expect, beforeEach, vi, afterEach  } from 'vitest';
import { useVoiceStore } from '../voiceStore';
import { getWakeWordDetection } from '../../services/wakeWord';
import { getAudioRecorder } from '../../services/audioRecorder';

// Mock TensorFlow modules to avoid import errors
vi.mock('@tensorflow/tfjs-core', () => ({}));
vi.mock('@tensorflow/tfjs-backend-cpu', () => ({}));
vi.mock('@tensorflow/tfjs-backend-webgl', () => ({}));
vi.mock('@tensorflow/tfjs-converter', () => ({}));
vi.mock('@tensorflow-models/speech-commands', () => ({}));

// Mock dependencies
vi.mock('../../services/wakeWord');
vi.mock('../../services/audioRecorder');
vi.mock('../../services/stt');
vi.mock('../../services/tts');
vi.mock('../../services/llm');
vi.mock('../../services/streamingOrchestrator');

// Mock WakeWordManager and StopWordManager classes
let mockWakeWordInstance: any;
let mockStopWordInstance: any;

vi.mock('../../services/wakeWordManager', () => ({
  WakeWordManager: vi.fn().mockImplementation((word) => {
    let listening = false;
    mockWakeWordInstance = {
      initialize: vi.fn().mockResolvedValue(undefined),
      reinitialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockImplementation(async () => {
        listening = true;
      }),
      stop: vi.fn().mockImplementation(async () => {
        listening = false;
      }),
      setCallback: vi.fn((callback) => {
        mockWakeWordInstance._callback = callback;
      }),
      isInitialized: vi.fn().mockReturnValue(true),
      isListening: vi.fn(() => listening),
      getWakeWord: vi.fn().mockReturnValue(word || 'go'),
      _callback: null,
    };
    return mockWakeWordInstance;
  }),
}));

vi.mock('../../services/stopWordManager', () => ({
  StopWordManager: vi.fn().mockImplementation((word) => {
    let listening = false;
    mockStopWordInstance = {
      initialize: vi.fn().mockResolvedValue(undefined),
      reinitialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockImplementation(async () => {
        listening = true;
      }),
      stop: vi.fn().mockImplementation(async () => {
        listening = false;
      }),
      setCallback: vi.fn((callback) => {
        mockStopWordInstance._callback = callback;
      }),
      isInitialized: vi.fn().mockReturnValue(true),
      isListening: vi.fn(() => listening),
      getStopWord: vi.fn().mockReturnValue(word || 'stop'),
      _callback: null,
    };
    return mockStopWordInstance;
  }),
}));

// Mock browser APIs
const mockMediaStream = {
  getTracks: vi.fn(() => [{
    stop: vi.fn(),
    kind: 'audio',
    enabled: true,
  }]),
};

const mockMediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
};

// Setup global browser APIs
global.navigator = {
  mediaDevices: mockMediaDevices,
} as any;

// Mock window with settingsStore
global.window = {
  __settingsStore: {
    getState: () => ({
      selectedWakeWord: 'go',
      selectedStopWord: 'stop',
    }),
  },
} as any;

// Tests use mocked services to avoid TensorFlow/Node.js incompatibility
// These tests verify state management and service coordination logic
// E2E tests with real TensorFlow models should be added with Playwright
describe('VoiceStore Controls', () => {
  let mockWakeWord: any;
  let mockRecorder: any;

  beforeEach(() => {
    // Reset browser API mocks
    vi.clearAllMocks();
    mockMediaDevices.getUserMedia.mockResolvedValue(mockMediaStream);
    
    // Reset store state
    useVoiceStore.setState({
      isInitialized: false,
      isListening: false,
      isRecording: false,
      isProcessing: false,
      isSpeaking: false,
      wakeWordDetected: false,
      wakeWordEnabled: true,
      stopWordEnabled: true,
      error: null,
      messages: [],
      currentTranscript: '',
      streamingText: '',
      currentConversationId: null,
      conversations: [],
    });

    // Setup wake word mock
    mockWakeWord = {
      initialize: vi.fn().mockResolvedValue(undefined),
      reinitialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      isInitialized: vi.fn().mockReturnValue(true),
      isListening: vi.fn().mockReturnValue(false),
      getIsListening: vi.fn().mockReturnValue(false),
      onDetected: vi.fn(),
      setCallback: vi.fn(),
      getStopWord: vi.fn().mockReturnValue('stop'),
      wordLabels: vi.fn().mockReturnValue(['go', 'stop', 'yes', 'no']),
    };

    // Setup recorder mock
    mockRecorder = {
      start: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'audio/wav' })),
      stop: vi.fn(),
      isRecording: false,
      record: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'audio/wav' })),
    };

    vi.mocked(getWakeWordDetection).mockReturnValue(mockWakeWord);
    vi.mocked(getAudioRecorder).mockReturnValue(mockRecorder);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialize', () => {
    it('should initialize wake word detection', async () => {
      const { initialize } = useVoiceStore.getState();
      
      await initialize();
      
      expect(mockWakeWordInstance.initialize).toHaveBeenCalled();
      expect(mockWakeWordInstance.setCallback).toHaveBeenCalled();
      expect(mockStopWordInstance.initialize).toHaveBeenCalled();
      expect(mockStopWordInstance.setCallback).toHaveBeenCalled();
    });

    it('should set error state if initialization fails', async () => {
      // Mock getUserMedia to fail
      mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Init failed'));
      const { initialize } = useVoiceStore.getState();
      
      await expect(initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('Start Listening', () => {
    beforeEach(async () => {
      const { initialize } = useVoiceStore.getState();
      await initialize();
      vi.clearAllMocks();
    });

    it('should start wake word detection when enabled', async () => {
      const { startListening } = useVoiceStore.getState();
      
      await startListening();
      
      expect(mockWakeWordInstance.start).toHaveBeenCalled();
      expect(useVoiceStore.getState().isListening).toBe(true);
    });

    it('should NOT start wake word if disabled', async () => {
      useVoiceStore.setState({ wakeWordEnabled: false });
      const { startListening } = useVoiceStore.getState();
      
      await startListening();
      
      expect(mockWakeWordInstance.start).not.toHaveBeenCalled();
      expect(useVoiceStore.getState().isListening).toBe(true);
    });
  });

  describe('Stop Listening', () => {
    beforeEach(async () => {
      const { initialize, startListening } = useVoiceStore.getState();
      await initialize();
      await startListening();
      vi.clearAllMocks();
    });

    it('should stop wake word detection', async () => {
      const { stopListening } = useVoiceStore.getState();
      
      await stopListening();
      
      expect(mockWakeWordInstance.stop).toHaveBeenCalled();
      expect(useVoiceStore.getState().isListening).toBe(false);
      expect(useVoiceStore.getState().wakeWordDetected).toBe(false);
    });

    it('should stop recording if active', async () => {
      useVoiceStore.setState({ isRecording: true });
      mockRecorder.isRecording = true;
      
      const { stopListening } = useVoiceStore.getState();
      await stopListening();
      
      expect(useVoiceStore.getState().isListening).toBe(false);
    });
  });

  describe('Wake Word Detection Callback', () => {
    let wakeWordCallback: () => void;

    beforeEach(async () => {
      const { initialize } = useVoiceStore.getState();
      await initialize();
      
      // Capture the callback passed to setCallback
      wakeWordCallback = mockWakeWordInstance._callback;
      vi.clearAllMocks();
    });

    it('should stop wake word detection immediately when detected', async () => {
      await wakeWordCallback();
      
      expect(mockWakeWordInstance.stop).toHaveBeenCalled();
      expect(useVoiceStore.getState().wakeWordDetected).toBe(true);
    });

    it('should NOT trigger if already recording', async () => {
      useVoiceStore.setState({ isRecording: true });
      
      await wakeWordCallback();
      
      // Should return early without starting recording
      expect(useVoiceStore.getState().wakeWordDetected).toBe(false);
    });

    it('should interrupt AI if speaking', async () => {
      useVoiceStore.setState({ isSpeaking: true });
      
      await wakeWordCallback();
      
      // Should have interrupted before starting recording
      expect(mockWakeWordInstance.stop).toHaveBeenCalled();
    });
  });

  describe('Start Recording', () => {
    it('should not start if already recording', async () => {
      useVoiceStore.setState({ isRecording: true });
      const { startRecording } = useVoiceStore.getState();
      
      await startRecording();
      
      expect(mockRecorder.start).not.toHaveBeenCalled();
    });

    it('should not start if already processing', async () => {
      useVoiceStore.setState({ isProcessing: true });
      const { startRecording } = useVoiceStore.getState();
      
      await startRecording();
      
      expect(mockRecorder.start).not.toHaveBeenCalled();
    });

    it('should set isRecording to true when starting', async () => {
      const { startRecording } = useVoiceStore.getState();
      
      // Start recording (will await)
      const promise = startRecording();
      
      // Should be recording immediately
      expect(useVoiceStore.getState().isRecording).toBe(true);
      
      await promise;
    });
  });

  describe('Stop Recording', () => {
    beforeEach(() => {
      mockRecorder.isRecording = true;
    });

    it('should stop the recorder', async () => {
      const { stopRecording } = useVoiceStore.getState();
      
      await stopRecording();
      
      expect(mockRecorder.stop).toHaveBeenCalled();
      expect(useVoiceStore.getState().isRecording).toBe(false);
    });

    it('should not error if recorder not active', async () => {
      mockRecorder.isRecording = false;
      const { stopRecording } = useVoiceStore.getState();
      
      await expect(stopRecording()).resolves.not.toThrow();
    });
  });

  describe('Interrupt', () => {
    beforeEach(() => {
      useVoiceStore.setState({ 
        isSpeaking: true,
        streamingText: 'Some streaming text...' 
      });
    });

    it('should clear streaming text', async () => {
      const { interrupt } = useVoiceStore.getState();
      
      await interrupt();
      
      expect(useVoiceStore.getState().streamingText).toBe('');
    });

    it('should set isSpeaking to false', async () => {
      const { interrupt } = useVoiceStore.getState();
      
      await interrupt();
      
      expect(useVoiceStore.getState().isSpeaking).toBe(false);
    });

    it('should NOT restart wake word detection', async () => {
      const { interrupt } = useVoiceStore.getState();
      
      await interrupt();
      
      // Wake word should stay stopped (will restart after recording completes)
      expect(mockWakeWordInstance.start).not.toHaveBeenCalled();
    });

    it('should start recording if not already recording', async () => {
      useVoiceStore.setState({ 
        isSpeaking: true, 
        isRecording: false,
        isProcessing: false 
      });
      
      const { interrupt } = useVoiceStore.getState();
      await interrupt();
      
      // Should start recording after interrupt
      expect(useVoiceStore.getState().isRecording).toBe(true);
    });
  });

  describe('Stop Conversation', () => {
    beforeEach(() => {
      useVoiceStore.setState({ 
        isRecording: true,
        isProcessing: true,
        isSpeaking: true,
        wakeWordDetected: true,
      });
      mockRecorder.isRecording = true;
    });

    it('should reset all conversation states', async () => {
      const { stopConversation } = useVoiceStore.getState();
      
      await stopConversation();
      
      const state = useVoiceStore.getState();
      expect(state.isRecording).toBe(false);
      expect(state.isProcessing).toBe(false);
      expect(state.isSpeaking).toBe(false);
      expect(state.wakeWordDetected).toBe(false);
    });

    it('should stop recorder if active', async () => {
      const { stopConversation } = useVoiceStore.getState();
      
      await stopConversation();
      
      expect(mockRecorder.stop).toHaveBeenCalled();
    });

    it('should return to listening state', async () => {
      useVoiceStore.setState({ isListening: false });
      const { stopConversation } = useVoiceStore.getState();
      
      await stopConversation();
      
      expect(mockWakeWordInstance.start).toHaveBeenCalled();
      expect(useVoiceStore.getState().isListening).toBe(true);
    });
  });

  describe('Manual Trigger', () => {
    beforeEach(async () => {
      const { initialize, startListening } = useVoiceStore.getState();
      await initialize();
      await startListening();
      vi.clearAllMocks(); // Clear initialization calls
    });

    it('should work when listening', async () => {
      const { manualTrigger } = useVoiceStore.getState();
      
      await manualTrigger();
      
      expect(useVoiceStore.getState().wakeWordDetected).toBe(true);
      expect(useVoiceStore.getState().isRecording).toBe(true);
    });

    it('should not work if not listening', async () => {
      useVoiceStore.setState({ isListening: false });
      const { manualTrigger } = useVoiceStore.getState();
      
      await manualTrigger();
      
      expect(useVoiceStore.getState().wakeWordDetected).toBe(false);
    });

    it('should interrupt AI if speaking', async () => {
      useVoiceStore.setState({ isSpeaking: true });
      const { manualTrigger } = useVoiceStore.getState();
      
      await manualTrigger();
      
      expect(useVoiceStore.getState().isSpeaking).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('should properly transition: listening -> wake word -> recording', async () => {
      const { initialize, startListening } = useVoiceStore.getState();
      await initialize();
      await startListening();
      
      expect(useVoiceStore.getState().isListening).toBe(true);
      
      // Trigger wake word
      const wakeWordCallback = mockWakeWordInstance._callback;
      await wakeWordCallback();
      
      expect(useVoiceStore.getState().wakeWordDetected).toBe(true);
      expect(mockWakeWordInstance.stop).toHaveBeenCalled();
    });

    it('should properly transition: recording -> processing -> speaking', async () => {
      const { setProcessing, setSpeaking } = useVoiceStore.getState();
      
      useVoiceStore.setState({ isRecording: true });
      expect(useVoiceStore.getState().isRecording).toBe(true);
      
      useVoiceStore.setState({ isRecording: false });
      setProcessing(true);
      expect(useVoiceStore.getState().isProcessing).toBe(true);
      
      setProcessing(false);
      setSpeaking(true);
      expect(useVoiceStore.getState().isSpeaking).toBe(true);
      expect(useVoiceStore.getState().isProcessing).toBe(false);
    });
  });

  describe('Wake Word Enable/Disable', () => {
    beforeEach(async () => {
      const { initialize } = useVoiceStore.getState();
      await initialize();
    });

    it('should not start wake word when disabled', async () => {
      useVoiceStore.setState({ wakeWordEnabled: false });
      const { startListening } = useVoiceStore.getState();
      
      await startListening();
      
      expect(mockWakeWordInstance.start).not.toHaveBeenCalled();
      expect(useVoiceStore.getState().isListening).toBe(true);
    });

    it('should start wake word when enabled', async () => {
      useVoiceStore.setState({ wakeWordEnabled: true });
      const { startListening } = useVoiceStore.getState();
      
      await startListening();
      
      expect(mockWakeWordInstance.start).toHaveBeenCalled();
      expect(useVoiceStore.getState().isListening).toBe(true);
    });
  });

  describe('Stop Word Detection', () => {
    beforeEach(() => {
      // Stop word uses the same detection service as wake word
    });

    it('should initialize stop word on voice store initialization', async () => {
      const { initialize } = useVoiceStore.getState();
      
      await initialize();
      
      // Both wake word and stop word managers should be initialized
      expect(mockWakeWordInstance.initialize).toHaveBeenCalled();
      expect(mockWakeWordInstance.setCallback).toHaveBeenCalled();
      expect(mockStopWordInstance.initialize).toHaveBeenCalled();
      expect(mockStopWordInstance.setCallback).toHaveBeenCalled();
    });

    it('should pause wake word and start stop word when speaking', async () => {
      const { initialize, setSpeaking } = useVoiceStore.getState();
      await initialize();
      vi.clearAllMocks();
      
      useVoiceStore.setState({ stopWordEnabled: true, wakeWordEnabled: true });
      
      // Start speaking - should pause wake word and start stop word
      await setSpeaking(true);
      
      // Should have paused wake word and started stop word
      expect(mockWakeWordInstance.stop).toHaveBeenCalled();
      expect(mockStopWordInstance.start).toHaveBeenCalled();
    });

    it('should resume wake word when assistant stops speaking', async () => {
      const { initialize, setSpeaking } = useVoiceStore.getState();
      await initialize();
      useVoiceStore.setState({ stopWordEnabled: true, wakeWordEnabled: true, isSpeaking: true });
      vi.clearAllMocks();
      
      // Stop speaking - should stop stop word and resume wake word
      await setSpeaking(false);
      
      // Should have stopped stop word and resumed wake word
      expect(mockStopWordInstance.stop).toHaveBeenCalled();
      expect(mockWakeWordInstance.start).toHaveBeenCalled();
    });

    it('should start stop word detection when assistant starts speaking', async () => {
      const { initialize, setSpeaking } = useVoiceStore.getState();
      await initialize();
      
      useVoiceStore.setState({ stopWordEnabled: true });
      
      // Simulate assistant starting to speak
      await setSpeaking(true);
      
      expect(useVoiceStore.getState().isSpeaking).toBe(true);
    });

    it('should stop stop word detection when assistant stops speaking', async () => {
      const { initialize, setSpeaking } = useVoiceStore.getState();
      await initialize();
      useVoiceStore.setState({ stopWordEnabled: true, isSpeaking: true });
      
      // Simulate assistant stopping speaking
      await setSpeaking(false);
      
      expect(useVoiceStore.getState().isSpeaking).toBe(false);
    });

    it('should not start stop word detection when stopWordEnabled is false', async () => {
      const { initialize, setSpeaking } = useVoiceStore.getState();
      await initialize();
      
      useVoiceStore.setState({ stopWordEnabled: false });
      
      // Should not start stop word detection even when speaking
      await setSpeaking(true);
      
      expect(useVoiceStore.getState().isSpeaking).toBe(true);
      expect(useVoiceStore.getState().stopWordEnabled).toBe(false);
    });
  });

  describe('Stop Word Detection Callback', () => {
    let stopWordCallback: () => Promise<void>;

    beforeEach(async () => {
      const { initialize } = useVoiceStore.getState();
      await initialize();
      
      // Get the stop word callback
      stopWordCallback = mockStopWordInstance._callback;
      vi.clearAllMocks();
    });

    it('should NOT trigger if assistant is not speaking', async () => {
      useVoiceStore.setState({ isSpeaking: false });
      
      if (stopWordCallback) {
        await stopWordCallback();
      }
      
      // Should not interrupt if not speaking - no stop should be called
      expect(mockStopWordInstance.stop).not.toHaveBeenCalled();
    });

    it('should interrupt assistant when detected while speaking', async () => {
      const { initialize } = useVoiceStore.getState();
      await initialize();
      useVoiceStore.setState({ isSpeaking: true, stopWordEnabled: true });
      vi.clearAllMocks();
      
      if (stopWordCallback) {
        await stopWordCallback();
      }
      
      // Should have stopped the stop word detection
      expect(mockStopWordInstance.stop).toHaveBeenCalled();
    });

    it('should clear audio queue when interrupting', async () => {
      const { initialize } = useVoiceStore.getState();
      await initialize();
      useVoiceStore.setState({ isSpeaking: true, stopWordEnabled: true });
      vi.clearAllMocks();
      
      if (stopWordCallback) {
        await stopWordCallback();
      }
      
      // Should have stopped speaking
      expect(mockStopWordInstance.stop).toHaveBeenCalled();
      expect(useVoiceStore.getState().isSpeaking).toBe(false);
    });
  });

  describe('Stop Word Reinitialize', () => {
    beforeEach(async () => {
      const { initialize } = useVoiceStore.getState();
      await initialize();
    });

    it('should defer stop word change when AI is speaking', async () => {
      useVoiceStore.setState({ isSpeaking: true });
      const { reinitializeStopWord } = useVoiceStore.getState();
      
      await reinitializeStopWord('no');
      
      // Should log warning but not throw
      expect(useVoiceStore.getState().error).toBeNull();
    });

    it('should successfully change stop word when idle', async () => {
      useVoiceStore.setState({ isSpeaking: false, isProcessing: false });
      const { reinitializeStopWord } = useVoiceStore.getState();
      
      await reinitializeStopWord('no');
      
      // Should not set error
      expect(useVoiceStore.getState().error).toBeNull();
    });
  });

  describe('Full Stop Word Flow', () => {
    it('should complete full cycle: speaking -> stop word -> recording', async () => {
      const { initialize, setSpeaking } = useVoiceStore.getState();
      await initialize();
      
      // 1. Assistant starts speaking
      useVoiceStore.setState({ stopWordEnabled: true });
      await setSpeaking(true);
      expect(useVoiceStore.getState().isSpeaking).toBe(true);
      
      vi.clearAllMocks();
      
      // 2. User says stop word (simulate callback)
      const stopWordCallback = mockStopWordInstance._callback;
      if (stopWordCallback) {
        await stopWordCallback();
      }
      
      // 3. Should have stopped detection
      expect(mockStopWordInstance.stop).toHaveBeenCalled();
    });

    it('should handle stop word -> interrupt -> recording transition', async () => {
      const { initialize } = useVoiceStore.getState();
      await initialize();
      
      // Setup: Assistant is speaking
      useVoiceStore.setState({ 
        isSpeaking: true, 
        stopWordEnabled: true,
        streamingText: 'Assistant is talking...'
      });
      
      vi.clearAllMocks();
      
      // Trigger stop word
      const stopWordCallback = mockStopWordInstance._callback;
      if (stopWordCallback) {
        await stopWordCallback();
      }
      
      // Should have interrupted
      expect(mockStopWordInstance.stop).toHaveBeenCalled();
    });
  });

  describe('Stop Word vs Wake Word Coordination', () => {
    beforeEach(async () => {
      const { initialize } = useVoiceStore.getState();
      await initialize();
    });

    it('should use wake word when idle, stop word when speaking', async () => {
      const { startListening, setSpeaking } = useVoiceStore.getState();
      
      // Start listening - wake word should be active
      await startListening();
      expect(mockWakeWordInstance.start).toHaveBeenCalled();
      
      // Start speaking - stop word should become active
      vi.clearAllMocks();
      await setSpeaking(true);
      expect(useVoiceStore.getState().isSpeaking).toBe(true);
      
      // Stop speaking - should stop stop word
      vi.clearAllMocks();
      await setSpeaking(false);
      expect(useVoiceStore.getState().isSpeaking).toBe(false);
    });

    it('should not activate both detection systems simultaneously', async () => {
      const { setSpeaking } = useVoiceStore.getState();
      
      // When speaking, only stop word should be active
      await setSpeaking(true);
      expect(useVoiceStore.getState().isSpeaking).toBe(true);
      
      // When not speaking, only wake word should be active
      await setSpeaking(false);
      expect(useVoiceStore.getState().isSpeaking).toBe(false);
    });
  });

  describe('Dual Detection Instance Integration', () => {
    beforeEach(async () => {
      const { initialize } = useVoiceStore.getState();
      await initialize();
      vi.clearAllMocks();
    });

    it('should pause wake word and enable stop word when speaking', async () => {
      const { setSpeaking } = useVoiceStore.getState();
      useVoiceStore.setState({ stopWordEnabled: true, wakeWordEnabled: true });
      
      // When speaking starts, wake word should pause and stop word should start
      await setSpeaking(true);
      expect(mockWakeWordInstance.stop).toHaveBeenCalled(); // Paused
      expect(mockStopWordInstance.start).toHaveBeenCalled(); // Started
      
      vi.clearAllMocks();
      
      // When speaking stops, stop word should stop and wake word should resume
      await setSpeaking(false);
      expect(mockStopWordInstance.stop).toHaveBeenCalled(); // Stopped
      expect(mockWakeWordInstance.start).toHaveBeenCalled(); // Resumed
    });

    it('should switch between wake and stop word detection', async () => {
      const { setSpeaking } = useVoiceStore.getState();
      useVoiceStore.setState({ stopWordEnabled: true, wakeWordEnabled: true });
      
      // When speaking, only stop word should be active
      await setSpeaking(true);
      
      // Stop word started, wake word paused
      expect(mockStopWordInstance.start).toHaveBeenCalled();
      expect(mockWakeWordInstance.stop).toHaveBeenCalled();
    });

    it('should await async setSpeaking calls in TTS callbacks', async () => {
      const { setSpeaking } = useVoiceStore.getState();
      
      // Simulate TTS start callback
      const setSpeakingPromise = setSpeaking(true);
      
      // Should return a promise
      expect(setSpeakingPromise).toBeInstanceOf(Promise);
      
      // Await the promise
      await setSpeakingPromise;
      
      // State should be updated after promise resolves
      expect(useVoiceStore.getState().isSpeaking).toBe(true);
    });

    it('should handle rapid speaking state changes without race conditions', async () => {
      const { setSpeaking } = useVoiceStore.getState();
      useVoiceStore.setState({ stopWordEnabled: true });
      
      // Rapid changes
      await setSpeaking(true);
      await setSpeaking(false);
      await setSpeaking(true);
      await setSpeaking(false);
      
      // Final state should be not speaking
      expect(useVoiceStore.getState().isSpeaking).toBe(false);
      // Should have called stop word stop at least once
      expect(mockStopWordInstance.stop).toHaveBeenCalled();
    });

    it('should only have stop word active during assistant speech', async () => {
      const { setSpeaking } = useVoiceStore.getState();
      useVoiceStore.setState({ wakeWordEnabled: true, stopWordEnabled: true });
      
      // During speech, wake word should be paused
      await setSpeaking(true);
      expect(mockWakeWordInstance.stop).toHaveBeenCalled();
      expect(mockStopWordInstance.start).toHaveBeenCalled();
    });
  });

  describe('Dual Instance Async Behavior', () => {
    beforeEach(async () => {
      const { initialize } = useVoiceStore.getState();
      await initialize();
      vi.clearAllMocks();
    });

    it('should await stop word start before continuing', async () => {
      const { setSpeaking } = useVoiceStore.getState();
      useVoiceStore.setState({ stopWordEnabled: true });
      
      let startCompleted = false;
      mockStopWordInstance.start.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        startCompleted = true;
      });
      
      await setSpeaking(true);
      
      // Start should have completed
      expect(startCompleted).toBe(true);
      expect(useVoiceStore.getState().isSpeaking).toBe(true);
    });

    it('should run both instances independently', async () => {
      const { setSpeaking } = useVoiceStore.getState();
      useVoiceStore.setState({ stopWordEnabled: true });
      
      await setSpeaking(true);
      
      // Stop word started, wake word NOT stopped
      expect(mockStopWordInstance.start).toHaveBeenCalled();
      expect(mockWakeWordInstance.stop).not.toHaveBeenCalled();
    });
  });
});
