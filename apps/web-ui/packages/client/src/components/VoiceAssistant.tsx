import { useEffect, useState } from 'react';
import { useVoiceStore } from '../stores/voiceStore';
import './VoiceAssistant.css';

export default function VoiceAssistant() {
  const {
    isListening,
    isRecording,
    isProcessing,
    isSpeaking,
    wakeWordDetected,
    currentTranscript,
    messages,
    startListening,
    stopListening,
    initialize,
    interrupt,
    stopConversation,
    startNewConversation,
  } = useVoiceStore();

  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  useEffect(() => {
    // Check microphone permission
    navigator.permissions?.query({ name: 'microphone' as PermissionName }).then((result) => {
      setMicPermission(result.state as 'prompt' | 'granted' | 'denied');
      result.onchange = () => {
        setMicPermission(result.state as 'prompt' | 'granted' | 'denied');
      };
    });
  }, []);

  const handleInitialize = async () => {
    try {
      await initialize();
      await startListening();
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
  };

  const getStatus = () => {
    if (isSpeaking) return '🔊 Speaking...';
    if (isProcessing) return '⏳ Transcribing...';
    if (isRecording) return '🎤 Recording...';
    if (wakeWordDetected) return '✨ Wake word detected!';
    if (isListening) return '👂 Listening for "Go"...';
    return '⏸️ Paused';
  };

  const getButtonText = () => {
    if (isListening) return 'Stop Listening';
    return 'Start Voice Assistant';
  };

  return (
    <div className="voice-assistant">
      <div className="status-display">
        <div className={`status-indicator ${isListening ? 'active' : ''}`}>
          {getStatus()}
        </div>
        
        {currentTranscript && (
          <div className="transcript">
            <strong>You said:</strong> "{currentTranscript}"
          </div>
        )}
        
        {wakeWordDetected && (
          <div className="wake-word-flash">
            ✨ Wake word detected!
          </div>
        )}
      </div>

      <div className="messages">
        {messages.slice(-5).map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <span className="role">{msg.role === 'user' ? '👤' : '🤖'}</span>
            <span className="content">{msg.content}</span>
          </div>
        ))}
      </div>

      <div className="controls">
        {micPermission === 'denied' && (
          <div className="permission-error">
            ⚠️ Microphone access denied. Please enable it in your browser settings.
          </div>
        )}

        <button
          onClick={isListening ? stopListening : handleInitialize}
          disabled={micPermission === 'denied' || isProcessing}
          className={`primary-button ${isListening ? 'listening' : ''}`}
        >
          {getButtonText()}
        </button>

        {isListening && (
          <button
            onClick={startNewConversation}
            className="new-conversation-button"
            disabled={isProcessing || isSpeaking}
          >
            ➕ New Conversation
          </button>
        )}

        {isSpeaking && (
          <button
            onClick={interrupt}
            className="interrupt-button"
          >
            ⏸️ Interrupt
          </button>
        )}

        {(wakeWordDetected || isRecording || isProcessing || isSpeaking) && (
          <button
            onClick={stopConversation}
            className="stop-button"
          >
            🛑 Stop Conversation
          </button>
        )}

        <p className="hint">
          {!isListening && 'Click to start. Say "Go" to activate.'}
          {isListening && !wakeWordDetected && 'Listening for "Go"...'}
          {wakeWordDetected && 'Speak your question...'}
          {isSpeaking && 'AI speaking - click Interrupt to respond or Stop to end'}
        </p>
      </div>

      <div className="visualization">
        {isListening && (
          <div className="audio-bars">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`bar ${wakeWordDetected || isProcessing || isSpeaking ? 'active' : ''}`}
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
