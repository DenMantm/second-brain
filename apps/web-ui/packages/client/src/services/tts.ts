/**
 * TTS (Text-to-Speech) Service Client
 */

const API_BASE_URL = '/api/tts';

export interface TTSOptions {
  voice?: string;
  speed?: number; // 0.5 to 2.0
}

export interface TTSResult {
  audio: string; // Base64 encoded audio
  duration: number;
  sample_rate: number;
}

/**
 * Synthesize text to speech
 */
export async function synthesizeText(
  text: string,
  options?: TTSOptions
): Promise<Blob> {
  try {
    console.log(`🔊 Synthesizing speech: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    const response = await fetch(`${API_BASE_URL}/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice: options?.voice,
        speed: options?.speed,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`TTS service error: ${error.error || response.statusText}`);
    }

    const result: TTSResult = await response.json();
    
    // Convert base64 audio to blob
    const audioData = atob(result.audio);
    const arrayBuffer = new ArrayBuffer(audioData.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < audioData.length; i++) {
      uint8Array[i] = audioData.charCodeAt(i);
    }
    
    const audioBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
    
    console.log(`✅ Speech synthesized (${(audioBlob.size / 1024).toFixed(1)} KB, ${result.duration.toFixed(2)}s)`);
    
    return audioBlob;
  } catch (error) {
    console.error('TTS failed:', error);
    throw error;
  }
}

/**
 * Play audio blob
 */
let currentAudio: HTMLAudioElement | null = null;

export async function playAudio(audioBlob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      resolve();
    };
    
    audio.onerror = (error) => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      reject(error);
    };
    
    audio.play().catch(reject);
  });
}

/**
 * Stop currently playing audio
 */
export function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

/**
 * Check TTS service health
 */
export async function checkTTSHealth(): Promise<{ status: string; url: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('TTS health check failed:', error);
    return { status: 'unavailable', url: 'unknown' };
  }
}
