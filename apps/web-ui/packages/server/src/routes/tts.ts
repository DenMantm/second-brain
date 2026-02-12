import type { FastifyInstance } from 'fastify';
import { config } from '../config';

export async function ttsRoutes(fastify: FastifyInstance) {
  // Proxy to TTS service
  fastify.post('/synthesize', async (request, reply) => {
    try {
      const response = await fetch(`${config.ttsServiceUrl}/api/tts/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      });

      if (!response.ok) {
        throw new Error(`TTS service error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      fastify.log.error({ error }, 'TTS error');
      reply.code(500).send({
        error: 'TTS service unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get available voices
  fastify.get('/voices', async (request, reply) => {
    try {
      const response = await fetch(`${config.ttsServiceUrl}/api/tts/voices`);

      if (!response.ok) {
        throw new Error(`TTS service error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      fastify.log.error({ error }, 'TTS voices error');
      reply.code(500).send({
        error: 'TTS service unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Health check
  fastify.get('/health', async () => {
    try {
      const response = await fetch(`${config.ttsServiceUrl}/ping`);
      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        url: config.ttsServiceUrl,
      };
    } catch {
      return { status: 'unavailable', url: config.ttsServiceUrl };
    }
  });
}
