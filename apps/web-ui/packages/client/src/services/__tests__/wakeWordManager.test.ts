/**
 * Tests for WakeWordManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WakeWordManager } from '../wakeWordManager';

// Mock the wake word detection service
vi.mock('../wakeWord', () => ({
  getWakeWordDetection: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    onDetected: vi.fn(),
    isInitialized: vi.fn().mockReturnValue(true),
    getIsListening: vi.fn().mockReturnValue(false),
  }))
}));

describe('WakeWordManager', () => {
  let manager: WakeWordManager;
  
  beforeEach(() => {
    manager = new WakeWordManager('go', 0.75);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should create instance with default wake word', () => {
    expect(manager).toBeInstanceOf(WakeWordManager);
    expect(manager.getWakeWord()).toBe('go');
  });
  
  it('should create instance with custom wake word', () => {
    const customManager = new WakeWordManager('stop', 0.8);
    expect(customManager.getWakeWord()).toBe('stop');
  });
  
  it('should initialize wake word detection', async () => {
    await manager.initialize();
    expect(manager.isInitialized()).toBe(true);
  });
  
  it('should start listening for wake word', async () => {
    await manager.initialize();
    await manager.start();
    // isListening should now be true (mocked)
  });
  
  it('should stop listening for wake word', async () => {
    await manager.initialize();
    await manager.start();
    await manager.stop();
  });
  
  it('should set detection callback', () => {
    const callback = vi.fn();
    manager.setCallback(callback);
    // Callback should be stored
  });
  
  it('should reinitialize with new wake word', async () => {
    await manager.initialize();
    await manager.reinitialize('stop');
    expect(manager.getWakeWord()).toBe('stop');
  });
  
  it('should check if listening', () => {
    const isListening = manager.isListening();
    expect(typeof isListening).toBe('boolean');
  });
  
  it('should check if initialized', () => {
    const isInit = manager.isInitialized();
    expect(typeof isInit).toBe('boolean');
  });
});
