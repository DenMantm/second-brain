import { describe, it, expect } from 'vitest';
import { config } from '../config';

describe('Configuration', () => {
  it('should have default values', () => {
    expect(config.port).toBeDefined();
    expect(config.host).toBeDefined();
    expect(config.nodeEnv).toBeDefined();
  });

  it('should have service URLs configured', () => {
    expect(config.ttsServiceUrl).toBeDefined();
    expect(config.sttServiceUrl).toBeDefined();
    expect(config.llmServiceUrl).toBeDefined();
    
    expect(config.ttsServiceUrl).toContain('http');
    expect(config.sttServiceUrl).toContain('http');
    expect(config.llmServiceUrl).toContain('http');
  });

  it('should have valid port number', () => {
    expect(config.port).toBeGreaterThan(0);
    expect(config.port).toBeLessThan(65536);
  });

  it('should have CORS origin configured', () => {
    expect(config.corsOrigin).toBeDefined();
    expect(typeof config.corsOrigin).toBe('string');
  });

  it('should have log level configured', () => {
    expect(config.logLevel).toBeDefined();
    expect(['debug', 'info', 'warn', 'error']).toContain(config.logLevel);
  });
});
