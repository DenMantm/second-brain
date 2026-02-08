/**
 * Message Types
 * Shared between client and server for conversation messages
 */

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokensUsed?: number;
  inferenceTime?: number;
  model?: string;
  temperature?: number;
  retrievedContext?: string[];
  voiceInput?: boolean;
}

export type MessageRole = 'user' | 'assistant' | 'system';
