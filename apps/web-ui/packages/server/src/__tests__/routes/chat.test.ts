import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { chatRoutes } from '../../routes/chat';

describe('Chat Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(chatRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /', () => {
    it('should return 400 when message is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Message is required');
    });

    it('should return mock response for valid message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          message: 'Hello, assistant!',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('response');
      expect(body).toHaveProperty('model');
      expect(body).toHaveProperty('timestamp');
      expect(body.response).toContain('Echo');
    });

    it('should echo the user message in response', async () => {
      const testMessage = 'Test message 123';
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          message: testMessage,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.response).toContain(testMessage);
    });

    it('should handle empty string message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          message: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return valid timestamp', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {
          message: 'Test',
        },
      });

      const body = JSON.parse(response.payload);
      const timestamp = new Date(body.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });
  });
});
