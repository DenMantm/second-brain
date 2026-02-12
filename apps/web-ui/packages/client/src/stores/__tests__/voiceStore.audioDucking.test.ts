import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVoiceStore } from '../voiceStore';
import { useYouTubeStore } from '../youtubeStore';

// Mock dependencies
vi.mock('../../services/wakeWord');
vi.mock('../../services/audioRecorder');
vi.mock('../../services/stt');
vi.mock('../../services/tts');
vi.mock('../../services/llm');
vi.mock('../../services/streamingOrchestrator');
vi.mock('@tensorflow/tfjs-core', () => ({}));
vi.mock('@tensorflow/tfjs-backend-cpu', () => ({}));
vi.mock('@tensorflow/tfjs-backend-webgl', () => ({}));
vi.mock('@tensorflow/tfjs-converter', () => ({}));
vi.mock('@tensorflow-models/speech-commands', () => ({}));

// Mock settings store
const mockSettingsStore = {
  getState: vi.fn(() => ({ audioDuckingVolume: 10 })),
};

if (typeof window !== 'undefined') {
  (window as any).__settingsStore = mockSettingsStore;
}

describe('Audio Ducking Integration', () => {
  let mockYouTubePlayer: any;

  beforeEach(() => {
    // Reset settings mock to default
    mockSettingsStore.getState.mockReturnValue({ audioDuckingVolume: 10 });

    // Reset YouTube store
    useYouTubeStore.setState({
      viewMode: 'hidden',
      modalSize: 'normal',
      searchResults: [],
      currentVideoId: null,
      searchQuery: null,
      player: null,
      isPlaying: false,
      volume: 100,
      isMuted: false,
      previousVolume: null,
    });

    // Reset voice store
    useVoiceStore.setState({
      isInitialized: false,
      isListening: false,
      isRecording: false,
      isProcessing: false,
      isSpeaking: false,
      wakeWordDetected: false,
      wakeWordEnabled: true,
      error: null,
      messages: [],
      currentTranscript: '',
      streamingText: '',
      currentConversationId: null,
      conversations: [],
    });

    // Create mock YouTube player
    mockYouTubePlayer = {
      setVolume: vi.fn(),
      getVolume: vi.fn().mockReturnValue(80),
      isMuted: vi.fn().mockReturnValue(false),
      destroy: vi.fn(),
    };
  });

  describe('Volume Ducking During Recording', () => {
    it('should duck YouTube volume when recording starts', () => {
      // Setup YouTube player
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 80 });

      // Simulate recording state change
      useVoiceStore.setState({ isRecording: true });

      // Manually call duck (simulating what happens in startRecording)
      useYouTubeStore.getState().duckVolume();

      // Verify volume was ducked
      expect(mockYouTubePlayer.setVolume).toHaveBeenCalledWith(10);
      expect(useYouTubeStore.getState().volume).toBe(10);
      expect(useYouTubeStore.getState().previousVolume).toBe(80);
    });

    it('should restore YouTube volume when recording stops', () => {
      // Setup ducked state
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 10, previousVolume: 80 });
      useVoiceStore.setState({ isRecording: false });

      // Manually call restore (simulating what happens in stopRecording)
      useYouTubeStore.getState().restoreVolume();

      // Verify volume was restored
      expect(mockYouTubePlayer.setVolume).toHaveBeenCalledWith(80);
      expect(useYouTubeStore.getState().volume).toBe(80);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);
    });

    it('should restore volume after recording completes successfully', () => {
      // Setup ducked state
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 10, previousVolume: 75 });

      // Simulate recording completion
      useVoiceStore.setState({ isRecording: false, isProcessing: true });
      useYouTubeStore.getState().restoreVolume();

      // Verify volume restored
      expect(mockYouTubePlayer.setVolume).toHaveBeenCalledWith(75);
      expect(useYouTubeStore.getState().volume).toBe(75);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);
    });

    it('should restore volume if recording errors out', () => {
      // Setup ducked state
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 10, previousVolume: 90 });

      // Simulate error
      useVoiceStore.setState({ isRecording: false, error: 'Recording failed' });
      useYouTubeStore.getState().restoreVolume();

      // Verify volume restored even on error
      expect(mockYouTubePlayer.setVolume).toHaveBeenCalledWith(90);
      expect(useYouTubeStore.getState().volume).toBe(90);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);
    });

    it('should handle manual stop correctly', () => {
      // Setup ducked state
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 10, previousVolume: 65 });

      // Simulate manual stop
      useVoiceStore.setState({ isRecording: false });
      useYouTubeStore.getState().restoreVolume();

      // Verify volume restored
      expect(mockYouTubePlayer.setVolume).toHaveBeenCalledWith(65);
      expect(useYouTubeStore.getState().volume).toBe(65);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);
    });
  });

  describe('Volume Ducking Edge Cases', () => {
    it('should handle ducking when YouTube player is not available', () => {
      // No player set
      useYouTubeStore.setState({ volume: 50, previousVolume: null });

      // Try to duck (should not error)
      useYouTubeStore.getState().duckVolume();

      // Volume should remain unchanged
      expect(useYouTubeStore.getState().volume).toBe(50);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);
    });

    it('should handle restore when YouTube player is not available', () => {
      // No player set
      useYouTubeStore.setState({ volume: 10, previousVolume: 50 });

      // Try to restore (should not error)
      useYouTubeStore.getState().restoreVolume();

      // Volume should remain unchanged
      expect(useYouTubeStore.getState().volume).toBe(10);
      expect(useYouTubeStore.getState().previousVolume).toBe(50);
    });

    it('should not duck twice if already ducked', () => {
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 10, previousVolume: 80 });

      // Try to duck again
      useYouTubeStore.getState().duckVolume();

      // setVolume should not be called again
      expect(mockYouTubePlayer.setVolume).not.toHaveBeenCalled();
      expect(useYouTubeStore.getState().previousVolume).toBe(80);
    });

    it('should not restore if not ducked', () => {
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 50, previousVolume: null });

      // Try to restore
      useYouTubeStore.getState().restoreVolume();

      // setVolume should not be called
      expect(mockYouTubePlayer.setVolume).not.toHaveBeenCalled();
      expect(useYouTubeStore.getState().previousVolume).toBe(null);
    });
  });

  describe('Multiple Recording Cycles', () => {
    it('should handle multiple duck/restore cycles', () => {
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);

      // First cycle: volume 80 -> 10 -> 80
      useYouTubeStore.setState({ volume: 80 });
      useYouTubeStore.getState().duckVolume();
      expect(useYouTubeStore.getState().volume).toBe(10);
      expect(useYouTubeStore.getState().previousVolume).toBe(80);

      useYouTubeStore.getState().restoreVolume();
      expect(useYouTubeStore.getState().volume).toBe(80);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);

      // Second cycle: volume 80 -> 10 -> 80
      useYouTubeStore.getState().duckVolume();
      expect(useYouTubeStore.getState().volume).toBe(10);
      expect(useYouTubeStore.getState().previousVolume).toBe(80);

      useYouTubeStore.getState().restoreVolume();
      expect(useYouTubeStore.getState().volume).toBe(80);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);
    });

    it('should preserve different volumes across cycles', () => {
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);

      // First cycle with volume 70
      useYouTubeStore.setState({ volume: 70 });
      useYouTubeStore.getState().duckVolume();
      useYouTubeStore.getState().restoreVolume();
      expect(useYouTubeStore.getState().volume).toBe(70);

      // User changes volume to 50
      useYouTubeStore.getState().setVolume(50);

      // Second cycle with volume 50
      useYouTubeStore.getState().duckVolume();
      expect(useYouTubeStore.getState().previousVolume).toBe(50);
      useYouTubeStore.getState().restoreVolume();
      expect(useYouTubeStore.getState().volume).toBe(50);
    });
  });

  describe('Silence Detection', () => {
    it('should restore volume when silence is detected', () => {
      // Setup ducked state
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 10, previousVolume: 85 });

      // Simulate silence detection (recording ends, no speech)
      useVoiceStore.setState({ isRecording: false, isProcessing: false });
      useYouTubeStore.getState().restoreVolume();

      // Verify volume restored
      expect(mockYouTubePlayer.setVolume).toHaveBeenCalledWith(85);
      expect(useYouTubeStore.getState().volume).toBe(85);
    });
  });

  describe('AI Speaking Ducking', () => {
    it('should duck volume when AI starts speaking', () => {
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 70 });

      // AI starts speaking
      useVoiceStore.getState().setSpeaking(true);

      // Verify volume was ducked
      expect(mockYouTubePlayer.setVolume).toHaveBeenCalledWith(10);
      expect(useYouTubeStore.getState().volume).toBe(10);
      expect(useYouTubeStore.getState().previousVolume).toBe(70);
    });

    it('should restore volume when AI stops speaking', () => {
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 10, previousVolume: 60 });
      useVoiceStore.setState({ isSpeaking: true });

      // AI stops speaking
      useVoiceStore.getState().setSpeaking(false);

      // Verify volume was restored
      expect(mockYouTubePlayer.setVolume).toHaveBeenCalledWith(60);
      expect(useYouTubeStore.getState().volume).toBe(60);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);
    });

    it('should handle multiple speaking cycles', () => {
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 80 });

      // First speaking cycle
      useVoiceStore.getState().setSpeaking(true);
      expect(useYouTubeStore.getState().volume).toBe(10);
      expect(useYouTubeStore.getState().previousVolume).toBe(80);

      useVoiceStore.getState().setSpeaking(false);
      expect(useYouTubeStore.getState().volume).toBe(80);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);

      // Second speaking cycle
      useVoiceStore.getState().setSpeaking(true);
      expect(useYouTubeStore.getState().volume).toBe(10);
      expect(useYouTubeStore.getState().previousVolume).toBe(80);

      useVoiceStore.getState().setSpeaking(false);
      expect(useYouTubeStore.getState().volume).toBe(80);
    });

    it('should not duck if already speaking', () => {
      useYouTubeStore.getState().setPlayer(mockYouTubePlayer);
      useYouTubeStore.setState({ volume: 10, previousVolume: 75 });
      useVoiceStore.setState({ isSpeaking: true });

      mockYouTubePlayer.setVolume.mockClear();

      // Try to set speaking again (no-op)
      useVoiceStore.getState().setSpeaking(true);

      // Should not duck again
      expect(mockYouTubePlayer.setVolume).not.toHaveBeenCalled();
    });
  });
});
