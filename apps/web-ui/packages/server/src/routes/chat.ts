import type { FastifyInstance } from 'fastify';

export async function chatRoutes(fastify: FastifyInstance) {
  // Chat endpoint - will integrate with LLM service
  fastify.post('/', async (request, reply) => {
    try {
      const { message } = request.body as { message: string };

      if (!message) {
        return reply.code(400).send({ error: 'Message is required' });
      }

      // TODO: Integrate with LLM service
      // For now, return a mock response
      const response = {
        response: `Echo: ${message}`,
        model: 'mock',
        timestamp: new Date().toISOString(),
      };

      return response;
    } catch (error) {
      fastify.log.error({ error }, 'Chat error');
      reply.code(500).send({
        error: 'Chat service unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
