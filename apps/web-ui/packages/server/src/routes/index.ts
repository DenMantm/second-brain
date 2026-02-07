import type { FastifyInstance } from 'fastify';
import { ttsRoutes } from './tts';
import { sttRoutes } from './stt';
import { chatRoutes } from './chat';

export function registerRoutes(fastify: FastifyInstance) {
  // Register route groups
  fastify.register(ttsRoutes, { prefix: '/api/tts' });
  fastify.register(sttRoutes, { prefix: '/api/stt' });
  fastify.register(chatRoutes, { prefix: '/api/chat' });
}
