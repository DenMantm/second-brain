import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { sendMessage, clearConversation } from '../services/conversation-memory';

export async function llmRoutes(fastify: FastifyInstance) {
  // Chat with conversation memory (LangChain)
  fastify.post('/chat', async (request, reply) => {
    try {
      const { message, sessionId, temperature, maxTokens } = request.body as {
        message: string;
        sessionId?: string;
        temperature?: number;
        maxTokens?: number;
      };

      if (!message) {
        return reply.code(400).send({ error: 'Message is required' });
      }

      // Use sessionId or create a default one
      const session = sessionId || 'default-session';

      fastify.log.info({ message, session }, 'LLM chat request');

      // Send message and get response using LangChain memory
      const responseText = await sendMessage(session, message, {
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 150,
      });

      fastify.log.info('LLM response received');

      return {
        text: responseText,
        sessionId: session,
      };
    } catch (error) {
      fastify.log.error({ 
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      }, 'LLM error');
      reply.code(500).send({
        error: 'LLM service unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Clear conversation history
  fastify.post('/clear', async (request, reply) => {
    try {
      const { sessionId } = request.body as { sessionId?: string };
      const session = sessionId || 'default-session';

      await clearConversation(session);

      return { success: true, sessionId: session };
    } catch (error) {
      fastify.log.error({ error }, 'Clear conversation error');
      reply.code(500).send({
        error: 'Failed to clear conversation',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Health check
  fastify.get('/health', async () => {
    try {
      const response = await fetch(`${config.llmServiceUrl}/models`);
      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        url: config.llmServiceUrl,
      };
    } catch {
      return { status: 'unavailable', url: config.llmServiceUrl };
    }
  });
}
