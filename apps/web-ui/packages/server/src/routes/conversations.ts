import type { FastifyInstance } from 'fastify';
import {
  createConversation,
  getAllConversations,
  getConversation,
  deleteConversation,
  updateConversationMetadata,
} from '../services/conversation-storage';
import { loadConversation } from '../services/conversation-memory';

export async function conversationRoutes(fastify: FastifyInstance) {
  // Get all conversations
  fastify.get('/conversations', async (_request, reply) => {
    try {
      const conversations = getAllConversations();
      return { conversations };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get conversations');
      reply.code(500).send({ error: 'Failed to retrieve conversations' });
    }
  });

  // Create new conversation
  fastify.post('/conversations', async (request, reply) => {
    try {
      const { firstMessage } = request.body as { firstMessage?: string };
      const metadata = createConversation(firstMessage);
      
      fastify.log.info({ conversationId: metadata.id }, 'Created new conversation');
      
      return { conversation: metadata };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to create conversation');
      reply.code(500).send({ error: 'Failed to create conversation' });
    }
  });

  // Get specific conversation
  fastify.get('/conversations/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const conversation = getConversation(id);
      
      if (!conversation) {
        return reply.code(404).send({ error: 'Conversation not found' });
      }
      
      return { conversation };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get conversation');
      reply.code(500).send({ error: 'Failed to retrieve conversation' });
    }
  });

  // Load conversation into active session
  fastify.post('/conversations/:id/load', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const conversation = getConversation(id);
      if (!conversation) {
        return reply.code(404).send({ error: 'Conversation not found' });
      }
      
      await loadConversation(id);
      
      fastify.log.info({ conversationId: id }, 'Loaded conversation');
      
      return { 
        success: true,
        conversation: conversation.metadata,
        messageCount: conversation.messages.length
      };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to load conversation');
      reply.code(500).send({ error: 'Failed to load conversation' });
    }
  });

  // Update conversation metadata (e.g., rename)
  fastify.patch('/conversations/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { title } = request.body as { title?: string };
      
      updateConversationMetadata(id, { title });
      
      fastify.log.info({ conversationId: id, title }, 'Updated conversation');
      
      return { success: true };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to update conversation');
      reply.code(500).send({ error: 'Failed to update conversation' });
    }
  });

  // Delete conversation
  fastify.delete('/conversations/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = deleteConversation(id);
      
      if (!deleted) {
        return reply.code(404).send({ error: 'Conversation not found' });
      }
      
      fastify.log.info({ conversationId: id }, 'Deleted conversation');
      
      return { success: true };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to delete conversation');
      reply.code(500).send({ error: 'Failed to delete conversation' });
    }
  });
}
