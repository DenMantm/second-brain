import { describe, it, expect, beforeEach } from 'vitest';
import { PromptManager } from '../promptManager';

describe('PromptManager', () => {
  let promptManager: PromptManager;

  beforeEach(() => {
    promptManager = new PromptManager();
  });

  describe('getSystemPrompt', () => {
    it('should return default system prompt when no options provided', () => {
      const prompt = promptManager.getSystemPrompt();
      
      expect(prompt).toBeDefined();
      expect(prompt).toContain('helpful voice assistant');
      expect(prompt).toContain('YouTube');
      expect(prompt).toContain('VOICE RESPONSE GUIDELINES');
    });

    it('should return custom prompt when provided', () => {
      const customPrompt = 'You are a specialized assistant.';
      const prompt = promptManager.getSystemPrompt({ customPrompt });
      
      expect(prompt).toBe(customPrompt);
    });

    it('should include tool usage rules in default prompt', () => {
      const prompt = promptManager.getSystemPrompt();
      
      expect(prompt).toContain('search_youtube');
      expect(prompt).toContain('play_youtube_video');
      expect(prompt).toContain('control_youtube_player');
      expect(prompt).toContain('CRITICAL TOOL USAGE RULES');
    });

    it('should include voice guidelines in default prompt', () => {
      const prompt = promptManager.getSystemPrompt();
      
      expect(prompt).toContain('NEVER use markdown formatting');
      expect(prompt).toContain('conversational');
      expect(prompt).toContain('listening, not reading');
    });
  });

  describe('getToolSchemaReminder', () => {
    it('should return tool schema reminder message', () => {
      const reminder = promptManager.getToolSchemaReminder();
      
      expect(reminder).toContain('search_youtube');
      expect(reminder).toContain('query');
      expect(reminder).toContain('max_results');
    });
  });
});
