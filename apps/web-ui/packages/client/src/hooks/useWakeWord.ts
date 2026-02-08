/**
 * Wake Word Detection Hook
 * Manages wake word initialization, detection, and lifecycle
 */

import { useCallback } from 'react';
import { getWakeWordDetection } from '../services/wakeWord';

export interface UseWakeWordOptions {
  selectedWakeWord?: string;
  threshold?: number;
  onDetected?: () => void | Promise<void>;
}

export interface UseWakeWordResult {
  initialize: (wakeWord: string, threshold?: number) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isListening: () => boolean;
  isInitialized: () => boolean;
  setDetectionCallback: (callback: () => void | Promise<void>) => void;
}

/**
 * Custom hook for wake word detection management
 * Provides a clean interface to the wake word service
 */
export function useWakeWord(options: UseWakeWordOptions = {}): UseWakeWordResult {
  const { 
    selectedWakeWord = 'go', 
    threshold = 0.75,
    onDetected 
  } = options;
  
  /**
   * Initialize wake word detection with specified word and threshold
   */
  const initialize = useCallback(async (wakeWord: string, customThreshold?: number) => {
    const wakeWordService = getWakeWordDetection();
    const effectiveThreshold = customThreshold ?? threshold;
    
    console.log(`✨ Initializing wake word: "${wakeWord}" (threshold: ${effectiveThreshold})`);
    await wakeWordService.initialize([wakeWord], effectiveThreshold);
    
    // Set detection callback if provided
    if (onDetected) {
      wakeWordService.onDetected(onDetected);
    }
    
    console.log(`✅ Wake word "${wakeWord}" initialized`);
  }, [threshold, onDetected]);
  
  /**
   * Start listening for wake word
   */
  const start = useCallback(async () => {
    const wakeWordService = getWakeWordDetection();
    
    if (!wakeWordService.isInitialized()) {
      console.warn('⚠️ Wake word not initialized, initializing with default...');
      await initialize(selectedWakeWord, threshold);
    }
    
    console.log(`👂 Starting wake word detection for "${selectedWakeWord}"...`);
    await wakeWordService.start();
  }, [initialize, selectedWakeWord, threshold]);
  
  /**
   * Stop listening for wake word
   */
  const stop = useCallback(async () => {
    const wakeWordService = getWakeWordDetection();
    
    if (wakeWordService.isInitialized()) {
      console.log('🔇 Stopping wake word detection');
      await wakeWordService.stop();
    }
  }, []);
  
  /**
   * Check if currently listening
   */
  const isListening = useCallback((): boolean => {
    const wakeWordService = getWakeWordDetection();
    return wakeWordService.getIsListening();
  }, []);
  
  /**
   * Check if wake word service is initialized
   */
  const isInitialized = useCallback((): boolean => {
    const wakeWordService = getWakeWordDetection();
    return wakeWordService.isInitialized();
  }, []);
  
  /**
   * Set or update the detection callback
   */
  const setDetectionCallback = useCallback((callback: () => void | Promise<void>) => {
    const wakeWordService = getWakeWordDetection();
    wakeWordService.onDetected(callback);
  }, []);
  
  return {
    initialize,
    start,
    stop,
    isListening,
    isInitialized,
    setDetectionCallback,
  };
}
