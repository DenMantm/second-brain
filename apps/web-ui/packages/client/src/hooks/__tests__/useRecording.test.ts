/**
 * Tests for useRecording hook
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRecording } from '../useRecording';

// Mock audio recorder
vi.mock('../../services/audioRecorder', () => ({
  getAudioRecorder: vi.fn(() => ({
    start: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'audio/wav' })),
    stop: vi.fn(),
    isRecording: false
  }))
}));

// Mock STT service
vi.mock('../../services/stt', () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    text: 'Hello world',
    segments: [],
    language: 'en',
    language_probability: 0.95,
    duration: 1.5,
    inference_time: 0.2
  })
}));

describe('useRecording', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should initialize with callbacks', () => {
    const callbacks = {
      onStart: vi.fn(),
      onStop: vi.fn(),
      onTranscribed: vi.fn(),
      onSilence: vi.fn(),
      onError: vi.fn(),
    };
    
    const { result } = renderHook(() => useRecording(callbacks));
    
    expect(result.current).toHaveProperty('startRecording');
    expect(result.current).toHaveProperty('isRecording');
  });
  
  it('should start recording and transcribe', async () => {
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useRecording({ onTranscribed }));
    
    const recordingResult = await result.current.startRecording();
    
    await waitFor(() => {
      expect(onTranscribed).toHaveBeenCalledWith('Hello world');
    });
    
    expect(recordingResult).toEqual({
      audioBlob: expect.any(Blob),
      transcription: 'Hello world',
      isSilence: false
    });
  });
  
  it('should handle silence detection', async () => {
    const { transcribeAudio } = await import('../../services/stt');
    vi.mocked(transcribeAudio).mockResolvedValueOnce({
      text: '',
      segments: [],
      language: 'en',
      language_probability: 0,
      duration: 0,
      inference_time: 0
    });
    
    const onSilence = vi.fn();
    const { result } = renderHook(() => useRecording({ onSilence }));
    
    const recordingResult = await result.current.startRecording();
    
    await waitFor(() => {
      expect(onSilence).toHaveBeenCalled();
    });
    
    expect(recordingResult?.isSilence).toBe(true);
  });
  
  it('should handle recording errors', async () => {
    const { getAudioRecorder } = await import('../../services/audioRecorder');
    vi.mocked(getAudioRecorder).mockReturnValueOnce({
      start: vi.fn().mockRejectedValue(new Error('Microphone error')),
      stop: vi.fn(),
      isRecording: false
    } as any);
    
    const onError = vi.fn();
    const { result } = renderHook(() => useRecording({ onError }));
    
    const recordingResult = await result.current.startRecording();
    
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
    
    expect(recordingResult).toBeNull();
  });
  
  it('should call onStart callback', async () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => useRecording({ onStart }));
    
    result.current.startRecording();
    
    await waitFor(() => {
      expect(onStart).toHaveBeenCalled();
    });
  });
  
  it('should call onStop callback', async () => {
    const onStop = vi.fn();
    const { result } = renderHook(() => useRecording({ onStop }));
    
    await result.current.startRecording();
    
    await waitFor(() => {
      expect(onStop).toHaveBeenCalled();
    });
  });
  
  it('should prevent concurrent recordings', async () => {
    const { result } = renderHook(() => useRecording());
    
    const promise1 = result.current.startRecording();
    const promise2 = result.current.startRecording();
    
    const result2 = await promise2;
    expect(result2).toBeNull();
    
    await promise1;
  });
});
