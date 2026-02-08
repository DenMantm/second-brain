/**
 * Wake Word Manager
 * Service-level manager for wake word detection (can be used in stores and components)
 */

import { getWakeWordDetection } from './wakeWord';

export class WakeWordManager {
  private selectedWakeWord: string;
  private threshold: number;
  private detectionCallback?: () => void | Promise<void>;
  
  constructor(wakeWord: string = 'go', threshold: number = 0.75) {
    this.selectedWakeWord = wakeWord;
    this.threshold = threshold;
  }
  
  /**
   * Initialize wake word detection
   */
  async initialize(): Promise<void> {
    const service = getWakeWordDetection();
    
    console.log(`✨ Initializing wake word "${this.selectedWakeWord}"...`);
    await service.initialize([this.selectedWakeWord], this.threshold);
    
    if (this.detectionCallback) {
      service.onDetected(this.detectionCallback);
    }
    
    console.log(`✅ Wake word "${this.selectedWakeWord}" initialized`);
  }
  
  /**
   * Reinitialize with new wake word
   */
  async reinitialize(newWakeWord: string): Promise<void> {
    const service = getWakeWordDetection();
    const wasListening = service.getIsListening();
    
    console.log(`🔄 Reinitializing wake word to "${newWakeWord}"...`);
    
    if (wasListening) {
      await service.stop();
    }
    
    this.selectedWakeWord = newWakeWord;
    await service.initialize([newWakeWord], this.threshold);
    
    if (this.detectionCallback) {
      service.onDetected(this.detectionCallback);
    }
    
    if (wasListening) {
      await service.start();
      console.log(`👂 Resumed listening for "${newWakeWord}"`);
    }
    
    console.log(`✅ Wake word changed to "${newWakeWord}"`);
  }
  
  /**
   * Start listening for wake word
   */
  async start(): Promise<void> {
    const service = getWakeWordDetection();
    
    if (!service.isInitialized()) {
      await this.initialize();
    }
    
    console.log(`👂 Starting wake word detection for "${this.selectedWakeWord}"...`);
    await service.start();
  }
  
  /**
   * Stop listening
   */
  async stop(): Promise<void> {
    const service = getWakeWordDetection();
    
    if (service.isInitialized()) {
      console.log('🔇 Stopping wake word detection');      await service.stop();
    }
  }
  
  /**
   * Set detection callback
   */
  setCallback(callback: () => void | Promise<void>): void {
    this.detectionCallback = callback;
    const service = getWakeWordDetection();
    
    if (service.isInitialized()) {
      service.onDetected(callback);
    }
  }
  
  /**
   * Check if listening
   */
  isListening(): boolean {
    return getWakeWordDetection().getIsListening();
  }
  
  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return getWakeWordDetection().isInitialized();
  }
  
  /**
   * Get current wake word
   */
  getWakeWord(): string {
    return this.selectedWakeWord;
  }
}
