import { create } from 'zustand';
import { getWakeWordDetection } from '../services/wakeWord';
import { getAudioRecorder } from '../services/audioRecorder';
import { transcribeAudio } from '../services/stt';
import { synthesizeText, playAudio, stopAudio } from '../services/tts';
import { generateCompletion } from '../services/llm';
import { 
  createNewConversation, 
  fetchConversations, 
  loadConversation as loadConversationAPI,
  deleteConversation as deleteConversationAPI,
  type ConversationMetadata 
} from '../services/conversations';

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
  currentConversationId: string | null;
  conversations: ConversationMetadata[];

  // Actions
  initialize: () => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  interrupt: () => Promise<void>;
  stopConversation: () => Promise<void>;
  setWakeWordDetected: (detected: boolean) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  clearHistory: () => void;
  setError: (error: string | null) => void;
  
  // Conversation management
  startNewConversation: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
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
  currentConversationId: null,
  conversations: [],

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
        const { isSpeaking, isProcessing } = get();
        
        // If AI is speaking or processing, interrupt it
        if (isSpeaking || isProcessing) {
          console.log('🛑 Interrupting AI to listen to new input...');
          await get().interrupt();
          
          // Small delay to ensure clean state
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
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
        // Only start if initialized
        if (wakeWord.isInitialized()) {
          await wakeWord.start();
          console.log('👂 Started listening for wake word "Go"...');
        } else {
          console.warn('⚠️ Wake word detection not initialized, skipping start');
        }
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
      
      // Check if there's meaningful speech (not just silence)
      if (!result.text || result.text.trim().length === 0) {
        console.log('🤫 No speech detected, returning to wake word mode');
        set({ 
          isProcessing: false,
          currentTranscript: '',
          wakeWordDetected: false,
        });
        return; // Go back to listening for wake word
      }
      
      set({ 
        currentTranscript: result.text,
        wakeWordDetected: false, // Reset wake word flash
      });
      
      console.log('📝 User said:', result.text);
      
      // Get or create conversation ID
      let conversationId = get().currentConversationId;
      if (!conversationId) {
        const conversation = await createNewConversation(result.text);
        conversationId = conversation.id;
        set({ currentConversationId: conversationId });
        await get().refreshConversations();
      }
      
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
          sessionId: conversationId,
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

  interrupt: async () => {
    try {
      console.log('⏸️ Interrupting AI - staying in conversation...');
      
      // Stop audio playback
      stopAudio();
      
      // Update state to stop speaking
      set({ isSpeaking: false });
      
      // If not recording, start recording to let user continue speaking
      if (!get().isRecording && !get().isProcessing) {
        await get().startRecording();
      }
      
      console.log('✅ Interrupted - ready for your input');
    } catch (error) {
      console.error('Error during interrupt:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Interrupt failed',
        isSpeaking: false,
      });
    }
  },

  stopConversation: async () => {
    try {
      console.log('🛑 Stopping conversation...');
      
      // Stop audio playback
      stopAudio();
      
      // Stop recording if active
      const recorder = getAudioRecorder();
      if (recorder.isRecording) {
        recorder.stop();
      }
      
      // Reset all states
      set({ 
        isRecording: false,
        isProcessing: false,
        isSpeaking: false,
        wakeWordDetected: false,
      });
      
      // Return to wake word listening
      await get().startListening();
      
      console.log('✅ Conversation stopped - listening for wake word');
    } catch (error) {
      console.error('Error stopping conversation:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Stop failed',
        isRecording: false,
        isProcessing: false,
        isSpeaking: false,
      });
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

  // Conversation management
  startNewConversation: async () => {
    try {
      console.log('🆕 Starting new conversation...');
      
      // Stop any ongoing activity
      stopAudio();
      const recorder = getAudioRecorder();
      if (recorder.isRecording) {
        recorder.stop();
      }
      
      // Create new conversation on server
      const conversation = await createNewConversation();
      
      // Reset state with new conversation ID
      set({ 
        messages: [],
        currentConversationId: conversation.id,
        isRecording: false,
        isProcessing: false,
        isSpeaking: false,
        wakeWordDetected: false,
        currentTranscript: '',
      });
      
      // Refresh conversation list
      await get().refreshConversations();
      
      // Return to wake word listening
      await get().startListening();
      
      console.log('✅ New conversation started:', conversation.id);
    } catch (error) {
      console.error('Failed to start new conversation:', error);
      set({ error: 'Failed to start new conversation' });
    }
  },

  loadConversation: async (conversationId: string) => {
    try {
      console.log('📂 Loading conversation:', conversationId);
      
      // Stop any ongoing activity
      stopAudio();
      const recorder = getAudioRecorder();
      if (recorder.isRecording) {
        recorder.stop();
      }
      
      // Load conversation from server
      const conversation = await loadConversationAPI(conversationId);
      
      // Convert messages to local format
      const messages: Message[] = conversation.messages.map((msg, index) => ({
        id: `${conversationId}-${index}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp).getTime(),
      }));
      
      // Update state
      set({ 
        messages,
        currentConversationId: conversationId,
        isRecording: false,
        isProcessing: false,
        isSpeaking: false,
        wakeWordDetected: false,
        currentTranscript: '',
      });
      
      // Return to wake word listening
      await get().startListening();
      
      console.log('✅ Conversation loaded:', conversationId, `(${messages.length} messages)`);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      set({ error: 'Failed to load conversation' });
    }
  },

  deleteConversation: async (conversationId: string) => {
    try {
      console.log('🗑️ Deleting conversation:', conversationId);
      
      await deleteConversationAPI(conversationId);
      
      // If we just deleted the current conversation, start a new one
      if (get().currentConversationId === conversationId) {
        await get().startNewConversation();
      } else {
        await get().refreshConversations();
      }
      
      console.log('✅ Conversation deleted');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      set({ error: 'Failed to delete conversation' });
    }
  },

  refreshConversations: async () => {
    try {
      const conversations = await fetchConversations();
      set({ conversations });
    } catch (error) {
      console.error('Failed to refresh conversations:', error);
    }
  },
}));
