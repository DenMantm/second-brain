/**
 * Conversation Memory Service using LangChain v0.3
 * Manages conversation history and context for each user session
 */

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { 
  addMessageToConversation, 
  getConversationMessages 
} from './conversation-storage';
import {
  SessionManager,
  StreamProcessor,
} from './managers';

// Create singleton instances
const sessionManager = new SessionManager();
const streamProcessor = new StreamProcessor();

interface ConversationOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Send a message and get a response (LangChain v0.3 approach)
 */
export async function sendMessage(
  sessionId: string,
  message: string,
  options?: ConversationOptions
): Promise<string> {
  const session = sessionManager.getSession(sessionId, {
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    systemPrompt: options?.systemPrompt,
  });
  
  // Add user message to history
  await sessionManager.addMessage(sessionId, new HumanMessage(message));
  
  // Save user message to storage
  try {
    addMessageToConversation(sessionId, 'user', message);
  } catch (error) {
    // Session might not be in storage yet, that's ok
  }
  
  // Get all messages for context
  const messages = await sessionManager.getMessages(sessionId);
  
  // Call LLM with full conversation history
  const response = await session.llm.invoke(messages);
  
  const responseText = response.content.toString();
  
  // Add AI response to history
  await sessionManager.addMessage(sessionId, new AIMessage(responseText));
  
  // Save AI response to storage
  try {
    addMessageToConversation(sessionId, 'assistant', responseText);
  } catch (error) {
    // Session might not be in storage yet, that's ok
  }
  
  return responseText;
}

/**
 * Send a message and stream the response chunk by chunk
 * Handles both text streaming and tool calls (YouTube functions)
 */
export async function* sendMessageStream(
  sessionId: string,
  message: string,
  options?: ConversationOptions
): AsyncGenerator<string | { type: 'tool_call'; data: any }, void, unknown> {
  const session = sessionManager.getSession(sessionId, {
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    systemPrompt: options?.systemPrompt,
  });
  
  // Add user message to history
  await sessionManager.addMessage(sessionId, new HumanMessage(message));
  
  // Save user message to storage
  try {
    addMessageToConversation(sessionId, 'user', message);
  } catch (error) {
    // Session might not be in storage yet, that's ok
  }
  
  // Get all messages for context
  const messages = await sessionManager.getMessages(sessionId);
  
  // Process stream with tool execution
  let fullResponse = '';
  
  for await (const chunk of streamProcessor.processStream(session, messages, message, true)) {
    if (typeof chunk === 'string') {
      fullResponse += chunk;
      yield chunk;
    } else {
      // Tool call result
      yield chunk;
      
      // Add tool execution note to full response for storage
      if (chunk.data.result.success) {
        fullResponse += `\n[Executed: ${chunk.data.name}]`;
      }
    }
  }
  
  // Add full AI response to history
  await sessionManager.addMessage(sessionId, new AIMessage(fullResponse));
  
  // Save AI response to storage
  try {
    addMessageToConversation(sessionId, 'assistant', fullResponse);
  } catch (error) {
    // Session might not be in storage yet, that's ok
  }
}

/**
 * Clear conversation history for a session
 */
export async function clearConversation(sessionId: string): Promise<void> {
  await sessionManager.clearSession(sessionId);
}

/**
 * Delete a conversation session
 */
export function deleteConversation(sessionId: string): void {
  sessionManager.deleteSession(sessionId);
}

/**
 * Get all active session IDs
 */
export function getActiveSessions(): string[] {
  return sessionManager.getActiveSessions();
}

/**
 * Load a conversation from storage into active session
 */
export async function loadConversation(conversationId: string): Promise<void> {
  const messages = getConversationMessages(conversationId);
  
  if (!messages || messages.length === 0) {
    return;
  }
  
  // Restore messages from storage
  await sessionManager.restoreMessages(conversationId, messages);
}
