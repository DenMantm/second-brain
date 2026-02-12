/**
 * Development logger utility
 * Provides verbose logging when NODE_ENV=development
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Log verbose development information
   */
  dev: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEV]', ...args);
    }
  },

  /**
   * Log important information (always logged)
   */
  info: (...args: any[]) => {
    console.log('[INFO]', ...args);
  },

  /**
   * Log errors (always logged)
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Log warnings (always logged)
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * Log JSON objects in readable format (dev only)
   */
  json: (label: string, obj: any) => {
    if (isDevelopment) {
      console.log(`[DEV] ${label}:`, JSON.stringify(obj, null, 2));
    }
  },

  /**
   * Log separator for better readability (dev only)
   */
  separator: (label?: string) => {
    if (isDevelopment) {
      console.log('\n' + '='.repeat(80));
      if (label) {
        console.log(`[DEV] ${label}`);
        console.log('='.repeat(80));
      }
    }
  }
};

export const isDev = isDevelopment;
