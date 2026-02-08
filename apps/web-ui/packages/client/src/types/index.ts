/**
 * Type definitions for client components
 * TODO: Import from @second-brain/shared once workspace linking is set up
 */

// For now, we'll define types locally
// These should eventually be imported from the shared package
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  summary?: string;
  tags: string[];
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
}
