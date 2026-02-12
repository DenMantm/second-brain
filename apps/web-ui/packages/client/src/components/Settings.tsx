import { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useVoiceStore } from '../stores/voiceStore';
import './Settings.css';

// Helper to format wake word for display
const formatWakeWord = (word: string): string => {
  return word
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export default function Settings() {
  const {
    isOpen,
    ttsSettings,
    selectedModel,
    selectedWakeWord,
    selectedStopWord,
    availableModels,
    ttsVoice,
    availableVoices,
    audioDuckingVolume,
    closeSettings,
    updateTTSSettings,
    setSelectedModel,
    setSelectedWakeWord,
    setSelectedStopWord,
    setTtsVoice,
    setAudioDuckingVolume,
    fetchAvailableModels,
    fetchAvailableVoices,
  } = useSettingsStore();

  const { reinitializeWakeWord, reinitializeStopWord } = useVoiceStore();

  const [localSettings, setLocalSettings] = useState(ttsSettings);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);

  useEffect(() => {
    if (isOpen && availableModels.length === 0) {
      handleRefreshModels();
    }
  }, [isOpen, availableModels.length]);

  useEffect(() => {
    if (isOpen && availableVoices.length === 0) {
      handleRefreshVoices();
    }
  }, [isOpen, availableVoices.length]);

  const handleRefreshModels = async () => {
    setIsLoadingModels(true);
    await fetchAvailableModels();
    setIsLoadingModels(false);
  };

  const handleRefreshVoices = async () => {
    setIsLoadingVoices(true);
    await fetchAvailableVoices();
    setIsLoadingVoices(false);
  };

  useEffect(() => {
    setLocalSettings(ttsSettings);
  }, [ttsSettings]);

  if (!isOpen) return null;

  const handleWakeWordChange = async (newWakeWord: string) => {
    setSelectedWakeWord(newWakeWord);
    await reinitializeWakeWord(newWakeWord);
  };

  const handleStopWordChange = async (newStopWord: string) => {
    setSelectedStopWord(newStopWord);
    await reinitializeStopWord(newStopWord);
  };

  const handleSave = () => {
    updateTTSSettings(localSettings);
    closeSettings();
  };

  const handleCancel = () => {
    setLocalSettings(ttsSettings);
    closeSettings();
  };

  return (
    <div className="settings-overlay" onClick={handleCancel}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="close-button" onClick={handleCancel}>✕</button>
        </div>

        <div className="settings-content">
          {/* LLM Model Selection */}
          <div className="settings-section">
            <h3>🤖 Language Model</h3>
            <div className="setting-item">
              <label htmlFor="model-select">
                Model (applies to new conversations)
                <button 
                  onClick={handleRefreshModels}
                  disabled={isLoadingModels}
                  className="refresh-models-button"
                  type="button"
                  title="Refresh model list from LM Studio"
                >
                  {isLoadingModels ? '⏳' : '🔄'}
                </button>
              </label>
              <select
                id="model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="model-select"
                disabled={isLoadingModels}
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              {availableModels.length === 1 && availableModels[0]?.id === 'openai/gpt-oss-20b' && (
                <p className="model-hint" style={{ color: '#f59e0b' }}>
                  ⚠️ Using fallback model. Make sure LM Studio is running on port 1234.
                </p>
              )}
              {isLoadingModels && (
                <p className="model-hint">Fetching models from LM Studio...</p>
              )}
            </div>
          </div>

          {/* Wake Word Selection */}
          <div className="settings-section">
            <h3>🎤 Wake Word</h3>
            <div className="setting-item">
              <label htmlFor="wakeword-select">Activation Word</label>
              <select
                id="wakeword-select"
                value={selectedWakeWord}
                onChange={(e) => handleWakeWordChange(e.target.value)}
                className="model-select"
              >
                <option value="hey_jarvis">Hey Jarvis ⭐ (Recommended)</option>
                <option value="alexa">Alexa</option>
                <option value="hey_mycroft">Hey Mycroft</option>
                <option value="hey_rhasspy">Hey Rhasspy</option>
                <option value="timer">Timer</option>
                <option value="weather">Weather</option>
              </select>
              <p className="setting-hint">Say "{formatWakeWord(selectedWakeWord)}" to activate voice recording</p>
            </div>
          </div>

          {/* Stop Word Selection */}
          <div className="settings-section">
            <h3>🛑 Stop Word</h3>
            <div className="setting-item">
              <label htmlFor="stopword-select">Interrupt Word</label>
              <select
                id="stopword-select"
                value={selectedStopWord}
                onChange={(e) => handleStopWordChange(e.target.value)}
                className="model-select"
              >
                <option value="timer">Timer ⭐ (Recommended)</option>
                <option value="hey_jarvis">Hey Jarvis</option>
                <option value="alexa">Alexa</option>
                <option value="hey_mycroft">Hey Mycroft</option>
                <option value="hey_rhasspy">Hey Rhasspy</option>
                <option value="weather">Weather</option>
              </select>
              <p className="setting-hint">Say "{formatWakeWord(selectedStopWord)}" to interrupt the assistant while speaking</p>
            </div>
          </div>

          {/* Audio Ducking */}
          <div className="settings-section">
            <h3>🎵 Audio Ducking</h3>
            <div className="setting-item">
              <label htmlFor="ducking-volume">
                YouTube Volume During Recording: {audioDuckingVolume}%
              </label>
              <input
                id="ducking-volume"
                type="range"
                min="0"
                max="50"
                step="5"
                value={audioDuckingVolume}
                onChange={(e) => setAudioDuckingVolume(parseInt(e.target.value))}
                className="slider"
              />
              <div className="slider-labels">
                <span>Muted (0%)</span>
                <span>Quiet (10%)</span>
                <span>Half (50%)</span>
              </div>
              <p className="setting-hint">Automatically lower YouTube volume when you speak</p>
            </div>
          </div>

          {/* TTS Settings */}
          <div className="settings-section">
            <h3>🔊 Text-to-Speech</h3>
            
            {/* Voice Selection */}
            <div className="setting-item">
              <label htmlFor="voice-select">
                Voice
                <button 
                  onClick={handleRefreshVoices}
                  disabled={isLoadingVoices}
                  className="refresh-models-button"
                  type="button"
                  title="Refresh voice list from TTS service"
                >
                  {isLoadingVoices ? '⏳' : '🔄'}
                </button>
              </label>
              <select
                id="voice-select"
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                className="model-select"
                disabled={isLoadingVoices}
              >
                {availableVoices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
              {isLoadingVoices && (
                <p className="setting-hint">Fetching voices from TTS service...</p>
              )}
            </div>
            
            <div className="setting-item">
              <label htmlFor="length-scale">
                Speech Speed: {localSettings.length_scale.toFixed(2)}x
              </label>
              <input
                id="length-scale"
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={localSettings.length_scale}
                onChange={(e) => setLocalSettings({ ...localSettings, length_scale: parseFloat(e.target.value) })}
                className="slider"
              />
              <div className="slider-labels">
                <span>Faster (0.5x)</span>
                <span>Normal (1.0x)</span>
                <span>Slower (2.0x)</span>
              </div>
            </div>

            <div className="setting-item">
              <label htmlFor="noise-scale">
                Audio Clarity: {localSettings.noise_scale.toFixed(2)}
              </label>
              <input
                id="noise-scale"
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={localSettings.noise_scale}
                onChange={(e) => setLocalSettings({ ...localSettings, noise_scale: parseFloat(e.target.value) })}
                className="slider"
              />
              <div className="slider-labels">
                <span>Clearer (0.0)</span>
                <span>Default (0.67)</span>
                <span>More Variation (1.0)</span>
              </div>
              <p className="setting-hint">Lower = clearer speech, Higher = more natural variation</p>
            </div>

            <div className="setting-item">
              <label htmlFor="noise-w-scale">
                Phoneme Variation: {localSettings.noise_w_scale.toFixed(2)}
              </label>
              <input
                id="noise-w-scale"
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={localSettings.noise_w_scale}
                onChange={(e) => setLocalSettings({ ...localSettings, noise_w_scale: parseFloat(e.target.value) })}
                className="slider"
              />
              <div className="slider-labels">
                <span>Uniform (0.0)</span>
                <span>Default (1.0)</span>
              </div>
              <p className="setting-hint">Controls duration variation of individual sounds</p>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button onClick={handleCancel} className="cancel-button">
            Cancel
          </button>
          <button onClick={handleSave} className="save-button">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
