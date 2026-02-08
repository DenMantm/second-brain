/**
 * Custom hook for conversation formatting utilities
 */

export const useConversationFormatting = () => {
  /**
   * Format a date string as relative time (e.g., "2m ago", "3h ago")
   */
  const formatRelativeTime = (dateString: string | Date): string => {
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

  /**
   * Format time as HH:MM:SS or HH:MM AM/PM
   */
  const formatTime = (timestamp: string | Date | number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  /**
   * Get role badge text and emoji
   */
  const getRoleBadge = (role: 'user' | 'assistant' | 'system'): string => {
    switch (role) {
      case 'user':
        return '👤 You';
      case 'assistant':
        return '🤖 Assistant';
      case 'system':
        return 'ℹ️ System';
      default:
        return role;
    }
  };

  /**
   * Truncate text with ellipsis
   */
  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return {
    formatRelativeTime,
    formatTime,
    getRoleBadge,
    truncateText,
  };
};
