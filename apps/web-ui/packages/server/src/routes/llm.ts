import type { FastifyInstance } from 'fastify';
import { config } from '../config';

export async function llmRoutes(fastify: FastifyInstance) {
  // Proxy to LLM service (LM Studio)
  fastify.post('/chat', async (request, reply) => {
    try {
      fastify.log.info({ body: request.body }, 'LLM request body');
      
      const llmUrl = `${config.llmServiceUrl}/chat/completions`;
      fastify.log.info(`Sending to LLM service: ${llmUrl}`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(llmUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.error(`LLM service error: ${response.status} - ${errorText}`);
        throw new Error(`LLM service error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };
      fastify.log.info('LLM response received');
      
      // Extract the response text from OpenAI format
      const text = data.choices?.[0]?.message?.content || '';
      
      return {
        text,
        model: data.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      fastify.log.error({ error }, 'LLM error');
      reply.code(500).send({
        error: 'LLM service unavailable',
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
