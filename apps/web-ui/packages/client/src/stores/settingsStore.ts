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

interface SettingsState {
  isOpen: boolean;
  ttsSettings: TTSSettings;
  selectedModel: string;
  selectedWakeWord: string;
  availableModels: Model[];
  
  openSettings: () => void;
  closeSettings: () => void;
  updateTTSSettings: (settings: TTSSettings) => void;
  setSelectedModel: (modelId: string) => void;
  setSelectedWakeWord: (wakeWord: string) => void;
  fetchAvailableModels: () => Promise<void>;
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
      availableModels: [],

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
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        ttsSettings: state.ttsSettings,
        selectedModel: state.selectedModel,
        selectedWakeWord: state.selectedWakeWord,
      }),
    }
  )
);
