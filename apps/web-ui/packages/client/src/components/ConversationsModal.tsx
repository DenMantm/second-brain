/**
 * Conversations Modal - View and manage conversations
 */
import { useEffect } from 'react';
import { useConversationsStore } from '../stores/conversationsStore';
import { useVoiceStore } from '../stores/voiceStore';
import './ConversationsModal.css';

export const ConversationsModal = () => {
  const { isOpen, modalSize, hide, toggleSize } = useConversationsStore();
  const { 
    conversations, 
    currentConversationId,
    loadConversation,
    deleteConversation,
    refreshConversations,
  } = useVoiceStore();

  useEffect(() => {
    // Load conversations when modal opens
    if (isOpen) {
      refreshConversations();
    }
  }, [isOpen, refreshConversations]);

  if (!isOpen) {
    return null;
  }

  const handleLoadConversation = (conversationId: string) => {
    if (conversationId !== currentConversationId) {
      loadConversation(conversationId);
    }
  };

  const handleDeleteConversation = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent loading when deleting
    
    if (confirm('Delete this conversation?')) {
      deleteConversation(conversationId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

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

      <div className={`conversations-modal-content ${modalSize === 'minimized' ? 'hidden' : ''}`}>
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
                  <span className="timestamp">{formatDate(conv.updatedAt)}</span>
                </div>
                
                {conv.lastMessage && (
                  <div className="last-message">
                    {conv.lastMessage.substring(0, 60)}
                    {conv.lastMessage.length > 60 ? '...' : ''}
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
