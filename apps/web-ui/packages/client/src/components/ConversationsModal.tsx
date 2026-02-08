/**
 * Conversations Modal - View and manage conversations
 */
import { useConversationsModal } from '../hooks';
import './ConversationsModal.css';

export const ConversationsModal = () => {
  const {
    isOpen,
    modalSize,
    isMinimized,
    conversations,
    currentConversationId,
    hide,
    toggleSize,
    handleLoadConversation,
    handleDeleteConversation,
    formatRelativeTime,
    formatLastMessage,
  } = useConversationsModal();

  if (!isOpen) {
    return null;
  }

  return (
    <div className={`conversations-modal ${modalSize}`}>
      <div className="conversations-modal-header">
        <div className="conversations-modal-title">
          <span className="conversations-icon">💬</span>
          <span className="conversations-title-text">Conversations</span>
          <span className="conversation-count">{conversations.length}</span>
        </div>
        
        <div className="conversations-modal-controls">
          <button
            className="conversations-control-btn"
            onClick={toggleSize}
            title={modalSize === 'minimized' ? 'Maximize' : 'Minimize'}
          >
            {modalSize === 'minimized' ? '🔼' : '🔽'}
          </button>
          <button
            className="conversations-control-btn"
            onClick={hide}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className={`conversations-modal-content ${isMinimized ? 'hidden' : ''}`}>
        {conversations.length === 0 ? (
          <div className="empty-state">
            <p>No conversations yet</p>
            <p className="hint">Start talking to create your first conversation!</p>
          </div>
        ) : (
          <div className="conversation-items">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
                onClick={() => handleLoadConversation(conv.id)}
              >
                <div className="conversation-header">
                  <span className="conversation-title">{conv.title}</span>
                  <button
                    className="delete-button"
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    title="Delete conversation"
                  >
                    🗑️
                  </button>
                </div>
                
                <div className="conversation-meta">
                  <span className="message-count">{conv.messageCount} messages</span>
                  <span className="separator">•</span>
                  <span className="timestamp">{formatRelativeTime(conv.updatedAt)}</span>
                </div>
                
                {conv.lastMessage && (
                  <div className="last-message">
                    {formatLastMessage(conv.lastMessage)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
