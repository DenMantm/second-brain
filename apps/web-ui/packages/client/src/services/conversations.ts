/**
 * Conversation API service
 */

export interface ConversationMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface StoredConversation {
  metadata: ConversationMetadata;
  messages: ConversationMessage[];
}

const API_BASE_URL = 'http://localhost:3030/api';

/**
 * Get all conversations
 */
export async function fetchConversations(): Promise<ConversationMetadata[]> {
  const response = await fetch(`${API_BASE_URL}/conversations`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }
  
  const data = await response.json();
  return data.conversations;
}

/**
 * Create a new conversation
 */
export async function createNewConversation(firstMessage?: string): Promise<ConversationMetadata> {
  const response = await fetch(`${API_BASE_URL}/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ firstMessage }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create conversation');
  }
  
  const data = await response.json();
  return data.conversation;
}

/**
 * Load a conversation
 */
export async function loadConversation(conversationId: string): Promise<StoredConversation> {
  // First, get the conversation data
  const getResponse = await fetch(`${API_BASE_URL}/conversations/${conversationId}`);
  
  if (!getResponse.ok) {
    throw new Error('Failed to load conversation');
  }
  
  const conversation = (await getResponse.json()).conversation;
  
  // Then, load it into the active session
  const loadResponse = await fetch(`${API_BASE_URL}/conversations/${conversationId}/load`, {
    method: 'POST',
  });
  
  if (!loadResponse.ok) {
    throw new Error('Failed to activate conversation');
  }
  
  return conversation;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete conversation');
  }
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(conversationId: string, title: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update conversation');
  }
}
