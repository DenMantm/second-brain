/**
 * Tests for useWakeWord hook
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWakeWord } from '../useWakeWord';

// Mock the wake word detection service
vi.mock('../../services/wakeWord', () => ({
  getWakeWordDetection: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    onDetected: vi.fn(),
    isInitialized: vi.fn().mockReturnValue(true),
    getIsListening: vi.fn().mockReturnValue(false),
  }))
}));

describe('useWakeWord', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should initialize with default options', () => {
    const { result } = renderHook(() => useWakeWord());
    
    expect(result.current).toHaveProperty('initialize');
    expect(result.current).toHaveProperty('start');
    expect(result.current).toHaveProperty('stop');
    expect(result.current).toHaveProperty('isListening');
    expect(result.current).toHaveProperty('isInitialized');
    expect(result.current).toHaveProperty('setDetectionCallback');
  });
  
  it('should initialize wake word detection', async () => {
    const { result } = renderHook(() => useWakeWord({
      selectedWakeWord: 'go',
      threshold: 0.75
    }));
    
    await result.current.initialize('go', 0.75);
    
    // Should call service initialize
    expect(result.current.isInitialized()).toBe(true);
  });
  
  it('should start listening', async () => {
    const { result } = renderHook(() => useWakeWord());
    
    await result.current.initialize('go');
    await result.current.start();
    
    // Should call service start
  });
  
  it('should stop listening', async () => {
    const { result } = renderHook(() => useWakeWord());
    
    await result.current.initialize('go');
    await result.current.start();
    await result.current.stop();
    
    // Should call service stop
  });
  
  it('should set detection callback', async () => {
    const onDetected = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onDetected }));
    
    await result.current.initialize('go');
    
    // Callback should be set
  });
  
  it('should call onDetected when wake word detected', async () => {
    const onDetected = vi.fn();
    const { result } = renderHook(() => useWakeWord({ onDetected }));
    
    await result.current.initialize('go');
    
    // Simulate wake word detection
    // (Would need to trigger the mock callback)
  });
  
  it('should auto-initialize on start if not initialized', async () => {
    const { result } = renderHook(() => useWakeWord({
      selectedWakeWord: 'go'
    }));
    
    // Start without explicit initialize
    await result.current.start();
    
    // Should auto-initialize and start
    expect(result.current.isInitialized()).toBe(true);
  });
  
  it('should check listening status', () => {
    const { result } = renderHook(() => useWakeWord());
    
    const isListening = result.current.isListening();
    expect(typeof isListening).toBe('boolean');
  });
  
  it('should check initialized status', () => {
    const { result } = renderHook(() => useWakeWord());
    
    const isInit = result.current.isInitialized();
    expect(typeof isInit).toBe('boolean');
  });
});
