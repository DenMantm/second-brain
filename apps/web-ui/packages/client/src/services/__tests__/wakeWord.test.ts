import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { WakeWordDetection } from '../wakeWord';

// Mock TensorFlow.js
vi.mock('@tensorflow/tfjs', () => ({
  ready: vi.fn().mockResolvedValue(undefined),
  getBackend: vi.fn().mockReturnValue('webgl'),
}));

// Mock speech commands
const mockRecognizer = {
  ensureModelLoaded: vi.fn().mockResolvedValue(undefined),
  wordLabels: vi.fn().mockReturnValue(['zero', 'one', 'two', 'go', 'stop']),
  listen: vi.fn(),
  stopListening: vi.fn(),
};

vi.mock('@tensorflow-models/speech-commands', () => ({
  create: vi.fn(() => mockRecognizer),
}));

describe('WakeWordDetection', () => {
  let wakeWord: WakeWordDetection;
  let detectedCallback: Mock;

  beforeEach(() => {
    wakeWord = new WakeWordDetection();
    detectedCallback = vi.fn();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default wake word "go"', async () => {
      await wakeWord.initialize();
      
      expect(wakeWord.isInitialized()).toBe(true);
      expect(mockRecognizer.ensureModelLoaded).toHaveBeenCalled();
    });

    it('should initialize with custom wake word', async () => {
      await wakeWord.initialize(['stop'], 0.8);
      
      expect(wakeWord.isInitialized()).toBe(true);
    });

    it('should throw error if initialization fails', async () => {
      mockRecognizer.ensureModelLoaded.mockRejectedValueOnce(new Error('Load failed'));
      
      await expect(wakeWord.initialize()).rejects.toThrow('Load failed');
      expect(wakeWord.isInitialized()).toBe(false);
    });
  });

  describe('Start Listening', () => {
    beforeEach(async () => {
      await wakeWord.initialize(['go']);
      wakeWord.onDetected(detectedCallback);
    });

    it('should start listening after initialization', async () => {
      await wakeWord.start();
      
      expect(mockRecognizer.listen).toHaveBeenCalled();
    });

    it('should throw error if not initialized', async () => {
      const uninitializedWakeWord = new WakeWordDetection();
      
      await expect(uninitializedWakeWord.start()).rejects.toThrow(
        'Wake word detection not initialized'
      );
    });

    it('should not start if already listening', async () => {
      await wakeWord.start();
      vi.clearAllMocks();
      
      await wakeWord.start();
      
      // Should log warning but not call listen again
      expect(mockRecognizer.listen).not.toHaveBeenCalled();
    });

    it('should detect wake word and trigger callback', async () => {
      await wakeWord.start();
      
      // Get the callback passed to listen()
      const listenCallback = mockRecognizer.listen.mock.calls[0][0];
      
      // Simulate wake word detection with high confidence
      listenCallback({
        scores: [0.1, 0.1, 0.1, 0.9, 0.1], // "go" at index 3
      });
      
      expect(detectedCallback).toHaveBeenCalled();
    });

    it('should NOT detect if confidence below threshold', async () => {
      await wakeWord.start();
      
      const listenCallback = mockRecognizer.listen.mock.calls[0][0];
      
      // Low confidence score
      listenCallback({
        scores: [0.1, 0.1, 0.1, 0.5, 0.1], // Below default 0.75 threshold
      });
      
      expect(detectedCallback).not.toHaveBeenCalled();
    });

    it('should NOT detect wrong wake word', async () => {
      await wakeWord.start();
      
      const listenCallback = mockRecognizer.listen.mock.calls[0][0];
      
      // High confidence but wrong word
      listenCallback({
        scores: [0.9, 0.1, 0.1, 0.1, 0.1], // "zero" detected, not "go"
      });
      
      expect(detectedCallback).not.toHaveBeenCalled();
    });
  });

  describe('Stop Listening', () => {
    beforeEach(async () => {
      await wakeWord.initialize();
      await wakeWord.start();
      vi.clearAllMocks();
    });

    it('should stop listening when active', async () => {
      await wakeWord.stop();
      
      expect(mockRecognizer.stopListening).toHaveBeenCalled();
    });

    it('should be safe to call stop multiple times', async () => {
      await wakeWord.stop();
      await wakeWord.stop();
      
      // Should not throw error - second call returns early since not listening
      expect(mockRecognizer.stopListening).toHaveBeenCalledTimes(1);
    });

    it('should always call stopListening regardless of flag state', async () => {
      // Even if internal state is wrong, should still try to stop
      await wakeWord.stop();
      
      expect(mockRecognizer.stopListening).toHaveBeenCalled();
    });

    it('should handle errors during stop gracefully', async () => {
      mockRecognizer.stopListening.mockImplementationOnce(() => {
        throw new Error('Stop failed');
      });
      
      await expect(wakeWord.stop()).rejects.toThrow('Stop failed');
    });
  });

  describe('Callback Management', () => {
    beforeEach(async () => {
      await wakeWord.initialize();
    });

    it('should register detection callback', () => {
      const callback = vi.fn();
      wakeWord.onDetected(callback);
      
      // Callback should be registered (tested by detection)
    });

    it('should replace previous callback', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      wakeWord.onDetected(callback1);
      wakeWord.onDetected(callback2);
      
      await wakeWord.start();
      const listenCallback = mockRecognizer.listen.mock.calls[0][0];
      
      listenCallback({
        scores: [0.1, 0.1, 0.1, 0.9, 0.1],
      });
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should dispose of resources', async () => {
      await wakeWord.initialize();
      await wakeWord.start();
      
      await wakeWord.dispose();
      
      expect(mockRecognizer.stopListening).toHaveBeenCalled();
      expect(wakeWord.isInitialized()).toBe(false);
    });

    it('should be safe to dispose when not initialized', async () => {
      await expect(wakeWord.dispose()).resolves.not.toThrow();
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state through start/stop cycle', async () => {
      await wakeWord.initialize();
      
      expect(wakeWord.isInitialized()).toBe(true);
      
      await wakeWord.start();
      await wakeWord.stop();
      
      // Should still be initialized after stop
      expect(wakeWord.isInitialized()).toBe(true);
    });

    it('should reset state after dispose', async () => {
      await wakeWord.initialize();
      await wakeWord.start();
      await wakeWord.dispose();
      
      expect(wakeWord.isInitialized()).toBe(false);
      
      // Should be able to reinitialize
      await expect(wakeWord.initialize()).resolves.not.toThrow();
    });
  });
});
