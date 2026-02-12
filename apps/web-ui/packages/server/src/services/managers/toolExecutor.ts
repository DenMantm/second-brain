/**
 * Tool Executor
 * Handles parsing and execution of LLM tool calls (YouTube and Web Search functions)
 */

import { youtubeTools } from '../../tools/youtube-tools';
import { webSearchTools } from '../../tools/web-search-tools';
import { logger } from '../../utils/logger';

// Combine all tools
const allTools = [...youtubeTools, ...webSearchTools];

export interface ToolCall {
  name: string;
  args: Record<string, any>;
  id: string;
  type: 'tool_call';
}

export interface ToolCallResult {
  type: 'tool_call';
  data: {
    name: string;
    args: Record<string, any>;
    result: any;
  };
}

export class ToolExecutor {
  /**
   * Parse tool call chunks from streaming response
   */
  parseToolCallChunks(
    chunk: any,
    toolCallBuffers: Map<string, { name?: string; argsText: string }>
  ): void {
    const toolCallChunks = (chunk as any).tool_call_chunks
      ?? (chunk as any).kwargs?.tool_call_chunks
      ?? [];
    const chunkToolCalls = (chunk as any).kwargs?.additional_kwargs?.tool_calls
      ?? (chunk as any).additional_kwargs?.tool_calls
      ?? [];

    if (toolCallChunks.length > 0) {
      for (const toolCallChunk of toolCallChunks) {
        const index = toolCallChunk.index ?? 0;
        const id = `index-${index}`;
        const existing = toolCallBuffers.get(id) ?? { argsText: '' };
        
        if (toolCallChunk.name) {
          existing.name = toolCallChunk.name;
        }
        if (!existing.name && chunkToolCalls[index]?.function?.name) {
          existing.name = chunkToolCalls[index].function.name;
        }
        if (toolCallChunk.args) {
          existing.argsText += toolCallChunk.args;
        }
        
        toolCallBuffers.set(id, existing);
      }
    }
  }

  /**
   * Build complete tool calls from buffered chunks
   */
  buildToolCalls(
    toolCallBuffers: Map<string, { name?: string; argsText: string }>
  ): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    for (const [id, buffer] of toolCallBuffers.entries()) {
      const name = buffer.name ?? '';
      const argsText = buffer.argsText.trim();
      
      if (!name || !argsText) {
        continue;
      }

      try {
        const parsedArgs = JSON.parse(argsText);
        toolCalls.push({
          name,
          args: parsedArgs,
          id,
          type: 'tool_call',
        });
      } catch (error) {
        console.error(`[YouTube Tool] Failed to parse tool args for ${name}:`, error);
      }
    }

    return toolCalls;
  }

  /**
   * Execute a single tool call
   */
  async executeToolCall(
    toolCall: ToolCall,
    userMessage: string
  ): Promise<ToolCallResult> {
    logger.separator('EXECUTING TOOL CALL');
    logger.dev('Tool name:', toolCall.name);
    logger.dev('Tool args:', toolCall.args);
    logger.dev('User message:', userMessage);
    
    try {
      // Find the matching tool
      const tool = allTools.find(t => t.name === toolCall.name);
      
      if (!tool) {
        throw new Error(`Tool not found: ${toolCall.name}`);
      }

      const toolArgs = typeof toolCall.args === 'object' && toolCall.args !== null
        ? toolCall.args
        : {};
      
      // Fallback: If search_youtube is called without query, try to extract from user message
      if (toolCall.name === 'search_youtube' && (!toolArgs.query || toolArgs.query === '')) {
        toolArgs.query = this.extractSearchQuery(userMessage);
      }
      
      // Execute the tool
      const result = await tool.invoke(toolArgs);
      
      // Parse the JSON result
      const parsedResult = JSON.parse(result);
      
      logger.dev('Tool execution complete:', parsedResult);
      logger.separator();
      
      return {
        type: 'tool_call',
        data: {
          name: toolCall.name,
          args: toolArgs,
          result: parsedResult,
        },
      };
    } catch (error) {
      console.error(`Failed to execute tool ${toolCall.name}:`, error);
      logger.dev('Tool execution failed:', error);
      logger.separator();
      return {
        type: 'tool_call',
        data: {
          name: toolCall.name,
          args: toolCall.args,
          result: {
            success: false,
            error: error instanceof Error ? error.message : 'Tool execution failed',
          },
        },
      };
    }
  }

  /**
   * Execute multiple tool calls
   */
  async executeToolCalls(
    toolCalls: ToolCall[],
    userMessage: string
  ): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeToolCall(toolCall, userMessage);
      results.push(result);
    }

    return results;
  }

  /**
   * Extract search query from user message when tool args are empty
   */
  private extractSearchQuery(message: string): string {
    // Try to extract search query from user message
    // Remove common phrases like "search for", "find", "show me", etc.
    const extractedQuery = message.toLowerCase()
      .replace(/^(can you\s+)?search\s+(for\s+)?/i, '')
      .replace(/^(find|show|look for|get|play)\s+(me\s+)?(some\s+)?/i, '')
      .replace(/^(a\s+)?youtube\s+(videos?\s+)?/i, '')
      .replace(/(videos?\s+)?(for|about|on|of)\s+/i, '')
      .replace(/\s+on\s+youtube$/i, '')
      .trim();
    
    return extractedQuery || message;
  }

  /**
   * Generate response text suffix for tool execution
   */
  getToolExecutionSuffix(result: any, toolName: string): string {
    if (result && result.success) {
      return `\n[Executed: ${toolName}]`;
    }
    return '';
  }
}
