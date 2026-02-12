import { create } from 'zustand';
import { StreamingOrchestrator } from '../services/streamingOrchestrator';
import { stopAudio } from '../services/tts';
import { getAudioRecorder } from '../services/audioRecorder';
import { useYouTubeStore } from './youtubeStore';
import { processThinkingBlocks } from '../services/thinkingProcessor';
import { 
  WakeWordManager,
  StopWordManager,
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
      const wakeWord = settingsStore?.getState?.().selectedWakeWord || 'hey_jarvis';
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
let stopWordManager: StopWordManager | null = null;
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
        const store = useVoiceStore.getState();
        if (!store.isSpeaking) {
          await store.setSpeaking(true);
        }
      },
      onTTSComplete: (_sentence, index) => {
        console.log(`✅ TTS complete for sentence ${index}`);
      },
      onTTSError: (_sentence, index, error) => {
        console.error(`❌ TTS error for sentence ${index}:`, error);
      },
      onComplete: async () => {
        const store = useVoiceStore.getState();
        
        // 🔒 RACE CONDITION FIX: Check if we're still in speaking state
        // If not, it means user interrupted (stop word or manual stop)
        // and we should NOT auto-resume wake word detection
        if (!store.isSpeaking) {
          console.log('⚠️ onComplete fired but not speaking (user interrupted) - ignoring auto-resume');
          return;
        }
        
        console.log('🎵 All audio playback complete');
        await store.setSpeaking(false);
        
        // Automatically start recording again for continuous conversation
        console.log('🎙️ Starting recording for continuous conversation...');
        try {
          await store.startRecording();
        } catch (error) {
          console.error('❌ Failed to auto-start recording:', error);
          // Fallback to wake word detection
          if (!wakeWordManager) return;
          if (wakeWordManager.isInitialized() && store.wakeWordEnabled && !wakeWordManager.isListening()) {
            // Reinitialize wake word detection to ensure proper configuration
            await wakeWordManager.reinitialize(wakeWordManager.getWakeWord());
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
  thinking?: string[]; // Extracted thinking blocks
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
  stopWordEnabled: boolean;
  error: string | null;
  messages: Message[];
  currentTranscript: string;
  streamingText: string;
  currentConversationId: string | null;
  conversations: ConversationMetadata[];

  // Actions
  initialize: () => Promise<void>;
  reinitializeWakeWord: (newWakeWord: string) => Promise<void>;
  reinitializeStopWord: (newStopWord: string) => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  interrupt: () => Promise<void>;
  stopConversation: () => Promise<void>;
  manualTrigger: () => Promise<void>;
  setWakeWordDetected: (detected: boolean) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setStopWordEnabled: (enabled: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setSpeaking: (speaking: boolean) => void | Promise<void>;
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
  stopWordEnabled: true,
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
      const selectedWakeWord = settingsStore?.getState?.().selectedWakeWord || 'hey_jarvis';
      const selectedStopWord = settingsStore?.getState?.().selectedStopWord || 'timer';
      
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
      
      // Initialize stop word manager
      stopWordManager = new StopWordManager(selectedStopWord);
      stopWordManager.setCallback(async () => {
        const { isSpeaking } = get();
        
        if (!isSpeaking) {
          console.log('⚠️ Stop word detected but not speaking, ignoring');
          return;
        }
        
        console.log(`🛑 Stop word "${selectedStopWord}" detected! Interrupting assistant...`);
        
        // Stop the stop word detection
        await stopWordManager?.stop();
        
        // Interrupt the assistant
        await get().interrupt();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Start recording user input
        try {
          await get().startRecording();
        } catch (error) {
          console.error('Failed to start recording after stop word:', error);
        }
      });
      
      await stopWordManager.initialize();
      
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
      const { isSpeaking } = get();
      
      if (isSpeaking) {
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

  reinitializeStopWord: async (newStopWord: string) => {
    try {
      const { isSpeaking } = get();
      
      if (isSpeaking) {
        console.warn('⚠️ Deferring stop word change - AI is currently active');
        return;
      }
      
      if (!stopWordManager) {
        stopWordManager = new StopWordManager(newStopWord);
      }
      
      await stopWordManager.reinitialize(newStopWord);
      
      // Update callback with current store state
      stopWordManager.setCallback(async () => {
        const state = get();
        if (!state.isSpeaking) return;
        
        console.log(`🛑 Stop word "${newStopWord}" detected! Interrupting assistant...`);
        
        await stopWordManager?.stop();
        await get().interrupt();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          await get().startRecording();
        } catch (error) {
          console.error('Failed to start recording:', error);
        }
      });
      
      console.log(`✅ Stop word changed to "${newStopWord}"`);
    } catch (error) {
      console.error('Failed to reinitialize stop word:', error);
      set({ error: 'Failed to change stop word' });
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
      
      // Duck YouTube volume during recording
      useYouTubeStore.getState().duckVolume();
      
      // Use recording manager
      const result = await recordingManager!.record();
      
      if (!result) {
        set({ isRecording: false, isProcessing: false });
        // Restore YouTube volume
        useYouTubeStore.getState().restoreVolume();
        return;
      }
      
      set({ isRecording: false, isProcessing: true });
      // Restore YouTube volume after recording
      useYouTubeStore.getState().restoreVolume();
      
      // Handle silence
      if (result.isEmpty) {
        console.log('🤫 No speech detected, returning to wake word mode');
        set({ 
          isProcessing: false,
          currentTranscript: '',
          wakeWordDetected: false,
        });
        // Volume already restored above
        
        if (wakeWordManager?.isInitialized() && get().wakeWordEnabled && !wakeWordManager.isListening()) {
          // Reinitialize wake word detection to ensure proper configuration
          await wakeWordManager.reinitialize(wakeWordManager.getWakeWord());
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
      
      // Get model from settings
      const settingsStore = typeof window !== 'undefined' ? (window as any).__settingsStore : null;
      const selectedModel = settingsStore?.getState?.().selectedModel || 'openai/gpt-oss-20b';
      
      llmStreamManager!.setCallbacks({
        onTextChunk: (_chunk, fullTextSoFar) => {
          fullText = fullTextSoFar;
          // Strip thinking blocks from streaming display (but keep full text for storage)
          const { speech } = processThinkingBlocks(fullTextSoFar);
          get().updateStreamingText(speech);
        },
        onToolCall: (_toolName, systemMessage, _speechMessage) => {
          get().addMessage('system', systemMessage);
        },
        onStreamStart: async () => {
          set({ isProcessing: false });
          // Start speaking mode (pauses wake word, starts stop word)
          await get().setSpeaking(true);
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
        model: selectedModel,
      });
      
    } catch (error) {
      // Restore YouTube volume on error
      useYouTubeStore.getState().restoreVolume();
      
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
        // Restore YouTube volume when recording stops
        useYouTubeStore.getState().restoreVolume();
        console.log('⏹️ Recording stopped manually');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      set({ isRecording: false });
      // Restore YouTube volume on error
      useYouTubeStore.getState().restoreVolume();
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

  setStopWordEnabled: (enabled: boolean) => {
    set({ stopWordEnabled: enabled });
  },

  setProcessing: (processing: boolean) => {
    set({ isProcessing: processing });
  },

  setSpeaking: async (speaking: boolean) => {
    const wasSpeaking = get().isSpeaking;
    const { stopWordEnabled, wakeWordEnabled } = get();
    set({ isSpeaking: speaking });
    
    // Duck YouTube volume when AI starts speaking, restore when done
    if (speaking && !wasSpeaking) {
      useYouTubeStore.getState().duckVolume();
      
      // Pause wake word detection while assistant is speaking
      if (wakeWordEnabled && wakeWordManager && wakeWordManager.isListening()) {
        console.log('🔇 Pausing wake word detection during speech');
        await wakeWordManager.stop();
        // Brief delay to ensure wake word fully releases audio resources
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Enable stop word detection when assistant starts speaking
      if (stopWordEnabled && stopWordManager && !stopWordManager.isListening()) {
        console.log('🛑 Assistant speaking - enabling stop word detection');
        await stopWordManager.start();
      }
    } else if (!speaking && wasSpeaking) {
      useYouTubeStore.getState().restoreVolume();
      
      // Disable stop word detection when assistant stops speaking
      if (stopWordManager && stopWordManager.isListening()) {
        console.log('🔇 Assistant stopped - disabling stop word detection');
        await stopWordManager.stop();
      }
      
      // Resume wake word detection after assistant finishes
      if (wakeWordEnabled && wakeWordManager && !wakeWordManager.isListening()) {
        console.log('👂 Resuming wake word detection');
        await wakeWordManager.start();
      }
    }
  },

  addMessage: (role: 'user' | 'assistant' | 'system', content: string) => {
    // Process thinking blocks for assistant messages
    const processed = role === 'assistant' ? processThinkingBlocks(content) : null;
    
    const message: Message = {
      id: crypto.randomUUID(),
      role,
      content: processed ? processed.speech : content, // Display without thinking tags
      timestamp: Date.now(),
      thinking: processed?.thinking.length ? processed.thinking : undefined,
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
