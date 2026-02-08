import { create } from 'zustand';
import { getWakeWordDetection } from '../services/wakeWord';
import { getAudioRecorder } from '../services/audioRecorder';
import { transcribeAudio } from '../services/stt';
import { stopAudio } from '../services/tts';
import { generateCompletionStream } from '../services/llm';
import { StreamingOrchestrator } from '../services/streamingOrchestrator';
import { 
  createNewConversation, 
  fetchConversations, 
  loadConversation as loadConversationAPI,
  deleteConversation as deleteConversationAPI,
  type ConversationMetadata 
} from '../services/conversations';

// Expose wake word service for E2E testing
// This allows E2E tests to verify the internal state of wake word detection
if (typeof window !== 'undefined') {
  // Always expose in non-production or when explicitly requested for testing
  if (import.meta.env.MODE !== 'production' || import.meta.env.VITE_EXPOSE_TEST_HOOKS === 'true') {
    (window as any).__getWakeWordService = () => getWakeWordDetection();
  }
}

// Global streaming orchestrator instance
let streamingOrchestrator: StreamingOrchestrator | null = null;

function getStreamingOrchestrator(): StreamingOrchestrator {
  if (!streamingOrchestrator) {
    streamingOrchestrator = new StreamingOrchestrator({
      onSentenceDetected: (sentence, index) => {
        console.log(`📝 Sentence ${index}: "${sentence.substring(0, 50)}..."`);
      },
      onTTSStart: async (_sentence, index) => {
        console.log(`🎤 TTS started for sentence ${index}`);
      },
      onTTSComplete: (_sentence, index) => {
        console.log(`✅ TTS complete for sentence ${index}`);
      },
      onTTSError: (_sentence, index, error) => {
        console.error(`❌ TTS error for sentence ${index}:`, error);
        // Don't set error state for individual sentence failures
        // The orchestrator will retry automatically
      },
      onComplete: async () => {
        console.log('🎵 All audio playback complete');
        // Update store state when playback finishes
        const store = useVoiceStore.getState();
        store.setSpeaking(false);
        
        // Automatically start recording again for continuous conversation
        console.log('🎙️ Starting recording for continuous conversation...');
        try {
          await store.startRecording();
        } catch (error) {
          console.error('❌ Failed to auto-start recording:', error);
          // Fallback to wake word detection if recording fails
          const wakeWord = getWakeWordDetection();
          if (wakeWord.isInitialized() && store.wakeWordEnabled && !wakeWord.isListening) {
            await wakeWord.start();
            console.log('👂 Resumed wake word detection as fallback');
          }
        }
      }
    });
  }
  return streamingOrchestrator;
}

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
  streamingText: string;
  currentConversationId: string | null;
  conversations: ConversationMetadata[];

  // Actions
  initialize: () => Promise<void>;
  reinitializeWakeWord: (newWakeWord: string) => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  interrupt: () => Promise<void>;
  stopConversation: () => Promise<void>;
  manualTrigger: () => Promise<void>;
  setWakeWordDetected: (detected: boolean) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  updateStreamingText: (text: string) => void;
  clearStreamingText: () => void;
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
  streamingText: '',
  currentConversationId: null,
  conversations: [],

  initialize: async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      // Initialize TensorFlow.js wake word detection
      const wakeWord = getWakeWordDetection();
      
      // Get wake word from settings (fallback to 'go')
      const settingsStore = typeof window !== 'undefined' ? (window as any).__settingsStore : null;
      const selectedWakeWord = settingsStore?.getState?.().selectedWakeWord || 'go';
      
      // Use wake word from settings (from 18-word vocabulary)
      // Available: zero, one, two, three, four, five, six, seven, eight, nine,
      //            up, down, left, right, go, stop, yes, no
      await wakeWord.initialize([selectedWakeWord], 0.75);
      
      console.log(`✨ Initialized wake word: "${selectedWakeWord}"`);
      
      // Set up wake word detection callback
      wakeWord.onDetected(async () => {
        const { isSpeaking, isProcessing, isRecording } = get();
        
        // Check if already recording - avoid duplicate recording attempts
        if (isRecording) {
          console.log('⚠️ Wake word detected but already recording, ignoring');
          return;
        }
        
        // Stop wake word detection immediately to prevent it staying active during conversation
        await wakeWord.stop();
        console.log('🔇 Wake word detection stopped - starting conversation');
        
        // If AI is speaking or processing, interrupt it
        if (isSpeaking || isProcessing) {
          console.log('🛑 Interrupting AI to listen to new input...');
          await get().interrupt();
          
          // Small delay to ensure clean state
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        set({ wakeWordDetected: true });
        console.log(`✨ Wake word "${selectedWakeWord}" detected!`);
        
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

  reinitializeWakeWord: async (newWakeWord: string) => {
    try {
      console.log(`🔄 Reinitializing wake word to "${newWakeWord}"...`);
      
      const { isListening, isSpeaking, isProcessing } = get();
      
      // Don't reinitialize if AI is speaking or processing - avoid interruptions
      if (isSpeaking || isProcessing) {
        console.warn('⚠️ Deferring wake word change - AI is currently active');
        // The wake word will be picked up from settings on next initialize/startListening
        return;
      }
      
      const wakeWord = getWakeWordDetection();
      
      // Stop current wake word detection
      if (isListening) {
        await wakeWord.stop();
      }
      
      // Re-initialize with new wake word
      await wakeWord.initialize([newWakeWord], 0.75);
      
      // Set up wake word detection callback with new wake word
      wakeWord.onDetected(async () => {
        const { isSpeaking, isProcessing } = get();
        
        if (isSpeaking || isProcessing) {
          console.log('🛑 Interrupting AI to listen to new input...');
          await get().interrupt();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        set({ wakeWordDetected: true });
        console.log(`✨ Wake word "${newWakeWord}" detected!`);
        
        try {
          await get().startRecording();
        } catch (error) {
          console.error('Failed to start recording after wake word:', error);
          set({ wakeWordDetected: false });
        }
      });
      
      // Resume listening if it was active
      if (isListening) {
        await wakeWord.start();
        console.log(`👂 Resumed listening for wake word "${newWakeWord}"`);
      }
      
      console.log(`✅ Wake word changed to "${newWakeWord}"`);
    } catch (error) {
      console.error('Failed to reinitialize wake word:', error);
      set({ error: 'Failed to change wake word' });
    }
  },

  startListening: async () => {
    try {
      const { wakeWordEnabled } = get();
      
      if (wakeWordEnabled) {
        const wakeWord = getWakeWordDetection();
        const settingsStore = typeof window !== 'undefined' ? (window as any).__settingsStore : null;
        const selectedWakeWord = settingsStore?.getState?.().selectedWakeWord || 'go';
        
        // Only start if initialized
        if (wakeWord.isInitialized()) {
          await wakeWord.start();
          console.log(`👂 Started listening for wake word "${selectedWakeWord}"...`);
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
        
        // Resume wake word detection since user stopped talking
        const wakeWord = getWakeWordDetection();
        if (wakeWord.isInitialized() && get().wakeWordEnabled && !wakeWord.isListening) {
          await wakeWord.start();
          console.log('👂 Wake word detection resumed after silence');
        }
        return;
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
      
      // Add user message to history
      get().addMessage('user', result.text);
      
      // Use streaming orchestrator for LLM -> TTS -> Audio pipeline
      const orchestrator = getStreamingOrchestrator();
      let fullResponseText = '';
      
      // Create AbortController for interruption support
      const abortController = new AbortController();
      
      // Store abort controller for interrupt function
      (get() as any)._currentAbortController = abortController;
      
      try {
        // Stream LLM response chunks
        const stream = generateCompletionStream(
          result.text,
          {
            sessionId: conversationId,
            temperature: 0.7,
            maxTokens: 2048, // Allow longer responses for natural conversation
            signal: abortController.signal,
          }
        );
        
        set({ isProcessing: false, isSpeaking: true });
        
        // Stop wake word detection IMMEDIATELY to prevent false triggers during TTS
        const wakeWord = getWakeWordDetection();
        if (wakeWord.isInitialized()) {
          await wakeWord.stop();
          console.log('🔇 Wake word detection stopped - starting AI response');
        }
        
        // Clear any previous streaming text
        get().clearStreamingText();
        
        // Process each chunk through the orchestrator
        for await (const chunk of stream) {
          if (abortController.signal.aborted) {
            console.log('🛑 LLM stream aborted');
            break;
          }
          
          fullResponseText += chunk;
          // Update streaming text to show partial response
          get().updateStreamingText(fullResponseText);
          await orchestrator.processTextChunk(chunk);
        }
        
        // Flush any remaining buffered text
        if (!abortController.signal.aborted) {
          await orchestrator.flush();
        }
        
        // Clear streaming text and add final message to history
        get().clearStreamingText();
        if (fullResponseText.trim()) {
          get().addMessage('assistant', fullResponseText);
        }
        
        // Wait for all audio to finish playing
        // The orchestrator handles playback internally
        // We'll detect completion via the onComplete callback
        
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('🛑 Streaming interrupted by user');
        } else {
          throw error;
        }
      } finally {
        // Clean up abort controller reference
        delete (get() as any)._currentAbortController;
      }
      
      // Note: isSpeaking will be set to false and listening will resume
      // automatically via the onComplete callback after all audio finishes playing
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Recording failed';
      set({ 
        error: errorMessage, 
        isRecording: false, 
        isProcessing: false,
        isSpeaking: false,
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
      
      // Interrupt the streaming orchestrator (stops TTS requests + clears audio queue)
      const orchestrator = getStreamingOrchestrator();
      orchestrator.interrupt();
      
      // Abort LLM stream if active
      const abortController = (get() as any)._currentAbortController;
      if (abortController) {
        abortController.abort();
      }
      
      // Stop any legacy audio playback (fallback)
      stopAudio();
      
      // Clear streaming text and update state to stop speaking
      get().clearStreamingText();
      set({ isSpeaking: false });
      
      // Don't restart wake word detection here - it will be restarted after recording completes
      // Wake word detection should remain stopped during user recording
      
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

  manualTrigger: async () => {
    try {
      const { isSpeaking, isProcessing, isListening } = get();
      
      if (!isListening) {
        console.warn('Cannot manually trigger - not listening');
        return;
      }
      
      // If AI is speaking or processing, interrupt it
      if (isSpeaking || isProcessing) {
        console.log('🛑 Interrupting AI for manual trigger...');
        await get().interrupt();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      set({ wakeWordDetected: true });
      console.log('🎤 Manual trigger activated');
      
      // Start recording immediately
      await get().startRecording();
    } catch (error) {
      console.error('Manual trigger failed:', error);
      set({ wakeWordDetected: false });
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

  updateStreamingText: (text) => {
    set({ streamingText: text });
  },

  clearStreamingText: () => {
    set({ streamingText: '' });
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
