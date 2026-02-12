// @ts-ignore - openwakeword-wasm-browser doesn't have TypeScript declarations
import WakeWordEngine from 'openwakeword-wasm-browser';

export type WakeWordCallback = () => void;

/**
 * OpenWakeWord-based wake word detection
 * Uses OpenWakeWord's pre-trained models with built-in VAD
 * Runs 100% in browser, no API keys needed
 * 
 * Available keywords: hey_jarvis, alexa, hey_mycroft, hey_rhasspy, timer, weather
 */
export class OpenWakeWordDetection {
  private engine: WakeWordEngine | null = null;
  private isListening = false;
  private onDetectedCallback?: WakeWordCallback;
  private targetWords: string[] = [];
  private unsubscribe?: () => void;

  /**
   * Initialize the wake word detection engine
   * @param keywords - Wake words to detect
   * @param threshold - Detection confidence threshold (0-1), default 0.5
   * 
   * Available keywords: 'hey_jarvis', 'alexa', 'hey_mycroft', 'hey_rhasspy', 'timer', 'weather'
   */
  async initialize(
    keywords: string[] = ['hey_jarvis'],
    threshold: number = 0.5
  ): Promise<void> {
    try {
      console.log('Initializing OpenWakeWord engine...');
      
      // Create engine instance
      this.engine = new WakeWordEngine({
        baseAssetUrl: '/openwakeword/models',
        keywords: keywords,
        detectionThreshold: threshold,
        cooldownMs: 2000, // 2-second cooldown between detections
      });

      this.targetWords = keywords;
      
      // Load models
      console.log('Loading OpenWakeWord models...');
      await this.engine.load();
      
      // Set up event listeners
      this.engine.on('ready', () => {
        console.log('✅ OpenWakeWord models loaded');
      });

      this.engine.on('speech-start', () => {
        console.log('🎤 Speech detected');
      });

      this.engine.on('speech-end', () => {
        console.log('🔇 Silence detected');
      });

      this.engine.on('error', (error: unknown) => {
        console.error('❌ OpenWakeWord error:', error);
      });

      // Set up detection callback
      this.unsubscribe = this.engine.on('detect', ({ keyword, score }: { keyword: string; score: number }) => {
        console.log(`✨ Wake word detected: "${keyword}" (confidence: ${(score * 100).toFixed(1)}%)`);
        this.onDetectedCallback?.();
      });
      
      console.log('✅ OpenWakeWord detection initialized');
      console.log('Available keywords:', keywords.join(', '));
      console.log('Threshold:', threshold);
    } catch (error) {
      // Ensure engine is null on failure
      this.engine = null;
      console.error('Failed to initialize OpenWakeWord detection:', error);
      throw error;
    }
  }

  /**
   * Check if wake word detection is initialized
   */
  isInitialized(): boolean {
    return this.engine !== null;
  }

  /**
   * Start listening for the wake word
   */
  async start(): Promise<void> {
    if (!this.engine) {
      throw new Error('OpenWakeWord detection not initialized. Call initialize() first.');
    }

    if (this.isListening) {
      console.warn('OpenWakeWord detection already running');
      return;
    }

    try {
      // Start microphone streaming
      await this.engine.start();
      this.isListening = true;
      console.log('👂 Started listening for wake words:', this.targetWords.join(', '));
    } catch (error) {
      console.error('Failed to start OpenWakeWord detection:', error);
      throw error;
    }
  }

  /**
   * Stop listening for the wake word
   */
  async stop(): Promise<void> {
    if (!this.engine) {
      console.log('⚠️ Wake word stop called but engine is null');
      return;
    }

    if (!this.isListening) {
      console.log('⚠️ Wake word stop called but not listening');
      return;
    }

    try {
      console.log(`🔇 Stopping OpenWakeWord detection...`);
      await this.engine.stop();
      this.isListening = false;
      console.log('⏸️ OpenWakeWord detection stopped');
    } catch (error) {
      this.isListening = false;
      console.error('Failed to stop OpenWakeWord detection:', error);
      throw error;
    }
  }

  /**
   * Release all resources
   */
  async release(): Promise<void> {
    await this.stop();
    
    // Unsubscribe from events
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    
    // Release engine
    this.engine = null;
    
    console.log('OpenWakeWord detection released');
  }

  /**
   * Dispose of resources (alias for release)
   */
  async dispose(): Promise<void> {
    return this.release();
  }

  /**
   * Set callback for when wake word is detected
   */
  onDetected(callback: WakeWordCallback): void {
    this.onDetectedCallback = callback;
  }

  /**
   * Check if currently listening
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Get list of available wake words
   */
  getAvailableWords(): string[] {
    return ['hey_jarvis', 'alexa', 'hey_mycroft', 'hey_rhasspy', 'timer', 'weather'];
  }

  /**
   * Update detection threshold dynamically
   * Note: OpenWakeWord doesn't support runtime threshold updates
   * Would need to reinitialize with new threshold
   */
  setThreshold(threshold: number): void {
    console.warn('Threshold update requires reinitialization with OpenWakeWord');
    console.log('Current threshold cannot be changed at runtime. Requested:', threshold);
  }

  /**
   * Update active keywords dynamically
   */
  setActiveKeywords(keywords: string[]): void {
    if (!this.engine) {
      console.warn('Cannot update keywords: engine not initialized');
      return;
    }
    
    this.engine.setActiveKeywords(keywords);
    this.targetWords = keywords;
    console.log('Updated active keywords:', keywords.join(', '));
  }
}

// Factory function to create new instances (for dual wake/stop word support)
export const createOpenWakeWordDetection = (): OpenWakeWordDetection => {
  return new OpenWakeWordDetection();
};

// Singleton instance (legacy support)
let openWakeWordInstance: OpenWakeWordDetection | null = null;

export const getOpenWakeWordDetection = (): OpenWakeWordDetection => {
  if (!openWakeWordInstance) {
    openWakeWordInstance = new OpenWakeWordDetection();
  }
  return openWakeWordInstance;
};
