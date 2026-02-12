/**
 * Session Data Store
 * Stores session-specific data (like YouTube search results) per session
 * This avoids global state pollution and race conditions between concurrent users
 */

import type { VideoResult } from '../youtube';

interface SessionCustomData {
  youtubeSearchResults?: VideoResult[];
  webSearchResults?: any[];
  // Add more session-specific data here as needed
}

export class SessionDataStore {
  private sessionData = new Map<string, SessionCustomData>();

  /**
   * Get YouTube search results for a session
   */
  getYouTubeResults(sessionId: string): VideoResult[] {
    const data = this.sessionData.get(sessionId);
    return data?.youtubeSearchResults || [];
  }

  /**
   * Set YouTube search results for a session
   */
  setYouTubeResults(sessionId: string, results: VideoResult[]): void {
    const data = this.sessionData.get(sessionId) || {};
    data.youtubeSearchResults = results;
    this.sessionData.set(sessionId, data);
  }

  /**
   * Clear YouTube search results for a session
   */
  clearYouTubeResults(sessionId: string): void {
    const data = this.sessionData.get(sessionId);
    if (data) {
      delete data.youtubeSearchResults;
    }
  }

  /**
   * Clear all data for a session
   */
  clearSession(sessionId: string): void {
    this.sessionData.delete(sessionId);
  }

  /**
   * Get all session IDs with data
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessionData.keys());
  }

  /**
   * Get data for a session (for debugging)
   */
  getSessionData(sessionId: string): SessionCustomData | undefined {
    return this.sessionData.get(sessionId);
  }
}

// Singleton instance
export const sessionDataStore = new SessionDataStore();
