import { useVoiceStore } from '../stores/voiceStore';
import './ConversationHistory.css';

export default function ConversationHistory() {
  const { messages } = useVoiceStore();

  if (messages.length === 0) {
    return (
      <div className="conversation-history empty">
        <p className="empty-state">No conversations yet. Start by saying "Hey Assistant"!</p>
      </div>
    );
  }

  return (
    <div className="conversation-history">
      <div className="messages">
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
  );
}