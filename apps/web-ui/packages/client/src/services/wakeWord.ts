import * as speechCommands from '@tensorflow-models/speech-commands';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as tf from '@tensorflow/tfjs';

export type WakeWordCallback = () => void;

/**
 * TensorFlow.js-based wake word detection
 * Uses Google's pre-trained speech commands model
 * Runs 100% in browser, no API keys needed
 */
export class WakeWordDetection {
  private recognizer: speechCommands.SpeechCommandRecognizer | null = null;
  private isListening = false;
  private onDetectedCallback?: WakeWordCallback;
  private targetWords: string[] = [];
  private threshold = 0.75;

  /**
   * Initialize the wake word detection engine
   * @param keywords - Wake words to detect (from 18 words model vocabulary)
   * @param threshold - Detection confidence threshold (0-1), default 0.75
   * 
   * Available keywords: 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 
   * 'seven', 'eight', 'nine', 'up', 'down', 'left', 'right', 'go', 'stop', 'yes', 'no'
   */
  async initialize(
    keywords: string[] = ['go'],
    threshold: number = 0.75
  ): Promise<void> {
    try {
      console.log('Initializing TensorFlow.js backend...');
      
      // Set backend preference (WebGL first, then CPU fallback)
      await tf.ready();
      console.log('TensorFlow.js backend ready:', tf.getBackend());
      
      console.log('Loading speech commands model...');
      
      // Create recognizer (uses Google's 18-word model)
      this.recognizer = speechCommands.create('BROWSER_FFT');
      
      // Load model
      await this.recognizer.ensureModelLoaded();
      
      this.targetWords = keywords;
      this.threshold = threshold;
      
      const vocabulary = this.recognizer.wordLabels();
      console.log('✅ Wake word detection initialized');
      console.log('Available words:', vocabulary.join(', '));
      console.log('Target wake words:', keywords.join(', '));
      console.log('Threshold:', threshold);
    } catch (error) {
      console.error('Failed to initialize wake word detection:', error);
      throw error;
    }
  }

  /**
   * Check if wake word detection is initialized
   */
  isInitialized(): boolean {
    return this.recognizer !== null;
  }

  /**
   * Start listening for the wake word
   */
  async start(): Promise<void> {
    if (!this.recognizer) {
      throw new Error('Wake word detection not initialized. Call initialize() first.');
    }

    if (this.isListening) {
      console.warn('Wake word detection already running');
      return;
    }

    try {
      // Start listening
      this.recognizer.listen(
        async (result) => {
          const scores = result.scores;
          const words = this.recognizer!.wordLabels();
          
          // Find highest confidence prediction
          let maxScore = 0;
          let maxIndex = 0;
          
          for (let i = 0; i < scores.length; i++) {
            const score = scores[i];
            if (score !== undefined && typeof score === 'number' && score > maxScore) {
              maxScore = score;
              maxIndex = i;
            }
          }
          
          const detectedWord = words[maxIndex];
          
          // Check if detected word matches target and exceeds threshold
          if (
            detectedWord &&
            this.targetWords.includes(detectedWord) &&
            maxScore > this.threshold
          ) {
            console.log(`✨ Wake word detected: "${detectedWord}" (confidence: ${(maxScore * 100).toFixed(1)}%)`);
            this.onDetectedCallback?.();
          }
        },
        {
          includeSpectrogram: false,
          probabilityThreshold: this.threshold,
          invokeCallbackOnNoiseAndUnknown: false,
          overlapFactor: 0.5, // Process audio every 0.5 seconds
        }
      );
      
      this.isListening = true;
      console.log('👂 Started listening for wake words:', this.targetWords.join(', '));
    } catch (error) {
      console.error('Failed to start wake word detection:', error);
      throw error;
    }
  }

  /**
   * Stop listening for the wake word
   */
  async stop(): Promise<void> {
    if (!this.recognizer) {
      return;
    }

    try {
      if (this.isListening) {
        this.recognizer.stopListening();
        this.isListening = false;
        console.log('⏸️ Wake word detection stopped');
      }
    } catch (error) {
      console.error('Failed to stop wake word detection:', error);
      throw error;
    }
  }

  /**
   * Release all resources
   */
  async release(): Promise<void> {
    await this.stop();
    
    // TensorFlow.js models are garbage collected automatically
    this.recognizer = null;
    
    console.log('Wake word detection released');
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
    return this.recognizer?.wordLabels() || [];
  }
}

// Singleton instance
let wakeWordInstance: WakeWordDetection | null = null;

export const getWakeWordDetection = (): WakeWordDetection => {
  if (!wakeWordInstance) {
    wakeWordInstance = new WakeWordDetection();
  }
  return wakeWordInstance;
};
