/**
 * Streaming Orchestrator - Coordinates LLM streaming, sentence splitting, and TTS
 */

import { SentenceSplitter } from './sentenceSplitter';
import { AudioQueueManager } from './audioQueue';
import { prepareTextForTTS } from './textSanitizer';
interface TTSResult {
  audio: string; // Base64 encoded audio
  duration: number;
  sample_rate: number;
}
export interface StreamingOrchestratorOptions {
  ttsEndpoint?: string;
  onSentenceDetected?: (sentence: string, index: number) => void;
  onTTSStart?: (sentence: string, index: number) => void;
  onTTSComplete?: (sentence: string, index: number) => void;
  onTTSError?: (sentence: string, index: number, error: Error) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

interface PendingTTSRequest {
  sentenceId: number;
  sentence: string;
  controller: AbortController;
}

export class StreamingOrchestrator {
  private sentenceSplitter: SentenceSplitter;
  private audioQueue: AudioQueueManager;
  private pendingRequests: Map<number, PendingTTSRequest> = new Map();
  private completedAudio: Map<number, ArrayBuffer> = new Map(); // Buffer for out-of-order completions
  private nextSentenceId: number = 0;
  private nextEnqueueId: number = 0; // Track which sentence should be enqueued next
  private ttsEndpoint: string;
  private options: StreamingOrchestratorOptions;
  private isInterrupted: boolean = false;
  
  constructor(options: StreamingOrchestratorOptions = {}) {
    this.ttsEndpoint = options.ttsEndpoint ?? '/api/tts/synthesize';
    this.options = options;
    
    this.sentenceSplitter = new SentenceSplitter({
      minSentenceLength: 3,  // Allow very short sentences like "Hi."
      maxBufferSize: 500
    });
    
    this.audioQueue = new AudioQueueManager({
      maxQueueSize: 10,
      onQueueEmpty: () => {
        // Only call onComplete when all TTS requests are done AND playback has finished
        if (this.pendingRequests.size === 0 && !this.isInterrupted && !this.audioQueue.isCurrentlyPlaying()) {
          console.log('Orchestrator: All processing complete (onQueueEmpty), calling onComplete');
          this.options.onComplete?.();
        }
      },
      onPlaybackEnd: () => {
        // Also check after each playback ends - this handles the case where
        // the last audio finishes playing
        if (this.pendingRequests.size === 0 && !this.isInterrupted && this.audioQueue.getQueueLength() === 0) {
          console.log('Orchestrator: All processing complete (onPlaybackEnd), calling onComplete');
          this.options.onComplete?.();
        }
      },
      onError: (error) => {
        console.error('AudioQueue error:', error);
      }
    });
  }
  
  /**
   * Process streaming text chunks
   */
  async processTextChunk(chunk: string): Promise<void> {
    if (this.isInterrupted) {
      return;
    }
    
    const sentences = this.sentenceSplitter.addChunk(chunk);
    
    for (const sentence of sentences) {
      const sentenceId = this.nextSentenceId++;
      console.log(`Orchestrator: Detected sentence #${sentenceId}: "${sentence}"`);
      
      this.options.onSentenceDetected?.(sentence, sentenceId);
      
      // Synthesize immediately
      this.synthesizeSentence(sentence, sentenceId);
    }
  }
  
  /**
   * Flush remaining buffer (call when stream ends)
   */
  async flush(): Promise<void> {
    if (this.isInterrupted) {
      return;
    }
    
    const lastSentence = this.sentenceSplitter.flush();
    
    if (lastSentence && lastSentence.length > 5) {
      const sentenceId = this.nextSentenceId++;
      console.log(`Orchestrator: Flushed final sentence #${sentenceId}: "${lastSentence}"`);
      
      this.options.onSentenceDetected?.(lastSentence, sentenceId);
      this.synthesizeSentence(lastSentence, sentenceId);
    }
  }
  
  /**
   * Synthesize a single sentence
   */
  private async synthesizeSentence(sentence: string, sentenceId: number): Promise<void> {
    if (this.isInterrupted) {
      return;
    }
    
    // Sanitize text before sending to TTS
    const sanitizedText = prepareTextForTTS(sentence);
    
    if (!sanitizedText) {
      console.warn(`Orchestrator: Skipping invalid sentence #${sentenceId}`);
      this.pendingRequests.delete(sentenceId);
      return;
    }
    
    const controller = new AbortController();
    const request: PendingTTSRequest = {
      sentenceId,
      sentence: sanitizedText, // Use sanitized text
      controller
    };
    
    this.pendingRequests.set(sentenceId, request);
    this.options.onTTSStart?.(sanitizedText, sentenceId);
    
    try {
      console.log(`Orchestrator: Synthesizing sentence #${sentenceId}`);
      
      const response = await fetch(this.ttsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: sanitizedText, // Send sanitized text to TTS
          length_scale: this.getTTSSettings().length_scale,
          noise_scale: this.getTTSSettings().noise_scale,
          noise_w_scale: this.getTTSSettings().noise_w_scale,
        }),
        signal: controller.signal
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`TTS failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      // Parse JSON response (TTS service returns {audio: base64, duration, sample_rate})
      const result: TTSResult = await response.json();
      
      if (!result.audio) {
        throw new Error('TTS response missing audio data');
      }
      
      // Convert base64 audio to ArrayBuffer
      const audioData = atob(result.audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        uint8Array[i] = audioData.charCodeAt(i);
      }
      
      // Store completed audio with sentence ID
      this.completedAudio.set(sentenceId, arrayBuffer);
      
      // Enqueue audio in order - check if we can enqueue any pending completions
      this.enqueueInOrder();
      
      this.options.onTTSComplete?.(sanitizedText, sentenceId);
      
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error(`Orchestrator: TTS failed for sentence #${sentenceId}:`, error);
        this.options.onTTSError?.(sanitizedText, sentenceId, error as Error);
      }
    } finally {
      this.pendingRequests.delete(sentenceId);
    }
  }
  
  /**
   * Enqueue completed audio in sequential order
   */
  private async enqueueInOrder(): Promise<void> {
    // Enqueue all consecutive completed sentences
    while (this.completedAudio.has(this.nextEnqueueId)) {
      const arrayBuffer = this.completedAudio.get(this.nextEnqueueId)!;
      this.completedAudio.delete(this.nextEnqueueId);
      
      console.log(`Orchestrator: Enqueueing sentence #${this.nextEnqueueId} in order`);
      await this.audioQueue.enqueue(arrayBuffer);
      
      this.nextEnqueueId++;
    }
  }
  
  /**
   * Interrupt all processing and clear queue
   */
  interrupt(): void {
    console.log('Orchestrator: Interrupting...');
    
    this.isInterrupted = true;
    
    // Cancel all pending TTS requests
    for (const [id, request] of this.pendingRequests) {
      console.log(`Orchestrator: Aborting TTS request #${id}`);
      request.controller.abort();
    }
    this.pendingRequests.clear();
    
    // Clear audio queue
    this.audioQueue.clear();
    
    // Clear completed audio buffer
    this.completedAudio.clear();
    
    // Clear sentence splitter buffer
    this.sentenceSplitter.clear();
    
    // Reset state
    this.nextSentenceId = 0;
    this.nextEnqueueId = 0;
    
    // Reset interrupt flag after short delay
    setTimeout(() => {
      this.isInterrupted = false;
    }, 100);
  }
  
  /**
   * Get status information
   */
  getStatus() {
    return {
      pendingTTSRequests: this.pendingRequests.size,
      queuedAudio: this.audioQueue.getQueueLength(),
      isPlaying: this.audioQueue.isCurrentlyPlaying(),
      buffer: this.sentenceSplitter.getBuffer()
    };
  }
  
  /**
   * Resume audio playback (needed after user interaction)
   */
  async resume(): Promise<void> {
    await this.audioQueue.resume();
  }

  /**
   * Get current TTS settings from settings store
   */
  private getTTSSettings() {
    // Access settings store dynamically to get latest values
    if (typeof window !== 'undefined') {
      const settingsStore = (window as any).__settingsStore;
      if (settingsStore) {
        return settingsStore.getState().ttsSettings;
      }
    }
    // Fallback to defaults
    return {
      length_scale: 0.95,
      noise_scale: 0.4,
      noise_w_scale: 0.9,
    };
  }
  
  /**
   * Cleanup resources
   */
  dispose(): void {
    this.interrupt();
    this.audioQueue.dispose();
  }
}
