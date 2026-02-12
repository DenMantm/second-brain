import VoiceAssistant from './components/VoiceAssistant';
import Settings from './components/Settings';
import { YouTubeModal } from './components/YouTubeModal';
import { WebSearchModal } from './components/WebSearchModal';
import { ConversationsModal } from './components/ConversationsModal';
import { useVoiceStore } from './stores/voiceStore';
import { useSettingsStore } from './stores/settingsStore';
import { useConversationsStore } from './stores/conversationsStore';

function App() {
  const { isInitialized, error } = useVoiceStore();
  const { openSettings } = useSettingsStore();
  const { show: showConversations } = useConversationsStore();

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div>
            <h1>Second Brain</h1>
            <p className="subtitle">Voice Assistant</p>
          </div>
          <div className="header-buttons">
            <button onClick={showConversations} className="conversations-button" title="Conversations">
              💬
            </button>
            <button onClick={openSettings} className="settings-button" title="Settings">
              ⚙️
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}


            <VoiceAssistant />
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
      <YouTubeModal />
      <WebSearchModal />
      <ConversationsModal />
    </div>
  );
}

export default App;
