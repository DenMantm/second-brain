import type { FastifyInstance } from 'fastify';

export function setupWebSocket(fastify: FastifyInstance) {
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, request) => {
      fastify.log.info('WebSocket client connected');

      connection.socket.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          fastify.log.info('Received:', data);

          // Handle different message types
          switch (data.type) {
            case 'ping':
              connection.socket.send(JSON.stringify({ type: 'pong' }));
              break;

            case 'chat':
              // TODO: Process chat message
              connection.socket.send(
                JSON.stringify({
                  type: 'response',
                  data: { text: `Echo: ${data.message}` },
                })
              );
              break;

            default:
              connection.socket.send(
                JSON.stringify({
                  type: 'error',
                  error: 'Unknown message type',
                })
              );
          }
        } catch (error) {
          fastify.log.error('WebSocket error:', error);
          connection.socket.send(
            JSON.stringify({
              type: 'error',
              error: 'Failed to process message',
            })
          );
        }
      });

      connection.socket.on('close', () => {
        fastify.log.info('WebSocket client disconnected');
      });
    });
  });
}
