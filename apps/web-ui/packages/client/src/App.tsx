import VoiceAssistant from './components/VoiceAssistant';
import ConversationHistory from './components/ConversationHistory';
import ConversationList from './components/ConversationList';
import { useVoiceStore } from './stores/voiceStore';

function App() {
  const { isInitialized, error } = useVoiceStore();

  return (
    <div className="app">
      <header className="header">
        <h1>Second Brain</h1>
        <p className="subtitle">Privacy-First Voice Assistant</p>
      </header>

      <main className="main">
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="content-grid">
          <div className="left-panel">
            <VoiceAssistant />
            <ConversationHistory />
          </div>
          
          <div className="right-panel">
            <ConversationList />
          </div>
        </div>
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
    </div>
  );
}

export default App;
