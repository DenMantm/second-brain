import type { FastifyInstance } from 'fastify';
import { ttsRoutes } from './tts';
import { sttRoutes } from './stt';
import { chatRoutes } from './chat';
import { llmRoutes } from './llm';
import { conversationRoutes } from './conversations';
import { registerModelsRoutes } from './models';

export function registerRoutes(fastify: FastifyInstance) {
  // Register route groups
  fastify.register(ttsRoutes, { prefix: '/api/tts' });
  fastify.register(sttRoutes, { prefix: '/api/stt' });
  fastify.register(chatRoutes, { prefix: '/api/chat' });
  fastify.register(llmRoutes, { prefix: '/api/llm' });
  fastify.register(conversationRoutes, { prefix: '/api' });
  registerModelsRoutes(fastify);
}
