/**
 * Audio Recording Hook
 * Manages audio recording and speech-to-text transcription
 */

import { useCallback, useRef } from 'react';
import { getAudioRecorder } from '../services/audioRecorder';
import { transcribeAudio } from '../services/stt';

export interface UseRecordingOptions {
  onStart?: () => void;
  onStop?: () => void;
  onTranscribed?: (text: string) => void;
  onError?: (error: Error) => void;
  onSilence?: () => void;
}

export interface RecordingResult {
  audioBlob: Blob;
  transcription: string;
  isSilence: boolean;
}

export interface UseRecordingResult {
  startRecording: () => Promise<RecordingResult | null>;
  isRecording: boolean;
}

/**
 * Custom hook for audio recording and transcription
 * Handles VAD (Voice Activity Detection) and STT processing
 */
export function useRecording(options: UseRecordingOptions = {}): UseRecordingResult {
  const {
    onStart,
    onStop,
    onTranscribed,
    onError,
    onSilence
  } = options;
  
  const isRecordingRef = useRef(false);
  
  /**
   * Start recording, wait for completion (VAD auto-stops), then transcribe
   * Returns null if user didn't speak or if an error occurred
   */
  const startRecording = useCallback(async (): Promise<RecordingResult | null> => {
    if (isRecordingRef.current) {
      console.warn('⚠️ Already recording');
      return null;
    }
    
    isRecordingRef.current = true;
    onStart?.();
    
    try {
      console.log('🎤 Recording user speech...');
      
      // Start recording and wait for it to complete (VAD will auto-stop)
      const recorder = getAudioRecorder();
      const audioBlob = await recorder.start();
      
      isRecordingRef.current = false;
      onStop?.();
      
      // Transcribe audio
      console.log('🎯 Transcribing audio...');
      const result = await transcribeAudio(audioBlob);
      
      // Check if there's meaningful speech (not just silence)
      if (!result.text || result.text.trim().length === 0) {
        console.log('🤫 No speech detected');
        onSilence?.();
        return {
          audioBlob,
          transcription: '',
          isSilence: true
        };
      }
      
      console.log('📝 Transcription:', result.text);
      onTranscribed?.(result.text);
      
      return {
        audioBlob,
        transcription: result.text,
        isSilence: false
      };
      
    } catch (error) {
      isRecordingRef.current = false;
      const errorObj = error instanceof Error ? error : new Error('Recording failed');
      console.error('❌ Recording error:', errorObj);
      onError?.(errorObj);
      return null;
    }
  }, [onStart, onStop, onTranscribed, onError, onSilence]);
  
  return {
    startRecording,
    isRecording: isRecordingRef.current,
  };
}
