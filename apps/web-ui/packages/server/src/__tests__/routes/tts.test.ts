import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ttsRoutes } from '../../routes/tts';

describe('TTS Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(ttsRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /synthesize', () => {
    it('should proxy request to TTS service', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          audio: 'base64encodedaudio',
          duration: 1.5,
        }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/synthesize',
        payload: {
          text: 'Hello world',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveProperty('audio');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tts/synthesize'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle TTS service errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/synthesize',
        payload: {
          text: 'Hello world',
        },
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.payload)).toHaveProperty('error');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const response = await app.inject({
        method: 'POST',
        url: '/synthesize',
        payload: {
          text: 'Hello world',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('TTS service unavailable');
    });
  });

  describe('GET /health', () => {
    it('should return healthy status when service is available', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('healthy');
      expect(body).toHaveProperty('url');
    });

    it('should return unavailable when service is down', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('unavailable');
    });
  });
});
