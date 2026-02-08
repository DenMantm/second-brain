/**
 * LLM Stream Manager
 * Service-level manager for LLM streaming with TTS orchestration
 */

import { generateCompletionStream } from './llm';
import { StreamingOrchestrator } from './streamingOrchestrator';
import { handleToolCall, type ToolCall } from './toolCallHandler';

export interface LLMStreamOptions {
  sessionId: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LLMStreamCallbacks {
  onTextChunk?: (chunk: string, fullText: string) => void;
  onToolCall?: (toolName: string, systemMessage: string, speechMessage: string) => void;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface LLMStreamResult {
  fullText: string;
  hadToolCalls: boolean;
  hadTextChunks: boolean;
  aborted: boolean;
}

export class LLMStreamManager {
  private orchestrator: StreamingOrchestrator;
  private callbacks: LLMStreamCallbacks;
  private abortController: AbortController | null = null;
  
  constructor(
    orchestrator: StreamingOrchestrator,
    callbacks: LLMStreamCallbacks = {}
  ) {
    this.orchestrator = orchestrator;
    this.callbacks = callbacks;
  }
  
  /**
   * Update callbacks
   */
  setCallbacks(callbacks: LLMStreamCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
  
  /**
   * Stream LLM response and process through TTS
   */
  async stream(
    userMessage: string,
    options: LLMStreamOptions
  ): Promise<LLMStreamResult> {
    // Create abort controller
    this.abortController = new AbortController();
    
    const {
      sessionId,
      temperature = 0.7,
      maxTokens = 2048,
      signal
    } = options;
    
    let fullText = '';
    let hadToolCalls = false;
    let hadTextChunks = false;
    let aborted = false;
    
    this.callbacks.onStreamStart?.();
    
    try {
      // Generate streaming response
      const stream = generateCompletionStream(userMessage, {
        sessionId,
        temperature,
        maxTokens,
        signal: signal || this.abortController.signal,
      });
      
      // Process chunks
      for await (const chunk of stream) {
        if (this.abortController?.signal.aborted) {
          console.log('🛑 LLM stream aborted');
          aborted = true;
          break;
        }
        
        // Handle tool calls
        if (chunk.type === 'tool_call') {
          hadToolCalls = true;
          
          const toolCall: ToolCall = {
            name: chunk.data?.name ?? 'unknown',
            args: (chunk.data as any)?.args,
            result: chunk.data?.result
          };
          
          // Execute tool and get messages
          const { systemMessage, speechMessage } = handleToolCall(toolCall);
          
          // Notify callback
          this.callbacks.onToolCall?.(toolCall.name, systemMessage, speechMessage);
          
          // Synthesize speech if present
          if (speechMessage) {
            await this.orchestrator.processTextChunk(speechMessage);
          }
          
          continue;
        }
        
        // Handle text chunks
        if (chunk.type === 'text') {
          hadTextChunks = true;
          fullText += chunk.content;
          
          // Notify callback
          this.callbacks.onTextChunk?.(chunk.content, fullText);
          
          // Process through TTS
          await this.orchestrator.processTextChunk(chunk.content);
        }
      }
      
      // Flush remaining text
      if (!aborted) {
        await this.orchestrator.flush();
      }
      
      this.callbacks.onStreamEnd?.();
      
      return {
        fullText,
        hadToolCalls,
        hadTextChunks,
        aborted
      };
      
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('❌ LLM stream error:', error);
        this.callbacks.onError?.(error as Error);
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }
  
  /**
   * Abort current stream
   */
  abort(): void {
    if (this.abortController) {
      console.log('🛑 Aborting LLM stream');
      this.abortController.abort();
      this.abortController = null;
    }
  }
  
  /**
   * Check if currently streaming
   */
  isStreaming(): boolean {
    return this.abortController !== null;
  }
}
