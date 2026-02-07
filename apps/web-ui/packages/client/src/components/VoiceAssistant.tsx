import { useEffect, useState } from 'react';
import { useVoiceStore } from '../stores/voiceStore';
import './VoiceAssistant.css';
import './ConversationHistory.css';

export default function VoiceAssistant() {
  const {
    isListening,
    isRecording,
    isProcessing,
    isSpeaking,
    wakeWordDetected,
    currentTranscript,
    messages,
    streamingText,
    startListening,
    stopListening,
    initialize,
    interrupt,
    stopConversation,
    startNewConversation,
    manualTrigger,
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

  const getHint = () => {
    if (isSpeaking) return 'AI speaking - click Interrupt to respond or Stop to end';
    if (isProcessing) return 'Processing your request...';
    if (isRecording) return 'Recording... speak now!';
    if (wakeWordDetected) return 'Speak your question...';
    if (isListening) return 'Listening for "Go"...';
    return 'Click to start. Say "Go" to activate.';
  };

  return (
    <div className="voice-assistant">
      <div className="status-display">
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
        
        {/* {currentTranscript && (
          <div className="transcript">
            <strong>You said:</strong> "{currentTranscript}"
          </div>
        )}
        
        {wakeWordDetected && (
          <div className="wake-word-flash">
            ✨ Wake word detected!
          </div>
        )} */}
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

        {isListening && !wakeWordDetected && !isRecording && (
          <button
            onClick={manualTrigger}
            className="manual-trigger-button"
            disabled={isProcessing || isSpeaking}
            title="Activate without saying 'Go'"
          >
            🎤 Manual Trigger
          </button>
        )}

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
          {getHint()}
        </p>
      </div>

      {/* Conversation History */}
      {messages.length === 0 ? (
        <div className="conversation-history empty">
          <p className="empty-state">No conversations yet. Start by saying "Hey Assistant"!</p>
        </div>
      ) : (
        <div className="conversation-history">
          <div className="messages">
            {/* Show streaming text as the first message (newest) */}
            {streamingText && (
              <div className="message assistant streaming">
                <div className="message-header">
                  <span className="role-badge">🤖 Assistant</span>
                  <span className="timestamp">Now</span>
                </div>
                <div className="message-content">
                  {streamingText}
                  <span className="streaming-cursor">▋</span>
                </div>
              </div>
            )}
            {messages.slice().reverse().map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <div className="message-header">
                  <span className="role-badge">
                    {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
                  </span>
                  <span className="timestamp">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="message-content">{message.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
