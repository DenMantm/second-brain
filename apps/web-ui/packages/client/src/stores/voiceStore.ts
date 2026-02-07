import { create } from 'zustand';
import { getWakeWordDetection } from '../services/wakeWord';
import { getAudioRecorder } from '../services/audioRecorder';
import { transcribeAudio } from '../services/stt';
import { synthesizeText, playAudio } from '../services/tts';
import { generateCompletion } from '../services/llm';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface VoiceState {
  // State
  isInitialized: boolean;
  isListening: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  wakeWordDetected: boolean;
  wakeWordEnabled: boolean;
  error: string | null;
  messages: Message[];
  currentTranscript: string;

  // Actions
  initialize: () => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  setWakeWordDetected: (detected: boolean) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  clearHistory: () => void;
  setError: (error: string | null) => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  // Initial state
  isInitialized: false,
  isListening: false,
  isRecording: false,
  isProcessing: false,
  isSpeaking: false,
  wakeWordDetected: false,
  wakeWordEnabled: true, // Enabled by default (no API key needed!)
  error: null,
  messages: [],
  currentTranscript: '',

  initialize: async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      // Initialize TensorFlow.js wake word detection
      const wakeWord = getWakeWordDetection();
      
      // Use 'go' as wake word (from 18-word vocabulary)
      // Available: zero, one, two, three, four, five, six, seven, eight, nine,
      //            up, down, left, right, go, stop, yes, no
      await wakeWord.initialize(['go'], 0.75);
      
      // Set up wake word detection callback
      wakeWord.onDetected(async () => {
        set({ wakeWordDetected: true });
        console.log('✨ Wake word "Go" detected!');
        
        // Start recording immediately
        try {
          await get().startRecording();
        } catch (error) {
          console.error('Failed to start recording after wake word:', error);
          set({ wakeWordDetected: false });
        }
      });

      set({ isInitialized: true, error: null });
      console.log('✅ Voice assistant initialized (TensorFlow.js)');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize';
      set({ error: errorMessage, isInitialized: false });
      throw error;
    }
  },

  startListening: async () => {
    try {
      const { wakeWordEnabled } = get();
      
      if (wakeWordEnabled) {
        const wakeWord = getWakeWordDetection();
        await wakeWord.start();
        console.log('👂 Started listening for wake word "Go"...');
      } else {
        console.log('👂 Wake word disabled - manual listening mode');
      }
      
      set({ isListening: true, error: null });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start listening';
      set({ error: errorMessage });
      throw error;
    }
  },

  stopListening: async () => {
    try {
      const { wakeWordEnabled, isRecording } = get();
      
      // Stop recording if active
      if (isRecording) {
        await get().stopRecording();
      }
      
      if (wakeWordEnabled) {
        const wakeWord = getWakeWordDetection();
        await wakeWord.stop();
      }
      
      set({ isListening: false, wakeWordDetected: false });
      console.log('⏸️ Stopped listening');
    } catch (error) {
      console.error('Error stopping listening:', error);
      set({ isListening: false, wakeWordDetected: false });
    }
  },

  startRecording: async () => {
    // Guard: Don't start if already recording or processing
    const currentState = get();
    if (currentState.isRecording || currentState.isProcessing) {
      console.log('⚠️ Already recording or processing, ignoring wake word');
      return;
    }

    try {
      set({ isRecording: true, error: null, currentTranscript: '' });
      
      console.log('🎤 Recording user speech...');
      
      // Start recording and wait for it to complete (VAD will auto-stop)
      const recorder = getAudioRecorder();
      const audioBlob = await recorder.start(); // This returns when recording completes
      
      set({ isRecording: false, isProcessing: true });
      
      // Send to STT service
      const result = await transcribeAudio(audioBlob);
      
      set({ 
        currentTranscript: result.text,
        wakeWordDetected: false, // Reset wake word flash
      });
      
      console.log('📝 User said:', result.text);
      
      // Get conversation history for context (last 10 messages)
      const history = get().messages
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));
      
      // Generate LLM response
      const llmResult = await generateCompletion(
        result.text,
        history,
        {
          systemPrompt: 'You are a helpful AI assistant. Keep responses concise and natural for voice conversation.',
          temperature: 0.7,
          maxTokens: 150,
        }
      );
      
      const responseText = llmResult.text;
      
      // Add user and assistant messages to history
      get().addMessage('user', result.text);
      get().addMessage('assistant', responseText);
      
      // Synthesize speech
      const audioResponse = await synthesizeText(responseText);
      
      set({ isProcessing: false, isSpeaking: true });
      
      // Play audio
      await playAudio(audioResponse);
      
      set({ isSpeaking: false });
      
      // Automatically start listening again for follow-up conversation
      console.log('🎙️ Ready for follow-up - listening...');
      get().startRecording();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Recording failed';
      set({ 
        error: errorMessage, 
        isRecording: false, 
        isProcessing: false,
        wakeWordDetected: false,
      });
      console.error('Recording error:', error);
    }
  },

  stopRecording: async () => {
    try {
      const recorder = getAudioRecorder();
      if (recorder.isRecording) {
        recorder.stop();
        set({ isRecording: false });
        console.log('⏹️ Recording stopped manually');
      }
    } catch (error) {
      console.error('Error stopping listening:', error);
      set({ isListening: false, wakeWordDetected: false });
    }
  },

  setWakeWordDetected: (detected: boolean) => {
    set({ wakeWordDetected: detected });
  },

  setWakeWordEnabled: (enabled: boolean) => {
    set({ wakeWordEnabled: enabled });
  },

  setProcessing: (processing: boolean) => {
    set({ isProcessing: processing });
  },

  setSpeaking: (speaking: boolean) => {
    set({ isSpeaking: speaking });
  },

  addMessage: (role: 'user' | 'assistant', content: string) => {
    const message: Message = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, message] }));
  },

  clearHistory: () => {
    set({ messages: [] });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
