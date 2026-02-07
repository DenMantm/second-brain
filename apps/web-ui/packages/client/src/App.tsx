import VoiceAssistant from './components/VoiceAssistant';
import ConversationList from './components/ConversationList';
import Settings from './components/Settings';
import { useVoiceStore } from './stores/voiceStore';
import { useSettingsStore } from './stores/settingsStore';

function App() {
  const { isInitialized, error } = useVoiceStore();
  const { openSettings } = useSettingsStore();

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div>
            <h1>Second Brain</h1>
            <p className="subtitle">Voice Assistant</p>
          </div>
          <button onClick={openSettings} className="settings-button" title="Settings">
            ⚙️
          </button>
        </div>
      </header>

      <main className="main">
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}


            <VoiceAssistant />

        <ConversationList />
      </main>

      <footer className="footer">
        <p>
          Status:{' '}
          <span className={isInitialized ? 'status-online' : 'status-offline'}>
            {isInitialized ? '🟢 Ready' : '🔴 Initializing...'}
          </span>
        </p>
        <p className="info">All processing runs locally - your conversations stay private</p>
      </footer>

      <Settings />
    </div>
  );
}

export default App;
