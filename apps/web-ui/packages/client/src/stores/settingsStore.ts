import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TTSSettings {
  length_scale: number;
  noise_scale: number;
  noise_w_scale: number;
}

interface Model {
  id: string;
  name: string;
}

interface Voice {
  id: string;
  name: string;
  language?: string;
  gender?: string;
}

interface SettingsState {
  isOpen: boolean;
  ttsSettings: TTSSettings;
  selectedModel: string;
  selectedWakeWord: string;
  selectedStopWord: string;
  availableModels: Model[];
  ttsVoice: string;
  availableVoices: Voice[];
  audioDuckingVolume: number; // Volume level (0-100) when recording user input
  
  openSettings: () => void;
  closeSettings: () => void;
  updateTTSSettings: (settings: TTSSettings) => void;
  setSelectedModel: (modelId: string) => void;
  setSelectedWakeWord: (wakeWord: string) => void;
  setSelectedStopWord: (stopWord: string) => void;
  setTtsVoice: (voice: string) => void;
  setAudioDuckingVolume: (volume: number) => void;
  fetchAvailableModels: () => Promise<void>;
  fetchAvailableVoices: () => Promise<void>;
}

const DEFAULT_TTS_SETTINGS: TTSSettings = {
  length_scale: 0.95,
  noise_scale: 0.4,
  noise_w_scale: 0.9,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      ttsSettings: DEFAULT_TTS_SETTINGS,
      selectedModel: 'openai/gpt-oss-20b',
      selectedWakeWord: 'go',
      selectedStopWord: 'stop',
      availableModels: [],
      ttsVoice: 'alba',
      availableVoices: [],
      audioDuckingVolume: 10, // Default: 10% volume during recording

      openSettings: () => set({ isOpen: true }),
      
      closeSettings: () => set({ isOpen: false }),

      updateTTSSettings: (settings: TTSSettings) => {
        set({ ttsSettings: settings });
      },

      setSelectedModel: (modelId: string) => {
        set({ selectedModel: modelId });
      },

      setSelectedWakeWord: (wakeWord: string) => {
        set({ selectedWakeWord: wakeWord });
      },

      setSelectedStopWord: (stopWord: string) => {
        set({ selectedStopWord: stopWord });
      },

      setTtsVoice: (voice: string) => {
        set({ ttsVoice: voice });
      },

      setAudioDuckingVolume: (volume: number) => {
        const clampedVolume = Math.max(0, Math.min(100, volume));
        set({ audioDuckingVolume: clampedVolume });
      },

      fetchAvailableModels: async () => {
        try {
          console.log('Fetching models from LM Studio via backend proxy...');
          const response = await fetch('/api/models');
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (!data.data || !Array.isArray(data.data)) {
            throw new Error('Invalid response format from LM Studio');
          }
          
          const models: Model[] = data.data.map((model: any) => ({
            id: model.id,
            name: model.id.split('/').pop() || model.id,
          }));

          console.log(`✅ Fetched ${models.length} models from LM Studio:`, models.map(m => m.id));
          set({ availableModels: models });

          // Check if selected model is still available, if not pick first one
          const { selectedModel } = get();
          const isSelectedModelAvailable = models.some(m => m.id === selectedModel);
          
          if ((!selectedModel || !isSelectedModelAvailable) && models.length > 0 && models[0]) {
            console.log(`Selected model "${selectedModel}" not available, switching to "${models[0].id}"`);
            set({ selectedModel: models[0].id });
          }
        } catch (error) {
          console.error('❌ Failed to fetch models from LM Studio:', error);
          console.warn('Using fallback model. Please ensure LM Studio is running on http://localhost:1234');
          // Fallback to default model
          set({ 
            availableModels: [{ 
              id: 'openai/gpt-oss-20b', 
              name: 'GPT OSS 20B (Fallback)' 
            }],
            selectedModel: 'openai/gpt-oss-20b'
          });
        }
      },

      fetchAvailableVoices: async () => {
        try {
          console.log('Fetching available TTS voices...');
          const response = await fetch('/api/tts/voices');
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (!data.voices || !Array.isArray(data.voices)) {
            throw new Error('Invalid response format from TTS service');
          }
          
          const voices: Voice[] = data.voices.map((voice: any) => ({
            id: voice.id,
            name: voice.name || voice.id,
            language: voice.language,
            gender: voice.gender,
          }));

          console.log(`✅ Fetched ${voices.length} TTS voices:`, voices.map(v => v.id));
          set({ availableVoices: voices });

          // Check if selected voice is still available
          const { ttsVoice } = get();
          const isSelectedVoiceAvailable = voices.some(v => v.id === ttsVoice);
          
          if (!isSelectedVoiceAvailable && voices.length > 0 && voices[0]) {
            console.log(`Selected voice "${ttsVoice}" not available, switching to "${voices[0].id}"`);
            set({ ttsVoice: voices[0].id });
          }
        } catch (error) {
          console.error('❌ Failed to fetch TTS voices:', error);
          console.warn('Using fallback voice.');
          // Fallback to default voice
          set({ 
            availableVoices: [{ 
              id: 'alba', 
              name: 'Alba (Default)' 
            }],
            ttsVoice: 'alba'
          });
        }
      },
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        ttsSettings: state.ttsSettings,
        selectedModel: state.selectedModel,
        selectedWakeWord: state.selectedWakeWord,
        selectedStopWord: state.selectedStopWord,
        ttsVoice: state.ttsVoice,
        audioDuckingVolume: state.audioDuckingVolume,
      }),
    }
  )
);
