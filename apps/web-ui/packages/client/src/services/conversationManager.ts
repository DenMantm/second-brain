/**
 * Conversation Manager
 * Service-level manager for conversation lifecycle and state
 */

import {
  fetchConversations,
  createNewConversation,
  loadConversation as loadConversationAPI,
  deleteConversation as deleteConversationAPI,
  type ConversationMetadata,
  type StoredConversation
} from './conversations';

export interface ConversationManagerCallbacks {
  onConversationsLoaded?: (conversations: ConversationMetadata[]) => void;
  onConversationCreated?: (conversation: ConversationMetadata) => void;
  onConversationLoaded?: (conversation: StoredConversation) => void;
  onConversationDeleted?: (conversationId: string) => void;
  onError?: (error: Error) => void;
}

export class ConversationManager {
  private currentConversationId: string | null = null;
  private conversations: ConversationMetadata[] = [];
  private callbacks: ConversationManagerCallbacks;
  
  constructor(callbacks: ConversationManagerCallbacks = {}) {
    this.callbacks = callbacks;
  }
  
  /**
   * Update callbacks
   */
  setCallbacks(callbacks: ConversationManagerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
  
  /**
   * Get current conversation ID
   */
  getCurrentConversationId(): string | null {
    return this.currentConversationId;
  }
  
  /**
   * Get all conversations
   */
  getConversations(): ConversationMetadata[] {
    return this.conversations;
  }
  
  /**
   * Load conversation list from API
   */
  async refreshConversations(): Promise<ConversationMetadata[]> {
    try {
      console.log('📚 Fetching conversations...');
      const conversations = await fetchConversations();
      
      this.conversations = conversations;
      this.callbacks.onConversationsLoaded?.(conversations);
      
      console.log(`✅ Loaded ${conversations.length} conversations`);
      return conversations;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to fetch conversations');
      console.error('❌ Failed to fetch conversations:', err);
      this.callbacks.onError?.(err);
      throw err;
    }
  }
  
  /**
   * Create a new conversation
   */
  async createConversation(firstMessage?: string): Promise<ConversationMetadata> {
    try {
      console.log('🆕 Creating new conversation...');
      const conversation = await createNewConversation(firstMessage);
      
      this.currentConversationId = conversation.id;
      this.conversations.unshift(conversation); // Add to beginning
      this.callbacks.onConversationCreated?.(conversation);
      
      console.log(`✅ Created conversation: ${conversation.id}`);
      return conversation;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to create conversation');
      console.error('❌ Failed to create conversation:', err);
      this.callbacks.onError?.(err);
      throw err;
    }
  }
  
  /**
   * Load an existing conversation
   */
  async loadConversation(conversationId: string): Promise<StoredConversation> {
    try {
      console.log(`📖 Loading conversation: ${conversationId}...`);
      const conversation = await loadConversationAPI(conversationId);
      
      this.currentConversationId = conversationId;
      this.callbacks.onConversationLoaded?.(conversation);
      
      console.log(`✅ Loaded conversation with ${conversation.messages.length} messages`);
      return conversation;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load conversation');
      console.error('❌ Failed to load conversation:', err);
      this.callbacks.onError?.(err);
      throw err;
    }
  }
  
  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting conversation: ${conversationId}...`);
      await deleteConversationAPI(conversationId);
      
      // Remove from local list
      this.conversations = this.conversations.filter(c => c.id !== conversationId);
      
      // Clear current if it was deleted
      if (this.currentConversationId === conversationId) {
        this.currentConversationId = null;
      }
      
      this.callbacks.onConversationDeleted?.(conversationId);
      
      console.log(`✅ Deleted conversation: ${conversationId}`);
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to delete conversation');
      console.error('❌ Failed to delete conversation:', err);
      this.callbacks.onError?.(err);
      throw err;
    }
  }
  
  /**
   * Start a new conversation (alias for createConversation)
   */
  async startNew(firstMessage?: string): Promise<ConversationMetadata> {
    return this.createConversation(firstMessage);
  }
  
  /**
   * Clear current conversation reference
   */
  clearCurrent(): void {
    this.currentConversationId = null;
  }
  
  /**
   * Check if conversation is active
   */
  isActive(conversationId: string): boolean {
    return this.currentConversationId === conversationId;
  }
}
