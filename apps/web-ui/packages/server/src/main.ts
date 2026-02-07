import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { config } from './config';
import { registerRoutes } from './routes';
import { setupWebSocket } from './websocket';

const fastify = Fastify({
  logger: {
    level: config.logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

async function start() {
  try {
    // Register plugins
    await fastify.register(cors, {
      origin: config.corsOrigin,
      credentials: true,
    });

    await fastify.register(multipart, {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    });

    await fastify.register(websocket);

    // Register routes
    registerRoutes(fastify);
    setupWebSocket(fastify);

    // Health check
    fastify.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          tts: config.ttsServiceUrl,
          stt: config.sttServiceUrl,
        },
      };
    });

    // Start server
    await fastify.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`
    ╔════════════════════════════════════════╗
    ║   Second Brain API Server              ║
    ║   🚀 Running on port ${config.port}           ║
    ╚════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown handlers
const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'] as const;
signals.forEach((signal) => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, closing server gracefully...`);
    try {
      await fastify.close();
      fastify.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      fastify.log.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
});

start();
