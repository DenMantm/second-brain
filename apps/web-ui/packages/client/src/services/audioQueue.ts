/**
 * Audio Queue Manager - Sequential audio playback with queuing
 */

export interface AudioQueueOptions {
  maxQueueSize?: number;
  onQueueEmpty?: () => void;
  onQueueUpdate?: (queueLength: number) => void;
  onPlaybackStart?: (index: number) => void;
  onPlaybackEnd?: (index: number) => void;
  onError?: (error: Error) => void;
}

interface QueuedAudio {
  id: number;
  arrayBuffer: ArrayBuffer;
  audioBuffer?: AudioBuffer;
}

export class AudioQueueManager {
  private queue: QueuedAudio[] = [];
  private isPlaying: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private audioContext: AudioContext;
  private nextId: number = 0;
  private maxQueueSize: number;
  private options: AudioQueueOptions;
  private isInterrupted: boolean = false;
  
  constructor(options: AudioQueueOptions = {}) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.maxQueueSize = options.maxQueueSize ?? 10;
    this.options = options;
  }
  
  /**
   * Add audio data to queue and start playback if needed
   */
  async enqueue(audioData: ArrayBuffer): Promise<void> {
    if (this.isInterrupted) {
      console.log('AudioQueue: Ignoring enqueue, interrupted');
      return;
    }
    
    if (this.queue.length >= this.maxQueueSize) {
      console.warn(`AudioQueue: Queue full (${this.maxQueueSize}), dropping oldest`);
      this.queue.shift();
    }
    
    const queuedAudio: QueuedAudio = {
      id: this.nextId++,
      arrayBuffer: audioData
    };
    
    this.queue.push(queuedAudio);
    this.options.onQueueUpdate?.(this.queue.length);
    
    console.log(`AudioQueue: Enqueued audio #${queuedAudio.id}, queue length: ${this.queue.length}`);
    
    // Start playback if not already playing
    if (!this.isPlaying) {
      this.playNext();
    }
  }
  
  /**
   * Play next audio in queue
   */
  private async playNext(): Promise<void> {
    if (this.isInterrupted) {
      console.log('AudioQueue: Playback interrupted');
      this.isPlaying = false;
      return;
    }
    
    if (this.queue.length === 0) {
      console.log('AudioQueue: Queue empty, stopping playback');
      this.isPlaying = false;
      this.options.onQueueEmpty?.();
      return;
    }
    
    this.isPlaying = true;
    const queuedAudio = this.queue.shift()!;
    this.options.onQueueUpdate?.(this.queue.length);
    
    try {
      console.log(`AudioQueue: Playing audio #${queuedAudio.id}`);
      
      // Decode if not already decoded
      if (!queuedAudio.audioBuffer) {
        queuedAudio.audioBuffer = await this.audioContext.decodeAudioData(
          queuedAudio.arrayBuffer.slice(0) // Clone to avoid detached buffer
        );
      }
      
      // Create and play source
      const source = this.audioContext.createBufferSource();
      source.buffer = queuedAudio.audioBuffer;
      source.connect(this.audioContext.destination);
      
      this.currentSource = source;
      this.options.onPlaybackStart?.(queuedAudio.id);
      
      // Set up completion handler
      source.onended = () => {
        console.log(`AudioQueue: Finished playing audio #${queuedAudio.id}`);
        this.currentSource = null;
        this.options.onPlaybackEnd?.(queuedAudio.id);
        
        // Play next in queue
        this.playNext();
      };
      
      source.start(0);
      
    } catch (error) {
      console.error(`AudioQueue: Error playing audio #${queuedAudio.id}:`, error);
      this.options.onError?.(error as Error);
      
      // Try next audio
      this.playNext();
    }
  }
  
  /**
   * Clear queue and stop current playback
   */
  clear(): void {
    console.log('AudioQueue: Clearing queue');
    
    this.isInterrupted = true;
    
    // Stop current playback
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
      this.currentSource = null;
    }
    
    // Clear queue
    this.queue = [];
    this.isPlaying = false;
    this.options.onQueueUpdate?.(0);
    
    // Reset interrupt flag after a short delay
    setTimeout(() => {
      this.isInterrupted = false;
    }, 100);
  }
  
  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }
  
  /**
   * Check if currently playing
   */
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }
  
  /**
   * Resume audio context (needed after user interaction)
   */
  async resume(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('AudioQueue: Audio context resumed');
    }
  }
  
  /**
   * Cleanup resources
   */
  dispose(): void {
    this.clear();
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}
