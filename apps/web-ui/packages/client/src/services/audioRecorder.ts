/**
 * Audio Recorder Service
 * Handles audio recording with Voice Activity Detection
 */

export interface AudioRecorderOptions {
  maxDuration?: number; // Maximum recording duration in ms (default: 30s)
  silenceThreshold?: number; // Volume threshold to detect silence (0-1, default: 0.02)
  silenceDuration?: number; // How long silence before stopping (ms, default: 2000)
  minDuration?: number; // Minimum recording duration before VAD kicks in (ms, default: 1000)
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private silenceTimer: number | null = null;
  private maxDurationTimer: number | null = null;
  private _recording = false;
  private recordingPromise: { resolve: (blob: Blob) => void; reject: (error: Error) => void } | null = null;
  
  private options: Required<AudioRecorderOptions> = {
    maxDuration: 30000, // 30 seconds
    silenceThreshold: 0.1, // 10% volume (high threshold for noise immunity)
    silenceDuration: 2000, // 2 seconds of silence
    minDuration: 1000, // 1 second minimum before VAD starts
  };

  constructor(options?: AudioRecorderOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  /**
   * Start recording audio with VAD
   * Returns a promise that resolves with the audio blob when recording completes
   */
  async start(): Promise<Blob> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    return new Promise<Blob>(async (resolve, reject) => {
      this.recordingPromise = { resolve, reject };

      try {
        // Get microphone access
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000, // Whisper prefers 16kHz
          } 
        });

        // Set up audio context for VAD
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        source.connect(this.analyser);

        // Set up MediaRecorder
        const mimeType = this.getSupportedMimeType();
        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          
          console.log(`✅ Recording stopped (${(audioBlob.size / 1024).toFixed(1)} KB)`);
          
          // Cleanup
          this.cleanup();
          
          // Resolve the promise
          if (this.recordingPromise) {
            this.recordingPromise.resolve(audioBlob);
            this.recordingPromise = null;
          }
        };

        this.mediaRecorder.start(100); // Collect data every 100ms
      this._recording = true;
        console.log('🎤 Recording started');

        // Start VAD monitoring after minimum duration
        setTimeout(() => {
        if (this._recording) {
            this.startVAD();
          }
        }, this.options.minDuration);

        // Set max duration timer
        this.maxDurationTimer = window.setTimeout(() => {
          console.log('⏱️ Max duration reached');
          this.stopInternal();
        }, this.options.maxDuration);

      } catch (error) {
        console.error('Failed to start recording:', error);
        this.recordingPromise = null;
        reject(error instanceof Error ? error : new Error('Failed to start recording'));
      }
    });
  }

  /**
   * Internal method to stop recording
   */
  private stopInternal(): void {
    if (!this._recording || !this.mediaRecorder) {
      return;
    }

    this.mediaRecorder.stop();
    this._recording = false;

    // Clear timers
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
  }

  /**
   * Manually stop recording (optional - VAD will auto-stop)
   */
  stop(): void {
    this.stopInternal();
  }

  /**
   * Start Voice Activity Detection
   */
  private startVAD(): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const sampleRate = this.audioContext?.sampleRate || 16000;
    
    // Calculate frequency bin indices for speech range (300-3400 Hz)
    const speechLowHz = 300;
    const speechHighHz = 3400;
    const binSize = sampleRate / (this.analyser.fftSize);
    const lowBin = Math.floor(speechLowHz / binSize);
    const highBin = Math.ceil(speechHighHz / binSize);

    const checkAudio = () => {
      if (!this._recording || !this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume in speech frequency range only
      const speechData = dataArray.slice(lowBin, highBin);
      const sum = speechData.reduce((a, b) => a + b, 0);
      const average = sum / speechData.length;
      const volume = average / 255; // Normalize to 0-1

      // Log volume for debugging (can be removed later)
      if (Math.random() < 0.1) { // Log ~10% of checks to avoid spam
        console.log(`🎚️ Speech Volume: ${(volume * 100).toFixed(1)}%`);
      }

      // Check if volume is below silence threshold
      if (volume < this.options.silenceThreshold) {
        // Start silence timer if not already started
        if (!this.silenceTimer) {
          console.log(`🤫 Silence detected (volume: ${(volume * 100).toFixed(1)}%), waiting ${this.options.silenceDuration}ms...`);
          this.silenceTimer = window.setTimeout(() => {
            console.log('⏱️ Silence timeout reached, stopping recording');
            this.stopInternal();
          }, this.options.silenceDuration);
        }
      } else {
        // Reset silence timer if there's audio
        if (this.silenceTimer) {
          console.log(`🔊 Speech detected (volume: ${(volume * 100).toFixed(1)}%), resetting silence timer`);
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      }

      // Continue monitoring
      requestAnimationFrame(checkAudio);
    };

    checkAudio();
  }

  /**
   * Get supported MIME type for recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return '';
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  /**
   * Check if currently recording
   */
  get isRecording(): boolean {
    return this._recording;
  }
}

// Singleton instance
let recorderInstance: AudioRecorder | null = null;

export function getAudioRecorder(): AudioRecorder {
  if (!recorderInstance) {
    recorderInstance = new AudioRecorder();
  }
  return recorderInstance;
}
