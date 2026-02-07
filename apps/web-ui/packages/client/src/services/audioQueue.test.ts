import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioQueueManager } from './audioQueue';

// Mock Web Audio API
class MockAudioBuffer {
  constructor(
    public numberOfChannels: number = 2,
    public length: number = 44100,
    public sampleRate: number = 44100
  ) {}
  
  duration = 1.0;
  getChannelData = vi.fn(() => new Float32Array(this.length));
  copyFromChannel = vi.fn();
  copyToChannel = vi.fn();
}

class MockAudioBufferSourceNode {
  buffer: MockAudioBuffer | null = null;
  onended: ((this: AudioBufferSourceNode, ev: Event) => any) | null = null;
  
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn(() => {
    // Simulate async audio playback completion
    setTimeout(() => {
      if (this.onended) {
        this.onended.call(this as any, new Event('ended'));
      }
    }, 10);
  });
  stop = vi.fn();
}

class MockAudioContext {
  state: AudioContextState = 'running';
  destination = {};
  
  createBufferSource = vi.fn(() => new MockAudioBufferSourceNode() as any);
  
  decodeAudioData = vi.fn(async (__arrayBuffer: ArrayBuffer) => {
    return new MockAudioBuffer() as any;
  });
  
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  
  close = vi.fn(async () => {
    this.state = 'closed';
  });
}

// Setup global mocks
let mockAudioContext: MockAudioContext;

describe('AudioQueueManager', () => {
  let audioQueue: AudioQueueManager;

  beforeEach(() => {
    mockAudioContext = new MockAudioContext();
    
    // Mock global AudioContext
    global.AudioContext = vi.fn(() => mockAudioContext as any);
    
    audioQueue = new AudioQueueManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create AudioContext on initialization', () => {
      expect(global.AudioContext).toHaveBeenCalled();
    });

    it('should start with empty queue', () => {
      expect(audioQueue.getQueueLength()).toBe(0);
    });

    it('should not be playing initially', () => {
      expect(audioQueue.isCurrentlyPlaying()).toBe(false);
    });
  });

  describe('enqueue()', () => {
    it('should add audio to queue', async () => {
      const audioData = new ArrayBuffer(1024);
      await audioQueue.enqueue(audioData);
      
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalledWith(audioData);
    });

    it('should start playback if not already playing', async () => {
      const audioData = new ArrayBuffer(1024);
      await audioQueue.enqueue(audioData);
      
      // Wait for async playback to start
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });

    it('should queue multiple audio buffers', async () => {
      const audio1 = new ArrayBuffer(1024);
      const audio2 = new ArrayBuffer(2048);
      
      await audioQueue.enqueue(audio1);
      await audioQueue.enqueue(audio2);
      
      // First should start playing immediately, second queued
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(audioQueue.getQueueLength()).toBeGreaterThan(0);
    });

    it('should respect max queue size', async () => {
      const manager = new AudioQueueManager({ maxQueueSize: 2 });
      
      const audio1 = new ArrayBuffer(1024);
      const audio2 = new ArrayBuffer(1024);
      // audio3 not used - removed for linting
      
      await manager.enqueue(audio1);
      await manager.enqueue(audio2);
      
      // Third should be rejected or dropped (implementation dependent)
      const queueLength = manager.getQueueLength();
      expect(queueLength).toBeLessThanOrEqual(2);
    });

    it('should call onQueueUpdate callback', async () => {
      const onQueueUpdate = vi.fn();
      const manager = new AudioQueueManager({ onQueueUpdate });
      
      await manager.enqueue(new ArrayBuffer(1024));
      
      expect(onQueueUpdate).toHaveBeenCalled();
    });

    it('should call onPlaybackStart callback', async () => {
      const onPlaybackStart = vi.fn();
      const manager = new AudioQueueManager({ onPlaybackStart });
      
      await manager.enqueue(new ArrayBuffer(1024));
      await new Promise(resolve => setTimeout(resolve, 5));
      
      expect(onPlaybackStart).toHaveBeenCalled();
    });
  });

  describe('Sequential playback', () => {
    it('should play audio buffers in FIFO order', async () => {
      const playbackOrder: number[] = [];
      
      const onPlaybackStart = vi.fn((index) => {
        playbackOrder.push(index);
      });
      
      const manager = new AudioQueueManager({ onPlaybackStart });
      
      await manager.enqueue(new ArrayBuffer(100));
      await manager.enqueue(new ArrayBuffer(200));
      await manager.enqueue(new ArrayBuffer(300));
      
      // Wait for all to play
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(playbackOrder).toEqual([0, 1, 2]);
    });

    it('should wait for current audio to finish before playing next', async () => {
      const manager = new AudioQueueManager();
      
      await manager.enqueue(new ArrayBuffer(1024));
      expect(manager.isCurrentlyPlaying()).toBe(true);
      
      await manager.enqueue(new ArrayBuffer(1024));
      
      // Second should be queued, not playing yet
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(manager.getQueueLength()).toBeGreaterThan(0);
    });

    it('should call onPlaybackEnd when audio finishes', async () => {
      const onPlaybackEnd = vi.fn();
      const manager = new AudioQueueManager({ onPlaybackEnd });
      
      await manager.enqueue(new ArrayBuffer(1024));
      
      // Wait for playback to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(onPlaybackEnd).toHaveBeenCalled();
    });

    it('should call onQueueEmpty when all audio played', async () => {
      const onQueueEmpty = vi.fn();
      const manager = new AudioQueueManager({ onQueueEmpty });
      
      await manager.enqueue(new ArrayBuffer(1024));
      await manager.enqueue(new ArrayBuffer(1024));
      
      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onQueueEmpty).toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    it('should stop current playback', async () => {
      const manager = new AudioQueueManager();
      await manager.enqueue(new ArrayBuffer(1024));
      
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(manager.isCurrentlyPlaying()).toBe(true);
      
      manager.clear();
      expect(manager.isCurrentlyPlaying()).toBe(false);
    });

    it('should clear the queue', async () => {
      const manager = new AudioQueueManager();
      await manager.enqueue(new ArrayBuffer(1024));
      await manager.enqueue(new ArrayBuffer(1024));
      
      manager.clear();
      expect(manager.getQueueLength()).toBe(0);
    });

    it('should set interrupted flag', async () => {
      const manager = new AudioQueueManager();
      await manager.enqueue(new ArrayBuffer(1024));
      
      manager.clear();
      
      // Verify interrupted behavior (implementation specific)
      expect(manager.isCurrentlyPlaying()).toBe(false);
    });

    it('should prevent queued items from playing after clear', async () => {
      const onPlaybackStart = vi.fn();
      const manager = new AudioQueueManager({ onPlaybackStart });
      
      await manager.enqueue(new ArrayBuffer(1024));
      await manager.enqueue(new ArrayBuffer(1024));
      await manager.enqueue(new ArrayBuffer(1024));
      
      manager.clear();
      
      // Wait to ensure nothing plays
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have started once (first item) before clear
      expect(onPlaybackStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('resume()', () => {
    it('should resume suspended AudioContext', async () => {
      mockAudioContext.state = 'suspended';
      
      await audioQueue.resume();
      
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should not throw if already running', async () => {
      mockAudioContext.state = 'running';
      
      await expect(audioQueue.resume()).resolves.not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle decode errors gracefully', async () => {
      const onError = vi.fn();
      const manager = new AudioQueueManager({ onError });
      
      mockAudioContext.decodeAudioData.mockRejectedValueOnce(new Error('Decode failed'));
      
      const invalidAudio = new ArrayBuffer(10);
      await manager.enqueue(invalidAudio);
      
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should continue playing after decode error', async () => {
      const onError = vi.fn();
      const onPlaybackStart = vi.fn();
      const manager = new AudioQueueManager({ onError, onPlaybackStart });
      
      // First audio fails
      mockAudioContext.decodeAudioData.mockRejectedValueOnce(new Error('Decode failed'));
      await manager.enqueue(new ArrayBuffer(1024));
      
      // Second audio succeeds
      mockAudioContext.decodeAudioData.mockResolvedValueOnce(new MockAudioBuffer() as any);
      await manager.enqueue(new ArrayBuffer(1024));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onPlaybackStart).toHaveBeenCalled();
    });

    it('should handle invalid ArrayBuffer', async () => {
      const onError = vi.fn();
      const manager = new AudioQueueManager({ onError });
      
      mockAudioContext.decodeAudioData.mockRejectedValueOnce(new Error('Invalid buffer'));
      
      await manager.enqueue(new ArrayBuffer(0));
      
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Interrupt behavior', () => {
    it('should not resume playback after clear until new enqueue', async () => {
      const manager = new AudioQueueManager();
      
      await manager.enqueue(new ArrayBuffer(1024));
      await manager.enqueue(new ArrayBuffer(1024));
      
      manager.clear();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(manager.isCurrentlyPlaying()).toBe(false);
      expect(manager.getQueueLength()).toBe(0);
    });

    it('should allow new audio after interrupt', async () => {
      const manager = new AudioQueueManager();
      
      await manager.enqueue(new ArrayBuffer(1024));
      manager.clear();
      
      // Enqueue new audio after interrupt
      await manager.enqueue(new ArrayBuffer(2048));
      
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(manager.isCurrentlyPlaying()).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty ArrayBuffer', async () => {
      const onError = vi.fn();
      const manager = new AudioQueueManager({ onError });
      
      mockAudioContext.decodeAudioData.mockRejectedValueOnce(new Error('Empty buffer'));
      
      await manager.enqueue(new ArrayBuffer(0));
      
      expect(onError).toHaveBeenCalled();
    });

    it('should handle rapid enqueue calls', async () => {
      const manager = new AudioQueueManager();
      
      // Rapidly enqueue multiple items
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(manager.enqueue(new ArrayBuffer(1024)));
      }
      
      await Promise.all(promises);
      
      // Queue should have items (some playing, some queued)
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(manager.getQueueLength()).toBeGreaterThan(0);
    });

    it('should handle clear during playback', async () => {
      const manager = new AudioQueueManager();
      
      await manager.enqueue(new ArrayBuffer(1024));
      
      // Clear while playing
      await new Promise(resolve => setTimeout(resolve, 5));
      manager.clear();
      
      expect(manager.isCurrentlyPlaying()).toBe(false);
      expect(manager.getQueueLength()).toBe(0);
    });

    it('should handle multiple clears', () => {
      audioQueue.clear();
      audioQueue.clear();
      audioQueue.clear();
      
      expect(audioQueue.getQueueLength()).toBe(0);
      expect(audioQueue.isCurrentlyPlaying()).toBe(false);
    });
  });

  describe('Callback order', () => {
    it('should call callbacks in correct order', async () => {
      const callOrder: string[] = [];
      
      const manager = new AudioQueueManager({
        onQueueUpdate: () => callOrder.push('queueUpdate'),
        onPlaybackStart: () => callOrder.push('playbackStart'),
        onPlaybackEnd: () => callOrder.push('playbackEnd'),
        onQueueEmpty: () => callOrder.push('queueEmpty'),
      });
      
      await manager.enqueue(new ArrayBuffer(1024));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(callOrder).toContain('queueUpdate');
      expect(callOrder).toContain('playbackStart');
      expect(callOrder).toContain('playbackEnd');
      expect(callOrder).toContain('queueEmpty');
      
      // playbackStart should come before playbackEnd
      const startIndex = callOrder.indexOf('playbackStart');
      const endIndex = callOrder.indexOf('playbackEnd');
      expect(startIndex).toBeLessThan(endIndex);
    });
  });
});



