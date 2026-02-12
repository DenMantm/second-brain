/**
 * Voice Assistant - Main component
 * Refactored into modular hooks and sub-components
 */
import { useVoiceStore } from '../stores/voiceStore';
import { useMicrophonePermission } from '../hooks';
import { StatusDisplay } from './StatusDisplay';
import { VoiceControls } from './VoiceControls';
import { useState } from 'react';
import './VoiceAssistant.css';
import './ConversationHistory.css';

export default function VoiceAssistant() {
  const { messages, streamingText } = useVoiceStore();
  const { isDenied } = useMicrophonePermission();
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());

  const toggleThinking = (messageId: string) => {
    setExpandedThinking(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

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
                {msg.role === 'user'
                  ? '👤 You'
                  : msg.role === 'assistant'
                    ? '🤖 Assistant'
                    : 'ℹ️ System'}
              </div>
              {msg.thinking && msg.thinking.length > 0 && (
                <div className="thinking-section">
                  <button 
                    className="thinking-toggle"
                    onClick={() => toggleThinking(msg.id)}
                    aria-expanded={expandedThinking.has(msg.id)}
                  >
                    <span className="thinking-icon">💭</span>
                    <span className="thinking-label">Thinking...</span>
                    <span className="thinking-arrow">{expandedThinking.has(msg.id) ? '▼' : '▶'}</span>
                  </button>
                  {expandedThinking.has(msg.id) && (
                    <div className="thinking-content">
                      {msg.thinking.map((block, idx) => (
                        <div key={idx} className="thinking-block">
                          {block}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="message-content">{msg.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
