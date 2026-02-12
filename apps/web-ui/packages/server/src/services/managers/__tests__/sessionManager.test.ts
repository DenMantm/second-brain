import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '../sessionManager';

// Mock dependencies
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    bindTools: vi.fn().mockReturnThis(),
    invoke: vi.fn(),
    stream: vi.fn(),
  })),
}));

vi.mock('@langchain/community/stores/message/in_memory', () => ({
  ChatMessageHistory: vi.fn().mockImplementation(() => ({
    addMessage: vi.fn().mockResolvedValue(undefined),
    getMessages: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../config', () => ({
  config: {
    llmServiceUrl: 'http://localhost:1234/v1',
  },
}));

vi.mock('../../../tools/youtube-tools', () => ({
  youtubeTools: [],
  youtubeToolsDocumentation: {
    category: 'YOUTUBE CAPABILITIES',
    description: 'Test description',
    tools: [],
    validExamples: [],
    instructions: [],
  },
}));

vi.mock('../../../tools/web-search-tools', () => ({
  webSearchTools: [],
  webSearchToolsDocumentation: {
    category: 'WEB SEARCH CAPABILITIES',
    description: 'Test description',
    tools: [],
    validExamples: [],
    instructions: [],
  },
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('getSession', () => {
    it('should create a new session if it does not exist', () => {
      const session = sessionManager.getSession('test-session');

      expect(session).toBeDefined();
      expect(session.llm).toBeDefined();
      expect(session.history).toBeDefined();
    });

    it('should return existing session if it already exists', () => {
      const session1 = sessionManager.getSession('test-session');
      const session2 = sessionManager.getSession('test-session');

      expect(session1).toBe(session2);
    });

    it('should create sessions with custom options', () => {
      const options = {
        temperature: 0.5,
        maxTokens: 1024,
        systemPrompt: 'Custom prompt',
      };

      const session = sessionManager.getSession('test-session', options);

      expect(session).toBeDefined();
    });
  });

  describe('hasSession', () => {
    it('should return false for non-existent session', () => {
      expect(sessionManager.hasSession('non-existent')).toBe(false);
    });

    it('should return true for existing session', () => {
      sessionManager.getSession('test-session');
      expect(sessionManager.hasSession('test-session')).toBe(true);
    });
  });

  describe('deleteSession', () => {
    it('should remove session from storage', () => {
      sessionManager.getSession('test-session');
      expect(sessionManager.hasSession('test-session')).toBe(true);

      sessionManager.deleteSession('test-session');
      expect(sessionManager.hasSession('test-session')).toBe(false);
    });

    it('should handle deleting non-existent session gracefully', () => {
      expect(() => {
        sessionManager.deleteSession('non-existent');
      }).not.toThrow();
    });
  });

  describe('getActiveSessions', () => {
    it('should return empty array when no sessions exist', () => {
      expect(sessionManager.getActiveSessions()).toEqual([]);
    });

    it('should return array of session IDs', () => {
      sessionManager.getSession('session-1');
      sessionManager.getSession('session-2');
      sessionManager.getSession('session-3');

      const sessions = sessionManager.getActiveSessions();
      expect(sessions).toHaveLength(3);
      expect(sessions).toContain('session-1');
      expect(sessions).toContain('session-2');
      expect(sessions).toContain('session-3');
    });
  });

  describe('clearSession', () => {
    it('should clear history for existing session', async () => {
      const session = sessionManager.getSession('test-session');
      await sessionManager.clearSession('test-session');

      expect(session.history.clear).toHaveBeenCalled();
    });

    it('should handle clearing non-existent session gracefully', async () => {
      await expect(sessionManager.clearSession('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getPromptManager', () => {
    it('should return the prompt manager instance', () => {
      const promptManager = sessionManager.getPromptManager();
      
      expect(promptManager).toBeDefined();
      expect(typeof promptManager.getSystemPrompt).toBe('function');
    });
  });
});
