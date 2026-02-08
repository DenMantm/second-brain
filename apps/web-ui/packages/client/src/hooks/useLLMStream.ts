/**
 * LLM Streaming Hook  
 * Manages LLM response streaming, tool call handling, and TTS orchestration
 */

import { useCallback, useRef } from 'react';
import { generateCompletionStream } from '../services/llm';
import { StreamingOrchestrator } from '../services/streamingOrchestrator';
import { handleToolCall, type ToolCall } from '../services/toolCallHandler';

export interface UseLLMStreamOptions {
  temperature?: number;
  maxTokens?: number;
  onTextChunk?: (chunk: string, fullText: string) => void;
  onToolCall?: (toolName: string, systemMessage: string) => void;
  onSpeechMessage?: (message: string) => Promise<void>;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface StreamOptions {
  sessionId: string;
  signal?: AbortSignal;
}

export interface UseLLMStreamResult {
  streamResponse: (userMessage: string, options: StreamOptions) => Promise<string>;
  abort: () => void;
  isStreaming: boolean;
}

/**
 * Custom hook for LLM streaming with TTS orchestration
 * Handles text streaming, tool calls, and audio synthesis
 */
export function useLLMStream(
  orchestrator: StreamingOrchestrator,
  options: UseLLMStreamOptions = {}
): UseLLMStreamResult {
  const {
    temperature = 0.7,
    maxTokens = 2048,
    onTextChunk,
    onToolCall,
    onSpeechMessage,
    onComplete,
    onError
  } = options;
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  
  /**
   * Abort the current stream
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('🛑 Aborting LLM stream');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      isStreamingRef.current = false;
    }
  }, []);
  
  /**
   * Stream LLM response and process chunks
   * Returns the full accumulated response text
   */
  const streamResponse = useCallback(async (
    userMessage: string,
    streamOptions: StreamOptions
  ): Promise<string> => {
    // Create new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isStreamingRef.current = true;
    
    let fullText = '';
    let receivedToolCall = false;
    let receivedTextChunk = false;
    
    try {
      // Generate streaming response
      const stream = generateCompletionStream(userMessage, {
        sessionId: streamOptions.sessionId,
        temperature,
        maxTokens,
        signal: streamOptions.signal || controller.signal,
      });
      
      // Process each chunk
      for await (const chunk of stream) {
        if (controller.signal.aborted) {
          console.log('🛑 Stream aborted');
          break;
        }
        
        // Handle tool calls
        if (chunk.type === 'tool_call') {
          receivedToolCall = true;
          
          const toolCall: ToolCall = {
            name: chunk.data?.name ?? 'unknown',
            args: (chunk.data as any)?.args,
            result: chunk.data?.result
          };
          
          // Process tool call
          const { systemMessage, speechMessage } = handleToolCall(toolCall);
          
          // Notify about tool call
          onToolCall?.(toolCall.name, systemMessage);
          
          // Synthesize speech message if present
          if (speechMessage && onSpeechMessage) {
            await onSpeechMessage(speechMessage);
          } else if (speechMessage) {
            // Fallback to orchestrator if no custom handler
            await orchestrator.processTextChunk(speechMessage);
          }
          
          continue;
        }
        
        // Handle text chunks
        if (chunk.type === 'text') {
          receivedTextChunk = true;
          fullText += chunk.content;
          
          // Notify about text chunk
          onTextChunk?.(chunk.content, fullText);
          
          // Process through orchestrator for TTS
          await orchestrator.processTextChunk(chunk.content);
        }
      }
      
      // Flush remaining buffered text
      if (!controller.signal.aborted) {
        await orchestrator.flush();
      }
      
      // If only tool calls and no text, mark as complete
      if (receivedToolCall && !receivedTextChunk) {
        onComplete?.();
      }
      
      return fullText;
      
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('❌ LLM stream error:', error);
        onError?.(error as Error);
      }
      throw error;
    } finally {
      abortControllerRef.current = null;
      isStreamingRef.current = false;
    }
  }, [
    temperature,
    maxTokens,
    orchestrator,
    onTextChunk,
    onToolCall,
    onSpeechMessage,
    onComplete,
    onError
  ]);
  
  return {
    streamResponse,
    abort,
    isStreaming: isStreamingRef.current,
  };
}
