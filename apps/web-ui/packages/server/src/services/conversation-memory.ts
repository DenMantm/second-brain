/**
 * Conversation Memory Service using LangChain v0.3
 * Manages conversation history and context for each user session
 */

import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { 
  addMessageToConversation, 
  getConversationMessages 
} from './conversation-storage';
import {
  SessionManager,
  StreamProcessor,
  setCurrentSession,
  clearCurrentSession,
} from './managers';
import { logger } from '../utils/logger';
import { sanitizeToolResult } from '../utils/sanitize-tool-result';

// Create singleton instances
const sessionManager = new SessionManager();
const streamProcessor = new StreamProcessor();

interface ConversationOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Send a message and get a response (LangChain v0.3 approach)
 */
export async function sendMessage(
  sessionId: string,
  message: string,
  options?: ConversationOptions
): Promise<string> {
  logger.separator('INCOMING MESSAGE (NON-STREAM)');
  logger.dev('Session ID:', sessionId);
  logger.dev('User message:', message);
  logger.dev('Options:', options);
  
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
  
  logger.dev('Total messages in history:', messages.length);
  logger.dev('Calling LLM with messages...');
  
  // Set session context for tools
  setCurrentSession(sessionId);
  
  try {
    // Call LLM with full conversation history
    const response = await session.llm.invoke(messages);
    
    const responseText = response.content.toString();
    
    logger.dev('LLM raw response:', response);
    logger.dev('LLM response text:', responseText);
    logger.separator();
    
    // Add AI response to history
    await sessionManager.addMessage(sessionId, new AIMessage(responseText));
    
    // Save AI response to storage with model info
    try {
      addMessageToConversation(sessionId, 'assistant', responseText, {
        model: options?.model || 'openai/gpt-oss-20b',
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });
    } catch (error) {
      // Session might not be in storage yet, that's ok
    }
    
    return responseText;
  } finally {
    // Clear session context after LLM invocation
    clearCurrentSession();
  }
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
  logger.separator('INCOMING MESSAGE (STREAM)');
  logger.dev('Session ID:', sessionId);
  logger.dev('User message:', message);
  logger.dev('Options:', options);
  
  const session = sessionManager.getSession(sessionId, {
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    systemPrompt: options?.systemPrompt,
    model: options?.model,
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
  
  // Set session context for tools
  setCurrentSession(sessionId);
  
  // Process stream with tool execution
  let fullResponse = '';
  let aiMessageWithTools: AIMessage | null = null;
  const executedTools: Array<{ id: string; name: string; result: any }> = [];
  
  for await (const chunk of streamProcessor.processStream(session, messages, message, true)) {
    if (typeof chunk === 'string') {
      fullResponse += chunk;
      yield chunk;
    } else {
      // Tool call result
      yield chunk;
      
      // Store tool execution for follow-up processing
      executedTools.push({
        id: chunk.data.id || `tool_${Date.now()}`,
        name: chunk.data.name,
        result: chunk.data.result,
      });
      
      // Add tool execution note to full response for storage
      if (chunk.data.result.success) {
        fullResponse += `\n[Executed: ${chunk.data.name}]`;
      }
    }
  }
  
  // If tools were executed, add ToolMessages and get LLM's final response
  if (executedTools.length > 0) {
    logger.dev('Tools executed:', executedTools.length);
    
    // Add AI message with tool calls to history
    aiMessageWithTools = new AIMessage({
      content: fullResponse || '',
      tool_calls: executedTools.map(t => ({
        id: t.id,
        name: t.name,
        args: {}, // Args already used, not needed in history
      })),
    });
    await sessionManager.addMessage(sessionId, aiMessageWithTools);
    
    // Add ToolMessages for each tool result
    for (const tool of executedTools) {
      // Sanitize tool result to reduce token usage (remove URLs, truncate snippets)
      const sanitizedContent = sanitizeToolResult(tool.name, tool.result);
      
      const toolMessage = new ToolMessage({
        content: sanitizedContent,
        tool_call_id: tool.id,
      });
      await sessionManager.addMessage(sessionId, toolMessage);
      
      logger.dev(`Tool result sanitized for LLM context (${tool.name}):`, sanitizedContent.length, 'chars');
    }
    
    // Get LLM's final response using the tool results
    const followUpMessages = await sessionManager.getMessages(sessionId);
    const followUpStream = await session.llm.stream(followUpMessages);
    
    let finalResponse = '';
    for await (const chunk of followUpStream) {
      const content = chunk.content?.toString() || '';
      if (content) {
        finalResponse += content;
        yield content; // Stream the final response
      }
    }
    
    logger.dev('Final LLM response with tool context:', finalResponse);
    fullResponse = finalResponse; // Use final response for storage
  }
  
  logger.dev('Full LLM response:', fullResponse);
  logger.separator();
  
  // Add final AI response to history
  if (executedTools.length === 0) {
    // No tools were used, add simple AI response
    await sessionManager.addMessage(sessionId, new AIMessage(fullResponse));
  } else {
    // Tools were used, final response already reflects tool results
    await sessionManager.addMessage(sessionId, new AIMessage(fullResponse));
  }
  
  // Save AI response to storage with model info
  try {
    addMessageToConversation(sessionId, 'assistant', fullResponse, {
      model: options?.model || 'openai/gpt-oss-20b',
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });
  } catch (error) {
    // Session might not be in storage yet, that's ok
  }
  
  // Clear session context after streaming completes
  clearCurrentSession();
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
