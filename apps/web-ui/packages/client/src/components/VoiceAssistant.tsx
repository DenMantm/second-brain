/**
 * Voice Assistant - Main component
 * Refactored into modular hooks and sub-components
 */
import { useVoiceStore } from '../stores/voiceStore';
import { useMicrophonePermission } from '../hooks';
import { StatusDisplay } from './StatusDisplay';
import { VoiceControls } from './VoiceControls';
import './VoiceAssistant.css';
import './ConversationHistory.css';

export default function VoiceAssistant() {
  const { messages, streamingText } = useVoiceStore();
  const { isDenied } = useMicrophonePermission();

  return (
    <div className="voice-assistant">
      <StatusDisplay />
      <VoiceControls isPermissionDenied={isDenied} />

      {/* Conversation History */}
      <div className="conversation-history">
        <div className="messages-container">
          {/* Streaming text (newest first) */}
          {streamingText && (
            <div className="message assistant streaming">
              <div className="message-content">
                {streamingText}
                <span className="streaming-cursor">▋</span>
              </div>
            </div>
          )}

          {/* Past messages (newest first) */}
          {[...messages].reverse().map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-role">
                {msg.role === 'user' ? '👤 You' : '🤖 Assistant'}
              </div>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
