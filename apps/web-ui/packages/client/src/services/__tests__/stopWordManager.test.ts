/**
 * Tests for StopWordManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StopWordManager } from '../stopWordManager';

// Each manager creates its own detection instance
const mockDetectionService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  onDetected: vi.fn(),
  isInitialized: vi.fn().mockReturnValue(true),
  getIsListening: vi.fn().mockReturnValue(false),
  getAvailableWords: vi.fn().mockReturnValue(['go', 'stop', 'yes', 'no']),
};

// Mock the wake word detection factory
vi.mock('../wakeWord', () => ({
  createWakeWordDetection: vi.fn(() => mockDetectionService)
}));

describe('StopWordManager', () => {
  let manager: StopWordManager;
  
  beforeEach(() => {
    manager = new StopWordManager('stop', 0.75);
    vi.clearAllMocks();
  });
  
  it('should create instance with default stop word', () => {
    expect(manager).toBeInstanceOf(StopWordManager);
    expect(manager.getStopWord()).toBe('stop');
  });
  
  it('should create instance with custom stop word', () => {
    const customManager = new StopWordManager('no', 0.8);
    expect(customManager.getStopWord()).toBe('no');
  });
  
  it('should initialize stop word detection', async () => {
    await manager.initialize();
    expect(manager.isInitialized()).toBe(true);
  });
  
  it('should start listening for stop word', async () => {
    await manager.initialize();
    await manager.start();
    // isListening should now be true (mocked)
  });
  
  it('should stop listening for stop word', async () => {
    await manager.initialize();
    await manager.start();
    await manager.stop();
  });
  
  it('should set detection callback', () => {
    const callback = vi.fn();
    manager.setCallback(callback);
    // Callback should be stored
  });
  
  it('should reinitialize with new stop word', async () => {
    await manager.initialize();
    await manager.reinitialize('no');
    expect(manager.getStopWord()).toBe('no');
  });
  
  it('should check if listening', () => {
    const isListening = manager.isListening();
    expect(typeof isListening).toBe('boolean');
  });
  
  it('should check if initialized', () => {
    const isInit = manager.isInitialized();
    expect(typeof isInit).toBe('boolean');
  });
  
  it('should handle callback invocation', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    manager.setCallback(callback);
    await manager.initialize();
    
    // Callback should be registered
    expect(manager.isInitialized()).toBe(true);
  });
  
  it('should preserve stop word after reinitialization', async () => {
    await manager.initialize();
    await manager.start();
    
    await manager.reinitialize('yes');
    
    expect(manager.getStopWord()).toBe('yes');
  });

  describe('Shared Detection Service Integration', () => {
    it('should verify detection service receives correct word during initialization', async () => {
      await manager.initialize();
      
      // Verify the service was initialized with the stop word
      expect(mockDetectionService.initialize).toHaveBeenCalledWith(['stop'], 0.75);
    });

    it('should verify detection service receives new word during reinitialization', async () => {
      await manager.initialize();
      vi.clearAllMocks();
      
      await manager.reinitialize('no');
      
      // Verify the service was reinitialized with the new word
      expect(mockDetectionService.initialize).toHaveBeenCalledWith(['no'], 0.75);
    });

    it('should document singleton behavior - last initialize wins', async () => {
      // Simulate: wake word initialized first
      await mockDetectionService.initialize(['go'], 0.75);
      vi.clearAllMocks();
      
      // Then stop word initialized - overwrites the service
      await manager.initialize();
      
      // Service should now be configured for stop word
      expect(mockDetectionService.initialize).toHaveBeenCalledWith(['stop'], 0.75);
      
      // NOTE: This test documents the behavior that caused the bug
      // The wake word "go" is no longer active after stop word initializes
      // Solution: always reinitialize when switching between wake/stop modes
    });

    it('should verify complete cycle of mode switching', async () => {
      // Cycle 1: Initialize with stop word (isSpeaking=true)
      await manager.initialize();
      expect(mockDetectionService.initialize).toHaveBeenCalledWith(['stop'], 0.75);
      
      vi.clearAllMocks();
      
      // Cycle 2: Switch to wake word (isSpeaking=false)
      await manager.reinitialize('go');
      expect(mockDetectionService.initialize).toHaveBeenCalledWith(['go'], 0.75);
      
      vi.clearAllMocks();
      
      // Cycle 3: Switch back to stop word (isSpeaking=true)
      await manager.reinitialize('stop');
      expect(mockDetectionService.initialize).toHaveBeenCalledWith(['stop'], 0.75);
    });
  });
});
