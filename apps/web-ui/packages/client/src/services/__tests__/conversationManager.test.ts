/**
 * Tests for ConversationManager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConversationManager } from '../conversationManager';

// Mock conversation API
vi.mock('../conversations', () => ({
  fetchConversations: vi.fn().mockResolvedValue([
    {
      id: 'conv-1',
      title: 'Test Conversation',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T01:00:00Z',
      messageCount: 5,
      lastMessage: 'Hello'
    }
  ]),
  createNewConversation: vi.fn().mockResolvedValue({
    id: 'conv-new',
    title: 'New Conversation',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    messageCount: 0
  }),
  loadConversation: vi.fn().mockResolvedValue({
    metadata: {
      id: 'conv-1',
      title: 'Test Conversation',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T01:00:00Z',
      messageCount: 2
    },
    messages: [
      { role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
      { role: 'assistant', content: 'Hi there', timestamp: '2024-01-01T00:01:00Z' }
    ]
  }),
  deleteConversation: vi.fn().mockResolvedValue(undefined)
}));

describe('ConversationManager', () => {
  let manager: ConversationManager;
  let callbacks: any;
  
  beforeEach(() => {
    callbacks = {
      onConversationsLoaded: vi.fn(),
      onConversationCreated: vi.fn(),
      onConversationLoaded: vi.fn(),
      onConversationDeleted: vi.fn(),
      onError: vi.fn(),
    };
    manager = new ConversationManager(callbacks);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should create instance with callbacks', () => {
    expect(manager).toBeInstanceOf(ConversationManager);
  });
  
  it('should get current conversation ID (initially null)', () => {
    expect(manager.getCurrentConversationId()).toBeNull();
  });
  
  it('should get empty conversations array initially', () => {
    expect(manager.getConversations()).toEqual([]);
  });
  
  it('should refresh conversations list', async () => {
    const conversations = await manager.refreshConversations();
    
    expect(callbacks.onConversationsLoaded).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'conv-1', title: 'Test Conversation' })
      ])
    );
    expect(conversations).toHaveLength(1);
    expect(manager.getConversations()).toHaveLength(1);
  });
  
  it('should create new conversation', async () => {
    const conversation = await manager.createConversation('Hello');
    
    expect(callbacks.onConversationCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conv-new' })
    );
    expect(conversation.id).toBe('conv-new');
    expect(manager.getCurrentConversationId()).toBe('conv-new');
    expect(manager.getConversations()).toContainEqual(
      expect.objectContaining({ id: 'conv-new' })
    );
  });
  
  it('should load existing conversation', async () => {
    const conversation = await manager.loadConversation('conv-1');
    
    expect(callbacks.onConversationLoaded).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ id: 'conv-1' }),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Hello' })
        ])
      })
    );
    expect(conversation.messages).toHaveLength(2);
    expect(manager.getCurrentConversationId()).toBe('conv-1');
  });
  
  it('should delete conversation', async () => {
    // First, create and load a conversation
    await manager.createConversation();
    await manager.refreshConversations();
    const conversationId = manager.getCurrentConversationId()!;
    
    await manager.deleteConversation(conversationId);
    
    expect(callbacks.onConversationDeleted).toHaveBeenCalledWith(conversationId);
    expect(manager.getCurrentConversationId()).toBeNull();
  });
  
  it('should check if conversation is active', async () => {
    await manager.createConversation();
    const convId = manager.getCurrentConversationId()!;
    
    expect(manager.isActive(convId)).toBe(true);
    expect(manager.isActive('other-id')).toBe(false);
  });
  
  it('should clear current conversation', () => {
    manager.clearCurrent();
    expect(manager.getCurrentConversationId()).toBeNull();
  });
  
  it('should handle errors in refresh', async () => {
    const { fetchConversations } = await import('../conversations');
    vi.mocked(fetchConversations).mockRejectedValueOnce(new Error('Network error'));
    
    await expect(manager.refreshConversations()).rejects.toThrow('Network error');
    expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
  });
  
  it('should handle errors in create', async () => {
    const { createNewConversation } = await import('../conversations');
    vi.mocked(createNewConversation).mockRejectedValueOnce(new Error('Create failed'));
    
    await expect(manager.createConversation()).rejects.toThrow('Create failed');
    expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
  });
  
  it('should update callbacks', () => {
    const newCallbacks = {
      onConversationsLoaded: vi.fn(),
    };
    
    manager.setCallbacks(newCallbacks);
    // Callbacks should be updated
  });
  
  it('should use startNew as alias for createConversation', async () => {
    const conversation = await manager.startNew('Test message');
    expect(conversation.id).toBe('conv-new');
  });
});
