/**
 * Speech-to-Text Service Client
 * Sends audio to STT service and returns transcription
 */

const API_BASE_URL = '/api/stt';

export interface TranscriptionResult {
  text: string;
  segments: Array<{
    text: string;
    start: number;
    end: number;
  }>;
  language: string;
  language_probability: number;
  duration: number;
  inference_time: number;
}

export interface TranscribeOptions {
  language?: string; // Language code (e.g., 'en', 'es'), null for auto-detect
  task?: 'transcribe' | 'translate'; // translate = translate to English
}

/**
 * Convert audio blob to WAV format
 */
async function convertToWav(audioBlob: Blob): Promise<Blob> {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Get audio data
  const channelData = audioBuffer.getChannelData(0); // Mono
  const samples = new Int16Array(channelData.length);
  
  // Convert float to int16
  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  // Create WAV file
  const wavBuffer = createWavBuffer(samples, audioBuffer.sampleRate);
  audioContext.close();
  
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Create WAV file buffer
 */
function createWavBuffer(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  // Write samples
  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset + i * 2, samples[i], true);
  }
  
  return buffer;
}

/**
 * Write string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Transcribe audio blob
 */
export async function transcribeAudio(
  audioBlob: Blob,
  options?: TranscribeOptions
): Promise<TranscriptionResult> {
  try {
    // Convert to WAV format for better compatibility with Faster Whisper
    console.log(`🔄 Converting ${audioBlob.type} to WAV format...`);
    const wavBlob = await convertToWav(audioBlob);
    
    // Convert blob to file format expected by STT service
    const formData = new FormData();
    
    // Create a file with WAV extension
    const file = new File([wavBlob], 'recording.wav', {
      type: 'audio/wav',
    });
    
    formData.append('audio', file);
    
    if (options?.language) {
      formData.append('language', options.language);
    }
    
    if (options?.task) {
      formData.append('task', options.task);
    }

    console.log(`📤 Sending audio to STT service (${(audioBlob.size / 1024).toFixed(1)} KB)...`);
    
    const response = await fetch(`${API_BASE_URL}/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`STT service error: ${error.error || response.statusText}`);
    }

    const result: TranscriptionResult = await response.json();
    
    console.log(`✅ Transcription received: "${result.text}"`);
    console.log(`   Language: ${result.language} (${(result.language_probability * 100).toFixed(1)}%)`);
    console.log(`   Duration: ${result.duration.toFixed(2)}s, Inference: ${result.inference_time.toFixed(2)}s`);
    
    return result;
  } catch (error) {
    console.error('Transcription failed:', error);
    throw error;
  }
}

/**
 * Check STT service health
 */
export async function checkSTTHealth(): Promise<{ status: string; url: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('STT health check failed:', error);
    return { status: 'unavailable', url: 'unknown' };
  }
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  };

  // Check exact match
  if (map[mimeType]) {
    return map[mimeType];
  }

  // Check prefix match
  for (const [mime, ext] of Object.entries(map)) {
    if (mimeType.startsWith(mime)) {
      return ext;
    }
  }

  return 'webm'; // Default
}
