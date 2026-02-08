/**
 * Tests for RecordingManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RecordingManager } from '../recordingManager';

// Mock audio recorder
vi.mock('../audioRecorder', () => ({
  getAudioRecorder: vi.fn(() => ({
    start: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'audio/wav' })),
    stop: vi.fn(),
    isRecording: false
  }))
}));

// Mock STT service
vi.mock('../stt', () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    text: 'Hello world',
    segments: [],
    language: 'en',
    language_probability: 0.95,
    duration: 1.5,
    inference_time: 0.2
  })
}));

describe('RecordingManager', () => {
  let manager: RecordingManager;
  let callbacks: any;
  
  beforeEach(() => {
    callbacks = {
      onStart: vi.fn(),
      onStop: vi.fn(),
      onTranscribed: vi.fn(),
      onSilence: vi.fn(),
      onError: vi.fn(),
    };
    manager = new RecordingManager(callbacks);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should create instance with callbacks', () => {
    expect(manager).toBeInstanceOf(RecordingManager);
  });
  
  it('should record and transcribe audio', async () => {
    const result = await manager.record();
    
    expect(callbacks.onStart).toHaveBeenCalled();
    expect(callbacks.onStop).toHaveBeenCalled();
    expect(callbacks.onTranscribed).toHaveBeenCalledWith('Hello world');
    expect(result).toEqual({
      audioBlob: expect.any(Blob),
      transcription: 'Hello world',
      isEmpty: false
    });
  });
  
  it('should handle empty transcription (silence)', async () => {
    const { transcribeAudio } = await import('../stt');
    vi.mocked(transcribeAudio).mockResolvedValueOnce({
      text: '',
      segments: [],
      language: 'en',
      language_probability: 0,
      duration: 0,
      inference_time: 0
    });
    
    const result = await manager.record();
    
    expect(callbacks.onSilence).toHaveBeenCalled();
    expect(result?.isEmpty).toBe(true);
  });
  
  it('should handle recording errors', async () => {
    const { getAudioRecorder } = await import('../audioRecorder');
    vi.mocked(getAudioRecorder).mockReturnValueOnce({
      start: vi.fn().mockRejectedValue(new Error('Microphone error')),
      stop: vi.fn(),
      isRecording: false
    } as any);
    
    const result = await manager.record();
    
    expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    expect(result).toBeNull();
  });
  
  it('should prevent concurrent recordings', async () => {
    const promise1 = manager.record();
    const promise2 = manager.record(); // Should return null immediately
    
    const result2 = await promise2;
    expect(result2).toBeNull();
    
    await promise1; // Wait for first to complete
  });
  
  it('should update callbacks', () => {
    const newCallbacks = {
      onStart: vi.fn(),
    };
    
    manager.setCallbacks(newCallbacks);
    // Callbacks should be updated
  });
  
  it('should check if recording', () => {
    const isRecording = manager.getIsRecording();
    expect(typeof isRecording).toBe('boolean');
  });
});
