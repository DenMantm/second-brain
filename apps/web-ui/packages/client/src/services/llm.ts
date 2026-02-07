/**
 * LLM Service Client (LM Studio / OpenAI-compatible API)
 */

const API_BASE_URL = '/api/llm';

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Generate LLM completion with conversation memory
 */
export async function generateCompletion(
  userMessage: string,
  _conversationHistory?: Message[], // Kept for backward compatibility but not used
  options?: LLMOptions & { sessionId?: string }
): Promise<LLMResponse> {
  try {
    console.log(`🤖 Sending to LLM: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);
    
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        sessionId: options?.sessionId || 'default-session',
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 150,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`LLM service error: ${error.error || response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`✅ LLM response: "${result.text.substring(0, 50)}${result.text.length > 50 ? '...' : ''}"`);
    
    return result;
  } catch (error) {
    console.error('LLM request failed:', error);
    throw error;
  }
}

/**
 * Generate streaming LLM completion with Server-Sent Events
 * Returns an async generator that yields text chunks as they arrive
 */
export async function* generateCompletionStream(
  userMessage: string,
  options?: LLMOptions & { sessionId?: string; signal?: AbortSignal }
): AsyncGenerator<string, void, unknown> {
  try {
    console.log(`🤖 Streaming from LLM: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);
    
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        sessionId: options?.sessionId || 'default-session',
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 150,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`LLM streaming error: ${error.error || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✅ LLM stream complete');
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (format: "data: {...}\n\n")
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6); // Remove "data: " prefix
            
            if (dataStr === '[DONE]') {
              return; // Stream complete
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.chunk) {
                yield data.chunk;
              } else if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', dataStr, parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('🛑 LLM stream aborted');
      return;
    }
    console.error('LLM streaming failed:', error);
    throw error;
  }
}

/**
 * Check LLM service health
 */
export async function checkLLMHealth(): Promise<{ status: string; url: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('LLM health check failed:', error);
    return { status: 'unavailable', url: 'unknown' };
  }
}
