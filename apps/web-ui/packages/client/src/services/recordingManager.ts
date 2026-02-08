/**
 * Recording Manager
 * Service-level manager for audio recording and transcription
 */

import { getAudioRecorder } from './audioRecorder';
import { transcribeAudio } from './stt';

export interface RecordingResult {
  audioBlob: Blob;
  transcription: string;
  isEmpty: boolean;
}

export interface RecordingManagerCallbacks {
  onStart?: () => void;
  onStop?: () => void;
  onTranscribed?: (text: string) => void;
  onSilence?: () => void;
  onError?: (error: Error) => void;
}

export class RecordingManager {
  private callbacks: RecordingManagerCallbacks;
  private isRecording: boolean = false;
  
  constructor(callbacks: RecordingManagerCallbacks = {}) {
    this.callbacks = callbacks;
  }
  
  /**
   * Update callbacks
   */
  setCallbacks(callbacks: RecordingManagerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
  
  /**
   * Start recording and transcribe
   * Returns null if already recording or if error occurs
   */
  async record(): Promise<RecordingResult | null> {
    if (this.isRecording) {
      console.warn('⚠️ Already recording');
      return null;
    }
    
    this.isRecording = true;
    this.callbacks.onStart?.();
    
    try {
      console.log('🎤 Recording user speech...');
      
      // Record audio (VAD will auto-stop)
      const recorder = getAudioRecorder();
      const audioBlob = await recorder.start();
      
      this.isRecording = false;
      this.callbacks.onStop?.();
      
      // Transcribe
      console.log('🎯 Transcribing audio...');
      const result = await transcribeAudio(audioBlob);
      
      // Check for silence
      const isEmpty = !result.text || result.text.trim().length === 0;
      
      if (isEmpty) {
        console.log('🤫 No speech detected');
        this.callbacks.onSilence?.();
        return {
          audioBlob,
          transcription: '',
          isEmpty: true
        };
      }
      
      console.log('📝 Transcription:', result.text);
      this.callbacks.onTranscribed?.(result.text);
      
      return {
        audioBlob,
        transcription: result.text,
        isEmpty: false
      };
      
    } catch (error) {
      this.isRecording = false;
      const err = error instanceof Error ? error : new Error('Recording failed');
      console.error('❌ Recording error:', err);
      this.callbacks.onError?.(err);
      return null;
    }
  }
  
  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }
}
