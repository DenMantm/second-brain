/**
 * Stop Word Manager
 * Service-level manager for stop word detection (interrupts assistant when speaking)
 * Uses dedicated OpenWakeWordDetection instance (not shared with wake word)
 * Only listens when assistant is actively speaking
 * 
 * NOTE: OpenWakeWord doesn't have a 'stop' model. Using 'timer' as temporary stop word.
 * To use 'stop', train a custom OpenWakeWord model or switch back to TensorFlow.js.
 */

import { createOpenWakeWordDetection, type OpenWakeWordDetection } from './openWakeWord';

export class StopWordManager {
  private selectedStopWord: string;
  private threshold: number;
  private detectionCallback?: () => void | Promise<void>;
  private service: OpenWakeWordDetection;
  
  constructor(stopWord: string = 'timer', threshold: number = 0.6) {
    this.selectedStopWord = stopWord;
    this.threshold = threshold;
    // Create dedicated instance for stop word
    this.service = createOpenWakeWordDetection();
  }
  
  /**
   * Initialize stop word detection
   */
  async initialize(): Promise<void> {
    const service = this.service;
    
    console.log(`✨ Initializing stop word "${this.selectedStopWord}"...`);
    await service.initialize([this.selectedStopWord], this.threshold);
    
    if (this.detectionCallback) {
      service.onDetected(this.detectionCallback);
    }
    
    console.log(`✅ Stop word "${this.selectedStopWord}" initialized`);
  }
  
  /**
   * Reinitialize with new stop word
   */
  async reinitialize(newStopWord: string): Promise<void> {
    const service = this.service;
    const wasListening = service.getIsListening();
    
    console.log(`🔄 Reinitializing stop word to "${newStopWord}"...`);
    
    if (wasListening) {
      await service.stop();
    }
    
    this.selectedStopWord = newStopWord;
    await service.initialize([newStopWord], this.threshold);
    
    if (this.detectionCallback) {
      service.onDetected(this.detectionCallback);
    }
    
    if (wasListening) {
      await service.start();
      console.log(`🛑 Resumed listening for stop word "${newStopWord}"`);
    }
    
    console.log(`✅ Stop word changed to "${newStopWord}"`);
  }
  
  /**
   * Start listening for stop word (only when assistant is speaking)
   */
  async start(): Promise<void> {
    const service = this.service;
    
    if (!service.isInitialized()) {
      await this.initialize();
    }
    
    console.log(`🛑 Starting stop word detection for "${this.selectedStopWord}"...`);
    await service.start();
    
    // Give TensorFlow.js model a moment to warm up and start processing
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('✅ Stop word detection active');
  }
  
  /**
   * Stop listening
   */
  async stop(): Promise<void> {
    const service = this.service;
    
    if (service.isInitialized()) {
      console.log('🔇 Stopping stop word detection');
      await service.stop();
    }
  }
  
  /**
   * Set detection callback
   */
  setCallback(callback: () => void | Promise<void>): void {
    this.detectionCallback = callback;
    const service = this.service;
    
    if (service.isInitialized()) {
      service.onDetected(callback);
    }
  }
  
  /**
   * Check if listening
   */
  isListening(): boolean {
    return this.service.getIsListening();
  }
  
  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.service.isInitialized();
  }
  
  /**
   * Get current stop word
   */
  getStopWord(): string {
    return this.selectedStopWord;
  }
}
