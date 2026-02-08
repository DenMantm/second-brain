/**
 * Custom hook for conversations modal functionality
 */

import { useEffect, useCallback } from 'react';
import { useConversationsStore } from '../stores/conversationsStore';
import { useConversationManager } from './useConversationManager';
import { useConversationFormatting } from './useConversationFormatting';

export const useConversationsModal = () => {
  const { isOpen, modalSize, hide, toggleSize, show } = useConversationsStore();
  
  const {
    conversations,
    currentConversationId,
    handleLoadConversation,
    handleDeleteConversation,
    refreshConversations,
  } = useConversationManager();

  const { formatRelativeTime, truncateText } = useConversationFormatting();

  /**
   * Refresh conversations when modal opens
   */
  useEffect(() => {
    if (isOpen) {
      refreshConversations();
    }
  }, [isOpen, refreshConversations]);

  /**
   * Check if modal is minimized
   */
  const isMinimized = modalSize === 'minimized';

  /**
   * Format last message preview
   */
  const formatLastMessage = useCallback((message: string | undefined) => {
    if (!message) return '';
    return truncateText(message, 60);
  }, [truncateText]);

  return {
    // State
    isOpen,
    modalSize,
    isMinimized,
    conversations,
    currentConversationId,
    
    // Actions
    show,
    hide,
    toggleSize,
    handleLoadConversation,
    handleDeleteConversation,
    refreshConversations,
    
    // Utilities
    formatRelativeTime,
    formatLastMessage,
  };
};
