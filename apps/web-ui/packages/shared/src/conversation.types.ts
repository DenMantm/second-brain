/**
 * Conversation Types
 * Shared between client and server for conversation management
 */

export interface Conversation {
  id: string;
  title: string;
  summary?: string;
  tags: string[];
  messageCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastMessage?: string;
}

export interface ConversationListItem extends Conversation {
  // Additional UI-specific fields can go here
}
