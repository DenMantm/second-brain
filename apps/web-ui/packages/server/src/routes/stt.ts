import type { FastifyInstance } from 'fastify';
import { config } from '../config';

export async function sttRoutes(fastify: FastifyInstance) {
  // Proxy to STT service
  fastify.post('/transcribe', async (request, reply) => {
    try {
      // Forward multipart/form-data to STT service
      const formData = await request.file();
      if (!formData) {
        return reply.code(400).send({ error: 'No audio file provided' });
      }

      const buffer = await formData.toBuffer();
      const form = new FormData();
      form.append('audio', new Blob([buffer]), formData.filename);

      const response = await fetch(`${config.sttServiceUrl}/api/stt/transcribe`, {
        method: 'POST',
        body: form,
      });

      if (!response.ok) {
        throw new Error(`STT service error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      fastify.log.error('STT error:', error);
      reply.code(500).send({
        error: 'STT service unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Health check
  fastify.get('/health', async () => {
    try {
      const response = await fetch(`${config.sttServiceUrl}/ping`);
      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        url: config.sttServiceUrl,
      };
    } catch {
      return { status: 'unavailable', url: config.sttServiceUrl };
    }
  });
}
