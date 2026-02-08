import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolExecutor } from '../toolExecutor';

describe('ToolExecutor', () => {
  let toolExecutor: ToolExecutor;

  beforeEach(() => {
    toolExecutor = new ToolExecutor();
  });

  describe('parseToolCallChunks', () => {
    it('should parse tool call chunks and update buffer', () => {
      const buffer = new Map();
      const chunk = {
        tool_call_chunks: [
          { index: 0, name: 'search_youtube', args: '{"query":' },
        ],
      };

      toolExecutor.parseToolCallChunks(chunk, buffer);

      expect(buffer.size).toBe(1);
      expect(buffer.get('index-0')).toEqual({
        name: 'search_youtube',
        argsText: '{"query":',
      });
    });

    it('should accumulate args across multiple chunks', () => {
      const buffer = new Map();
      
      const chunk1 = {
        tool_call_chunks: [
          { index: 0, name: 'search_youtube', args: '{"query":' },
        ],
      };
      const chunk2 = {
        tool_call_chunks: [
          { index: 0, args: '"test"}' },
        ],
      };

      toolExecutor.parseToolCallChunks(chunk1, buffer);
      toolExecutor.parseToolCallChunks(chunk2, buffer);

      expect(buffer.get('index-0')?.argsText).toBe('{"query":"test"}');
    });

    it('should handle empty chunks gracefully', () => {
      const buffer = new Map();
      const chunk = {};

      toolExecutor.parseToolCallChunks(chunk, buffer);

      expect(buffer.size).toBe(0);
    });
  });

  describe('buildToolCalls', () => {
    it('should build valid tool calls from buffer', () => {
      const buffer = new Map([
        ['index-0', { name: 'search_youtube', argsText: '{"query":"test"}' }],
      ]);

      const toolCalls = toolExecutor.buildToolCalls(buffer);

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual({
        id: 'index-0',
        name: 'search_youtube',
        args: { query: 'test' },
        type: 'tool_call',
      });
    });

    it('should skip invalid JSON args', () => {
      const buffer = new Map([
        ['index-0', { name: 'search_youtube', argsText: '{invalid json}' }],
      ]);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const toolCalls = toolExecutor.buildToolCalls(buffer);

      expect(toolCalls).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should skip incomplete buffer entries', () => {
      const buffer = new Map([
        ['index-0', { argsText: '{"query":"test"}' }], // Missing name
        ['index-1', { name: 'search_youtube', argsText: '' }], // Empty args
      ]);

      const toolCalls = toolExecutor.buildToolCalls(buffer);

      expect(toolCalls).toHaveLength(0);
    });
  });

  describe('getToolExecutionSuffix', () => {
    it('should return suffix for successful execution', () => {
      const result = { success: true };
      const suffix = toolExecutor.getToolExecutionSuffix(result, 'search_youtube');

      expect(suffix).toBe('\n[Executed: search_youtube]');
    });

    it('should return empty string for failed execution', () => {
      const result = { success: false };
      const suffix = toolExecutor.getToolExecutionSuffix(result, 'search_youtube');

      expect(suffix).toBe('');
    });

    it('should return empty string for null result', () => {
      const suffix = toolExecutor.getToolExecutionSuffix(null, 'search_youtube');

      expect(suffix).toBe('');
    });
  });

  // Note: executeToolCall and executeToolCalls tests would require mocking YouTube tools
  // Those are integration tests better suited for the full conversation-memory test suite
});
