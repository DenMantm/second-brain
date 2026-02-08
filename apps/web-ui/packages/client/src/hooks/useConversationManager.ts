/**
 * Custom hook for managing conversation operations
 */

import { useCallback } from 'react';
import { useVoiceStore } from '../stores/voiceStore';

export const useConversationManager = () => {
  const {
    conversations,
    currentConversationId,
    loadConversation,
    deleteConversation,
    refreshConversations,
  } = useVoiceStore();

  /**
   * Load a conversation if it's not already loaded
   */
  const handleLoadConversation = useCallback((conversationId: string) => {
    if (conversationId !== currentConversationId) {
      loadConversation(conversationId);
    }
  }, [currentConversationId, loadConversation]);

  /**
   * Delete a conversation with confirmation
   */
  const handleDeleteConversation = useCallback((
    conversationId: string,
    event?: React.MouseEvent
  ) => {
    event?.stopPropagation(); // Prevent parent onClick
    
    if (confirm('Delete this conversation?')) {
      deleteConversation(conversationId);
    }
  }, [deleteConversation]);

  /**
   * Check if a conversation is currently active
   */
  const isConversationActive = useCallback((conversationId: string) => {
    return conversationId === currentConversationId;
  }, [currentConversationId]);

  return {
    conversations,
    currentConversationId,
    handleLoadConversation,
    handleDeleteConversation,
    isConversationActive,
    refreshConversations,
  };
};
