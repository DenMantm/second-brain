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
 * Generate LLM completion
 */
export async function generateCompletion(
  userMessage: string,
  conversationHistory?: Message[],
  options?: LLMOptions
): Promise<LLMResponse> {
  try {
    const messages: Message[] = [];
    
    // Add system prompt
    if (options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }
    
    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }
    
    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage,
    });
    
    console.log(`🤖 Sending to LLM: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);
    
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 512,
        model: options?.model,
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
