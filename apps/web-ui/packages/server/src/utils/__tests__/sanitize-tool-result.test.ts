/**
 * Tool Result Sanitizer Tests
 */

import { describe, it, expect } from 'vitest';
import { sanitizeToolResult } from '../sanitize-tool-result';

describe('sanitizeToolResult', () => {
  describe('web_search results', () => {
    it('should sanitize web search results by removing URLs and truncating snippets', () => {
      const result = {
        success: true,
        query: 'quantum physics',
        count: 5,
        totalHits: 1000,
        results: [
          {
            pageid: 123,
            title: 'Quantum Mechanics',
            snippet: 'This is a very long snippet that describes quantum mechanics in great detail and should be truncated to save tokens in the LLM context window because we want to avoid hitting the token limit',
            url: 'https://en.wikipedia.org/wiki/Quantum_mechanics',
            wordcount: 5000,
            tags: ['wikipedia'],
          },
          {
            pageid: 456,
            title: 'Quantum Physics',
            snippet: 'Short snippet',
            url: 'https://en.wikipedia.org/wiki/Quantum_physics',
            wordcount: 3000,
            tags: ['wikipedia'],
          },
        ],
        duckduckgoResults: [
          {
            title: 'What is Quantum Physics',
            snippet: 'Another long description',
            url: 'https://example.com/quantum',
            displayUrl: 'example.com',
            tags: ['duckduckgo'],
          },
        ],
      };

      const sanitized = sanitizeToolResult('web_search', result);
      const parsed = JSON.parse(sanitized);

      // Should keep essential fields
      expect(parsed.success).toBe(true);
      expect(parsed.query).toBe('quantum physics');
      expect(parsed.count).toBe(5);

      // Should have truncated results with index
      expect(parsed.results).toHaveLength(2);
      expect(parsed.results[0].index).toBe(1);
      expect(parsed.results[0].title).toBe('Quantum Mechanics');
      expect(parsed.results[0].snippet.length).toBeLessThanOrEqual(153); // 150 + '...'
      
      // Should NOT have URLs or other fields
      expect(parsed.results[0]).not.toHaveProperty('url');
      expect(parsed.results[0]).not.toHaveProperty('pageid');
      expect(parsed.results[0]).not.toHaveProperty('wordcount');
      expect(parsed.results[0]).not.toHaveProperty('tags');

      // Should have duckduckgo results with index
      expect(parsed.duckduckgo).toHaveLength(1);
      expect(parsed.duckduckgo[0].index).toBe(1);
      expect(parsed.duckduckgo[0]).not.toHaveProperty('url');
    });

    it('should limit Wikipedia results to 3', () => {
      const result = {
        success: true,
        query: 'test',
        count: 5,
        results: [
          { title: '1', snippet: 'a' },
          { title: '2', snippet: 'b' },
          { title: '3', snippet: 'c' },
          { title: '4', snippet: 'd' },
          { title: '5', snippet: 'e' },
        ],
        duckduckgoResults: [],
      };

      const sanitized = sanitizeToolResult('web_search', result);
      const parsed = JSON.parse(sanitized);

      expect(parsed.results).toHaveLength(3);
      expect(parsed.results[0].index).toBe(1);
      expect(parsed.results[0].title).toBe('1');
      expect(parsed.results[2].index).toBe(3);
      expect(parsed.results[2].title).toBe('3');
    });

    it('should limit DuckDuckGo results to 2', () => {
      const result = {
        success: true,
        query: 'test',
        count: 4,
        results: [],
        duckduckgoResults: [
          { title: '1', snippet: 'a' },
          { title: '2', snippet: 'b' },
          { title: '3', snippet: 'c' },
          { title: '4', snippet: 'd' },
        ],
      };

      const sanitized = sanitizeToolResult('web_search', result);
      const parsed = JSON.parse(sanitized);

      expect(parsed.duckduckgo).toHaveLength(2);
      expect(parsed.duckduckgo[0].index).toBe(1);
      expect(parsed.duckduckgo[0].title).toBe('1');
      expect(parsed.duckduckgo[1].index).toBe(2);
      expect(parsed.duckduckgo[1].title).toBe('2');
    });
  });

  describe('search_youtube results', () => {
    it('should sanitize YouTube search results', () => {
      const result = {
        success: true,
        query: 'funny cats',
        count: 5,
        videos: [
          {
            videoId: 'abc123',
            title: 'Funny Cat Video',
            channelTitle: 'Cat Channel',
            description: 'A very funny cat',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            url: 'https://youtube.com/watch?v=abc123',
            duration: 'PT5M',
            publishedAt: '2026-01-01',
          },
        ],
      };

      const sanitized = sanitizeToolResult('search_youtube', result);
      const parsed = JSON.parse(sanitized);

      expect(parsed.success).toBe(true);
      expect(parsed.query).toBe('funny cats');
      expect(parsed.videos).toHaveLength(1);
      expect(parsed.videos[0].index).toBe(1);
      expect(parsed.videos[0].videoId).toBe('abc123');
      expect(parsed.videos[0].title).toBe('Funny Cat Video');
      expect(parsed.videos[0].channel).toBe('Cat Channel');
      
      // Should still have videoId for playing
      expect(parsed.videos[0].videoId).toBe('abc123');
      
      // Should NOT have URLs or descriptions
      expect(parsed.videos[0]).not.toHaveProperty('url');
      expect(parsed.videos[0]).not.toHaveProperty('thumbnailUrl');
      expect(parsed.videos[0]).not.toHaveProperty('description');
    });

    it('should limit YouTube results to 5', () => {
      const result = {
        success: true,
        query: 'test',
        count: 5,
        videos: [
          { title: '1', channelTitle: 'A' },
          { title: '2', channelTitle: 'B' },
          { title: '3', channelTitle: 'C' },
          { title: '4', channelTitle: 'D' },
          { title: '5', channelTitle: 'E' },
        ],
      };

      const sanitized = sanitizeToolResult('search_youtube', result);
      const parsed = JSON.parse(sanitized);

      expect(parsed.videos).toHaveLength(5);
    });
  });

  describe('player control results', () => {
    it('should minimize play_youtube_video results', () => {
      const result = {
        success: true,
        videoId: 'abc123',
        title: 'Video Title',
        message: 'Playing video',
      };

      const sanitized = sanitizeToolResult('play_youtube_video', result);
      const parsed = JSON.parse(sanitized);

      expect(parsed).toEqual({
        success: true,
        message: 'Playing video',
      });
    });

    it('should minimize control_youtube_player results', () => {
      const result = {
        success: true,
        action: 'pause',
        value: null,
        message: 'Paused',
      };

      const sanitized = sanitizeToolResult('control_youtube_player', result);
      const parsed = JSON.parse(sanitized);

      expect(parsed).toEqual({
        success: true,
        action: 'pause',
      });
    });

    it('should minimize close tool results', () => {
      const result = {
        success: true,
        action: 'close',
        message: 'Closing YouTube',
      };

      const sanitized = sanitizeToolResult('close_youtube', result);
      const parsed = JSON.parse(sanitized);

      expect(parsed).toEqual({ success: true });

      const sanitized2 = sanitizeToolResult('close_web_search', result);
      const parsed2 = JSON.parse(sanitized2);

      expect(parsed2).toEqual({ success: true });
    });
  });

  describe('snippet truncation', () => {
    it('should truncate long snippets to 150 chars', () => {
      const longText = 'a'.repeat(200);
      const result = {
        success: true,
        query: 'test',
        count: 1,
        results: [{ title: 'Test', snippet: longText }],
        duckduckgoResults: [],
      };

      const sanitized = sanitizeToolResult('web_search', result);
      const parsed = JSON.parse(sanitized);

      expect(parsed.results[0].snippet).toBe('a'.repeat(150) + '...');
      expect(parsed.results[0].snippet.length).toBe(153);
    });

    it('should not truncate short snippets', () => {
      const shortText = 'Short snippet';
      const result = {
        success: true,
        query: 'test',
        count: 1,
        results: [{ title: 'Test', snippet: shortText }],
        duckduckgoResults: [],
      };

      const sanitized = sanitizeToolResult('web_search', result);
      const parsed = JSON.parse(sanitized);

      expect(parsed.results[0].snippet).toBe('Short snippet');
    });
  });
});
