/**
 * LM Studio Model Management Routes
 * Proxies requests to LM Studio to avoid CORS issues
 */

import { FastifyInstance } from 'fastify';

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234';

export function registerModelsRoutes(fastify: FastifyInstance) {
  // Get available models from LM Studio
  fastify.get('/api/models', async (request, reply) => {
    try {
      fastify.log.info('Fetching models from LM Studio...');
      
      const response = await fetch(`${LM_STUDIO_URL}/v1/models`);
      
      if (!response.ok) {
        fastify.log.error(`LM Studio returned ${response.status}: ${response.statusText}`);
        throw new Error(`LM Studio error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        fastify.log.error('Invalid response format from LM Studio:', data);
        throw new Error('Invalid response format from LM Studio');
      }
      
      fastify.log.info(`Successfully fetched ${data.data.length} models from LM Studio`);
      
      return data;
    } catch (error) {
      fastify.log.error('Failed to fetch models from LM Studio:', error);
      
      // Return error response
      reply.status(503).send({
        error: 'Failed to connect to LM Studio',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Make sure LM Studio is running on port 1234'
      });
    }
  });
}
