/**
 * Conversation Storage Service
 * Server-side caching and persistence for conversation metadata
 */

export interface ConversationMetadata {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface StoredConversation {
  metadata: ConversationMetadata;
  messages: ConversationMessage[];
}

// In-memory cache for conversations
const conversationCache = new Map<string, StoredConversation>();

/**
 * Generate a title from the first user message
 */
function generateTitle(firstMessage: string): string {
  const maxLength = 50;
  const cleaned = firstMessage.trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  return cleaned.substring(0, maxLength) + '...';
}

/**
 * Create a new conversation
 */
export function createConversation(firstMessage?: string): ConversationMetadata {
  const id = `conv-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const now = new Date();
  
  const metadata: ConversationMetadata = {
    id,
    title: firstMessage ? generateTitle(firstMessage) : 'New Conversation',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    lastMessage: firstMessage,
  };
  
  conversationCache.set(id, {
    metadata,
    messages: [],
  });
  
  return metadata;
}

/**
 * Get all conversations (sorted by most recent)
 */
export function getAllConversations(): ConversationMetadata[] {
  const conversations = Array.from(conversationCache.values())
    .map(conv => conv.metadata)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  
  return conversations;
}

/**
 * Get a specific conversation
 */
export function getConversation(conversationId: string): StoredConversation | null {
  return conversationCache.get(conversationId) || null;
}

/**
 * Add a message to a conversation
 */
export function addMessageToConversation(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): void {
  const conversation = conversationCache.get(conversationId);
  
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }
  
  const message: ConversationMessage = {
    role,
    content,
    timestamp: new Date(),
  };
  
  conversation.messages.push(message);
  conversation.metadata.messageCount = conversation.messages.length;
  conversation.metadata.updatedAt = new Date();
  conversation.metadata.lastMessage = content;
  
  // Update title if this is the first user message
  if (role === 'user' && conversation.metadata.messageCount === 1) {
    conversation.metadata.title = generateTitle(content);
  }
}

/**
 * Delete a conversation
 */
export function deleteConversation(conversationId: string): boolean {
  return conversationCache.delete(conversationId);
}

/**
 * Clear all conversations (for testing/reset)
 */
export function clearAllConversations(): void {
  conversationCache.clear();
}

/**
 * Get conversation messages
 */
export function getConversationMessages(conversationId: string): ConversationMessage[] {
  const conversation = conversationCache.get(conversationId);
  return conversation ? conversation.messages : [];
}

/**
 * Update conversation metadata
 */
export function updateConversationMetadata(
  conversationId: string,
  updates: Partial<Pick<ConversationMetadata, 'title'>>
): void {
  const conversation = conversationCache.get(conversationId);
  
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }
  
  if (updates.title) {
    conversation.metadata.title = updates.title;
  }
  
  conversation.metadata.updatedAt = new Date();
}
