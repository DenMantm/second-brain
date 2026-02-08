import { create } from 'zustand';
import { StreamingOrchestrator } from '../services/streamingOrchestrator';
import { stopAudio } from '../services/tts';
import { getAudioRecorder } from '../services/audioRecorder';
import { 
  WakeWordManager,
  RecordingManager,
  LLMStreamManager,
  ConversationManager,
  type ConversationManagerCallbacks
} from '../services';
import type { ConversationMetadata } from '../services/conversations';

// Expose wake word service for E2E testing
if (typeof window !== 'undefined') {
  if (import.meta.env.MODE !== 'production' || import.meta.env.VITE_EXPOSE_TEST_HOOKS === 'true') {
    (window as any).__getWakeWordService = () => {
      const settingsStore = (window as any).__settingsStore;
      const wakeWord = settingsStore?.getState?.().selectedWakeWord || 'go';
      const manager = new WakeWordManager(wakeWord);
      return {
        isInitialized: () => manager.isInitialized(),
        getIsListening: () => manager.isListening(),
      };
    };
  }
}

// Manager instances
let wakeWordManager: WakeWordManager | null = null;
let recordingManager: RecordingManager | null = null;
let llmStreamManager: LLMStreamManager | null = null;
let conversationManager: ConversationManager | null = null;
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
      },
      onComplete: async () => {
        console.log('🎵 All audio playback complete');
        const store = useVoiceStore.getState();
        store.setSpeaking(false);
        
        // Automatically start recording again for continuous conversation
        console.log('🎙️ Starting recording for continuous conversation...');
        try {
          await store.startRecording();
        } catch (error) {
          console.error('❌ Failed to auto-start recording:', error);
          // Fallback to wake word detection
          if (!wakeWordManager) return;
          if (wakeWordManager.isInitialized() && store.wakeWordEnabled && !wakeWordManager.isListening()) {
            await wakeWordManager.start();
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
  role: 'user' | 'assistant' | 'system';
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
  addMessage: (role: 'user' | 'assistant' | 'system', content: string) => void;
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
  wakeWordEnabled: true,
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

      // Get wake word from settings
      const settingsStore = typeof window !== 'undefined' ? (window as any).__settingsStore : null;
      const selectedWakeWord = settingsStore?.getState?.().selectedWakeWord || 'go';
      
      // Initialize wake word manager
      wakeWordManager = new WakeWordManager(selectedWakeWord);
      wakeWordManager.setCallback(async () => {
        const { isSpeaking, isProcessing, isRecording } = get();
        
        if (isRecording) {
          console.log('⚠️ Wake word detected but already recording, ignoring');
          return;
        }
        
        await wakeWordManager?.stop();
        console.log('🔇 Wake word detection stopped - starting conversation');
        
        if (isSpeaking || isProcessing) {
          console.log('🛑 Interrupting AI to listen to new input...');
          await get().interrupt();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        set({ wakeWordDetected: true });
        console.log(`✨ Wake word "${selectedWakeWord}" detected!`);
        
        try {
          await get().startRecording();
        } catch (error) {
          console.error('Failed to start recording after wake word:', error);
          set({ wakeWordDetected: false });
        }
      });
      
      await wakeWordManager.initialize();
      
      // Initialize recording manager
      recordingManager = new RecordingManager();
      
      // Initialize LLM stream manager
      llmStreamManager = new LLMStreamManager(getStreamingOrchestrator());
      
      // Initialize conversation manager
      const conversationCallbacks: ConversationManagerCallbacks = {
        onConversationsLoaded: (conversations) => {
          set({ conversations });
        },
        onConversationCreated: (conversation) => {
          set({ currentConversationId: conversation.id });
        },
        onError: (error) => {
          set({ error: error.message });
        }
      };
      conversationManager = new ConversationManager(conversationCallbacks);
      
      set({ isInitialized: true, error: null });
      console.log('✅ Voice assistant initialized with all managers');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize';
      set({ error: errorMessage, isInitialized: false });
      throw error;
    }
  },

  reinitializeWakeWord: async (newWakeWord: string) => {
    try {
      const { isSpeaking, isProcessing } = get();
      
      if (isSpeaking || isProcessing) {
        console.warn('⚠️ Deferring wake word change - AI is currently active');
        return;
      }
      
      if (!wakeWordManager) {
        wakeWordManager = new WakeWordManager(newWakeWord);
      }
      
      await wakeWordManager.reinitialize(newWakeWord);
      
      // Update callback with current store state
      wakeWordManager.setCallback(async () => {
        const state = get();
        if (state.isRecording) return;
        
        await wakeWordManager?.stop();
        if (state.isSpeaking || state.isProcessing) {
          await get().interrupt();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        set({ wakeWordDetected: true });
        console.log(`✨ Wake word "${newWakeWord}" detected!`);
        
        try {
          await get().startRecording();
        } catch (error) {
          console.error('Failed to start recording:', error);
          set({ wakeWordDetected: false });
        }
      });
      
      console.log(`✅ Wake word changed to "${newWakeWord}"`);
    } catch (error) {
      console.error('Failed to reinitialize wake word:', error);
      set({ error: 'Failed to change wake word' });
    }
  },

  startListening: async () => {
    try {
      const { wakeWordEnabled } = get();
      
      if (wakeWordEnabled && wakeWordManager) {
        await wakeWordManager.start();
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
      const { isRecording } = get();
      
      if (isRecording) {
        await get().stopRecording();
      }
      
      if (wakeWordManager) {
        await wakeWordManager.stop();
      }
      
      set({ isListening: false, wakeWordDetected: false });
      console.log('⏸️ Stopped listening');
    } catch (error) {
      console.error('Error stopping listening:', error);
      set({ isListening: false, wakeWordDetected: false });
    }
  },

  startRecording: async () => {
    const currentState = get();
    if (currentState.isRecording || currentState.isProcessing) {
      console.log('⚠️ Already recording or processing, ignoring');
      return;
    }

    try {
      set({ isRecording: true, error: null, currentTranscript: '' });
      
      // Use recording manager
      const result = await recordingManager!.record();
      
      if (!result) {
        set({ isRecording: false, isProcessing: false });
        return;
      }
      
      set({ isRecording: false, isProcessing: true });
      
      // Handle silence
      if (result.isEmpty) {
        console.log('🤫 No speech detected, returning to wake word mode');
        set({ 
          isProcessing: false,
          currentTranscript: '',
          wakeWordDetected: false,
        });
        
        if (wakeWordManager?.isInitialized() && get().wakeWordEnabled && !wakeWordManager.isListening()) {
          await wakeWordManager.start();
          console.log('👂 Wake word detection resumed after silence');
        }
        return;
      }
      
      set({ 
        currentTranscript: result.transcription,
        wakeWordDetected: false,
      });
      
      console.log('📝 User said:', result.transcription);
      
      // Get or create conversation
      let conversationId = conversationManager!.getCurrentConversationId();
      if (!conversationId) {
        const conversation = await conversationManager!.createConversation(result.transcription);
        conversationId = conversation.id;
        await conversationManager!.refreshConversations();
      }
      
      // Add user message
      get().addMessage('user', result.transcription);
      
      // Stream LLM response
      let fullText = '';
      
      llmStreamManager!.setCallbacks({
        onTextChunk: (_chunk, fullTextSoFar) => {
          fullText = fullTextSoFar;
          get().updateStreamingText(fullText);
        },
        onToolCall: (_toolName, systemMessage, _speechMessage) => {
          get().addMessage('system', systemMessage);
        },
        onStreamStart: () => {
          set({ isProcessing: false, isSpeaking: true });
          // Stop wake word during AI response
          wakeWordManager?.stop();
        },
        onStreamEnd: async () => {
          get().clearStreamingText();
          if (fullText.trim()) {
            get().addMessage('assistant', fullText);
          }
        },
        onError: (error) => {
          console.error('LLM stream error:', error);
          set({ error: error.message });
        }
      });
      
      await llmStreamManager!.stream(result.transcription, {
        sessionId: conversationId,
        temperature: 0.7,
        maxTokens: 2048,
      });
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 Recording interrupted');
      } else {
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
      console.error('Error stopping recording:', error);
      set({ isRecording: false });
    }
  },

  interrupt: async () => {
    try {
      console.log('⏸️ Interrupting AI...');
      
      // Interrupt orchestrator
      getStreamingOrchestrator().interrupt();
      
      // Abort LLM stream
      llmStreamManager?.abort();
      
      // Stop audio
      stopAudio();
      
      // Clear state
      get().clearStreamingText();
      set({ isSpeaking: false });
      
      // Start recording if not already
      if (!get().isRecording && !get().isProcessing) {
        await get().startRecording();
      }
      
      console.log('✅ Interrupted - ready for input');
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
      
      stopAudio();
      const recorder = getAudioRecorder();
      if (recorder.isRecording) {
        recorder.stop();
      }
      
      set({ 
        isRecording: false,
        isProcessing: false,
        isSpeaking: false,
        wakeWordDetected: false,
      });
      
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
      
      if (!isListening) return;
      
      if (isSpeaking || isProcessing) {
        await get().interrupt();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      set({ wakeWordDetected: true });
      console.log('🎤 Manual trigger activated');
      
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

  addMessage: (role: 'user' | 'assistant' | 'system', content: string) => {
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
      
      stopAudio();
      const recorder = getAudioRecorder();
      if (recorder.isRecording) {
        recorder.stop();
      }
      
      await conversationManager!.createConversation();
      
      set({ 
        messages: [],
        isRecording: false,
        isProcessing: false,
        isSpeaking: false,
        wakeWordDetected: false,
        currentTranscript: '',
      });
      
      await conversationManager!.refreshConversations();
      await get().startListening();
      
      console.log('✅ New conversation started');
    } catch (error) {
      console.error('Failed to start new conversation:', error);
      set({ error: 'Failed to start new conversation' });
    }
  },

  loadConversation: async (conversationId: string) => {
    try {
      console.log('📂 Loading conversation:', conversationId);
      
      stopAudio();
      const recorder = getAudioRecorder();
      if (recorder.isRecording) {
        recorder.stop();
      }
      
      const conversation = await conversationManager!.loadConversation(conversationId);
      
      const messages: Message[] = conversation.messages.map((msg, index) => ({
        id: `${conversationId}-${index}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp).getTime(),
      }));
      
      set({ 
        messages,
        currentConversationId: conversationId,
        isRecording: false,
        isProcessing: false,
        isSpeaking: false,
        wakeWordDetected: false,
        currentTranscript: '',
      });
      
      await get().startListening();
      
      console.log('✅ Conversation loaded');
    } catch (error) {
      console.error('Failed to load conversation:', error);
      set({ error: 'Failed to load conversation' });
    }
  },

  deleteConversation: async (conversationId: string) => {
    try {
      console.log('🗑️ Deleting conversation:', conversationId);
      
      await conversationManager!.deleteConversation(conversationId);
      
      if (get().currentConversationId === conversationId) {
        await get().startNewConversation();
      } else {
        await conversationManager!.refreshConversations();
      }
      
      console.log('✅ Conversation deleted');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      set({ error: 'Failed to delete conversation' });
    }
  },

  refreshConversations: async () => {
    try {
      await conversationManager!.refreshConversations();
    } catch (error) {
      console.error('Failed to refresh conversations:', error);
    }
  },
}));
