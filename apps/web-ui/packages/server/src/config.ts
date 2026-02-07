import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3030', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Services
  ttsServiceUrl: process.env.TTS_SERVICE_URL || 'http://localhost:3002',
  sttServiceUrl: process.env.STT_SERVICE_URL || 'http://localhost:3003',
  llmServiceUrl: process.env.LLM_SERVICE_URL || 'http://localhost:8080',

  // API Keys (for future use)
  porcupineAccessKey: process.env.PORCUPINE_ACCESS_KEY || '',
} as const;
