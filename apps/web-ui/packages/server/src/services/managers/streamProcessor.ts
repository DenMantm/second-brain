/**
 * Stream Processor
 * Handles streaming LLM responses with tool call detection and execution
 */

import type { SessionData } from './sessionManager';
import { ToolExecutor, type ToolCallResult } from './toolExecutor';
import { SystemMessage } from '@langchain/core/messages';
import { logger } from '../../utils/logger';

export interface StreamResult {
  fullResponse: string;
  toolResults: ToolCallResult[];
}

export class StreamProcessor {
  private toolExecutor = new ToolExecutor();

  /**
   * Process a streaming LLM response
   * Yields text chunks and tool call results
   */
  async* processStream(
    session: SessionData,
    messages: any[],
    userMessage: string,
    includeToolReminder: boolean = true
  ): AsyncGenerator<string | ToolCallResult, StreamResult, unknown> {
    // Add tool schema reminder if requested
    const messagesToSend = includeToolReminder
      ? [...messages, new SystemMessage(
          'Tool schema reminder: search_youtube requires args with a non-empty "query" string and optional "max_results" number.'
        )]
      : messages;

    // Stream LLM response
    const stream = await session.llm.stream(messagesToSend);
    
    let fullResponse = '';
    const toolCallBuffers = new Map<string, { name?: string; argsText: string }>();
    
    // Process stream chunks
    for await (const chunk of stream) {
      // Handle text content
      const content = chunk.content?.toString() || '';
      if (content) {
        fullResponse += content;
        yield content; // Yield text chunks for streaming display
      }
      
      // Handle tool call chunks
      this.toolExecutor.parseToolCallChunks(chunk, toolCallBuffers);
    }

    // Build complete tool calls from buffered chunks
    const toolCalls = this.toolExecutor.buildToolCalls(toolCallBuffers);
    
    logger.dev('Tool call buffers:', Array.from(toolCallBuffers.entries()));
    logger.dev('Built tool calls:', toolCalls);
    
    // Execute tool calls and yield results
    const toolResults: ToolCallResult[] = [];
    
    if (toolCalls.length > 0) {
      const results = await this.toolExecutor.executeToolCalls(toolCalls, userMessage);
      
      for (const result of results) {
        toolResults.push(result);
        yield result; // Yield tool execution result to frontend
      }
    }
    
    return { fullResponse, toolResults };
  }

  /**
   * Get the tool executor instance
   */
  getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }
}
