/**
 * Streaming Orchestrator - Coordinates LLM streaming, sentence splitting, and TTS
 */

import { SentenceSplitter } from './sentenceSplitter';
import { AudioQueueManager } from './audioQueue';
import { prepareTextForTTS } from './textSanitizer';
import { stripThinkingBlocks } from './thinkingProcessor';

/**
 * Simple semaphore for limiting concurrent operations
 */
class Semaphore {
  private currentCount: number;
  private readonly maxCount: number;
  private readonly queue: Array<() => void> = [];

  constructor(maxCount: number) {
    this.maxCount = maxCount;
    this.currentCount = 0;
  }

  async acquire(): Promise<void> {
    // Always return a Promise to ensure async behavior
    return new Promise<void>((resolve) => {
      if (this.currentCount < this.maxCount) {
        this.currentCount++;
        // Use setImmediate/setTimeout to ensure async execution
        setTimeout(() => resolve(), 0);
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      // Don't decrement - just pass the slot to the next waiter
      setTimeout(() => next(), 0);
    } else {
      this.currentCount--;
    }
  }

  getActiveCount(): number {
    return this.currentCount;
  }

  getQueuedCount(): number {
    return this.queue.length;
  }
}
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
  private textBuffer: string = ''; // Buffer for handling thinking blocks across chunks
  private insideThinking: boolean = false; // Track if currently inside <think> tag
  private ttsSemaphore = new Semaphore(2); // Limit to 2 concurrent TTS requests
  
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
   * Process streaming text chunks while filtering out thinking blocks
   * Handles <think> tags that may span multiple chunks
   */
  async processTextChunk(chunk: string): Promise<void> {
    if (this.isInterrupted) {
      return;
    }
    
    // Add chunk to buffer
    this.textBuffer += chunk;
    
    // Process buffer to extract speech content (non-thinking text)
    let speechText = '';
    let i = 0;
    
    while (i < this.textBuffer.length) {
      if (this.insideThinking) {
        // Look for closing tag
        const closeTag = this.textBuffer.indexOf('</think>', i);
        if (closeTag === -1) {
          // Haven't found closing tag yet, wait for more chunks
          this.textBuffer = this.textBuffer.substring(i);
          return;
        }
        // Skip past closing tag
        i = closeTag + 8; // length of '</think>'
        this.insideThinking = false;
      } else {
        // Look for opening tag
        const openTag = this.textBuffer.indexOf('<think>', i);
        if (openTag === -1) {
          // No more thinking tags, rest is speech
          speechText += this.textBuffer.substring(i);
          this.textBuffer = '';
          break;
        }
        // Add text before opening tag to speech
        speechText += this.textBuffer.substring(i, openTag);
        // Skip to after opening tag
        i = openTag + 7; // length of '<think>'
        this.insideThinking = true;
      }
    }
    
    // If we extracted speech text, process it
    if (speechText.trim()) {
      const sentences = this.sentenceSplitter.addChunk(speechText);
      
      for (const sentence of sentences) {
        const sentenceId = this.nextSentenceId++;
        console.log(`Orchestrator: Detected sentence #${sentenceId}: "${sentence}"`);
        
        this.options.onSentenceDetected?.(sentence, sentenceId);
        
        // Synthesize with concurrency limit (max 2 concurrent requests)
        this.synthesizeSentenceWithLimit(sentence, sentenceId);
      }
    }
  }
  
  /**
   * Flush remaining buffer (call when stream ends)
   */
  async flush(): Promise<void> {
    if (this.isInterrupted) {
      return;
    }
    
    // Process any remaining text in buffer (excluding incomplete thinking blocks)
    if (this.textBuffer && !this.insideThinking) {
      const cleaned = stripThinkingBlocks(this.textBuffer);
      if (cleaned.trim()) {
        this.sentenceSplitter.addChunk(cleaned);
      }
    }
    this.textBuffer = '';
    this.insideThinking = false;
    
    const lastSentence = this.sentenceSplitter.flush();
    
    if (lastSentence && lastSentence.length > 5) {
      const sentenceId = this.nextSentenceId++;
      console.log(`Orchestrator: Flushed final sentence #${sentenceId}: "${lastSentence}"`);
      
      this.options.onSentenceDetected?.(lastSentence, sentenceId);
      this.synthesizeSentenceWithLimit(lastSentence, sentenceId);
    }
  }
  
  /**
   * Wrapper to synthesize with semaphore control
   */
  private async synthesizeSentenceWithLimit(sentence: string, sentenceId: number): Promise<void> {
    await this.ttsSemaphore.acquire();
    console.log(`Orchestrator: Acquired TTS slot (active: ${this.ttsSemaphore.getActiveCount()}, queued: ${this.ttsSemaphore.getQueuedCount()})`);
    
    try {
      await this.synthesizeSentence(sentence, sentenceId);
    } finally {
      this.ttsSemaphore.release();
      console.log(`Orchestrator: Released TTS slot (active: ${this.ttsSemaphore.getActiveCount()}, queued: ${this.ttsSemaphore.getQueuedCount()})`);
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
          voice: this.getTTSSettings().voice,
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
    
    // Clear thinking block parser state
    this.textBuffer = '';
    this.insideThinking = false;
    
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
        const state = settingsStore.getState();
        return {
          voice: state.ttsVoice,
          length_scale: state.ttsSettings.length_scale,
          noise_scale: state.ttsSettings.noise_scale,
          noise_w_scale: state.ttsSettings.noise_w_scale,
        };
      }
    }
    // Fallback to defaults
    return {
      voice: 'alba',
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
