import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { sendMessage, sendMessageStream, clearConversation } from '../services/conversation-memory';

export async function llmRoutes(fastify: FastifyInstance) {
  // Chat with conversation memory (LangChain) - Streaming version
  fastify.post('/chat/stream', async (request, reply) => {
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

      fastify.log.info({ message, session }, 'LLM streaming chat request');

      // Set up SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      });

      try {
        // Send message and stream response using LangChain
        const responseStream = await sendMessageStream(session, message, {
          temperature: temperature ?? 0.7,
          maxTokens: maxTokens ?? 2048,
        });

        // Stream chunks to client
        for await (const chunk of responseStream) {
          const sseMessage = `data: ${JSON.stringify({ chunk })}\n\n`;
          reply.raw.write(sseMessage);
        }

        // Send completion signal
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();

        fastify.log.info('LLM streaming response complete');
      } catch (streamError) {
        // Send error via SSE
        const errorMessage = `data: ${JSON.stringify({ 
          error: streamError instanceof Error ? streamError.message : 'Streaming failed' 
        })}\n\n`;
        reply.raw.write(errorMessage);
        reply.raw.end();
        throw streamError;
      }
    } catch (error) {
      fastify.log.error({ 
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      }, 'LLM streaming error');
      
      // Only send HTTP error if headers not sent
      if (!reply.sent) {
        reply.code(500).send({
          error: 'LLM streaming service unavailable',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  });

  // Chat with conversation memory (LangChain) - Original non-streaming version
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
        maxTokens: maxTokens ?? 2048,
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
