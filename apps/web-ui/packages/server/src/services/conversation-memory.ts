/**
 * Conversation Memory Service using LangChain v0.3
 * Manages conversation history and context for each user session
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatMessageHistory } from '@langchain/community/stores/message/in_memory';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { config } from '../config';
import { 
  addMessageToConversation, 
  getConversationMessages 
} from './conversation-storage';

// Store conversation sessions by session ID
interface SessionData {
  history: ChatMessageHistory;
  llm: ChatOpenAI;
}

const sessions = new Map<string, SessionData>();

interface ConversationOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Get or create a session with message history
 */
function getSession(sessionId: string, options?: ConversationOptions): SessionData {
  // Return existing session if it exists
  if (sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }

  // Create new session with LLM and message history
  const llm = new ChatOpenAI({
    apiKey: 'sk-dummy-key-for-local-llm', // LM Studio doesn't validate API key
    modelName: 'local-model',
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 150,
    configuration: {
      baseURL: config.llmServiceUrl,
    },
  });

  const history = new ChatMessageHistory();
  
  const sessionData: SessionData = { history, llm };
  sessions.set(sessionId, sessionData);
  return sessionData;
}

/**
 * Send a message and get a response (LangChain v0.3 approach)
 */
export async function sendMessage(
  sessionId: string,
  message: string,
  options?: ConversationOptions
): Promise<string> {
  const session = getSession(sessionId, options);
  
  // Add user message to history
  await session.history.addMessage(new HumanMessage(message));
  
  // Save user message to storage
  try {
    addMessageToConversation(sessionId, 'user', message);
  } catch (error) {
    // Session might not be in storage yet, that's ok
  }
  
  // Get all messages for context
  const messages = await session.history.getMessages();
  
  // Call LLM with full conversation history
  const response = await session.llm.invoke(messages);
  
  const responseText = response.content.toString();
  
  // Add AI response to history
  await session.history.addMessage(new AIMessage(responseText));
  
  // Save AI response to storage
  try {
    addMessageToConversation(sessionId, 'assistant', responseText);
  } catch (error) {
    // Session might not be in storage yet, that's ok
  }
  
  return responseText;
}

/**
 * Clear conversation history for a session
 */
export async function clearConversation(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (session) {
    await session.history.clear();
  }
}

/**
 * Delete a conversation session
 */
export function deleteConversation(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Get all active session IDs
 */
export function getActiveSessions(): string[] {
  return Array.from(sessions.keys());
}

/**
 * Load a conversation from storage into active session
 */
export async function loadConversation(conversationId: string): Promise<void> {
  const messages = getConversationMessages(conversationId);
  
  if (!messages || messages.length === 0) {
    return;
  }
  
  // Create or get session
  const session = getSession(conversationId);
  
  // Clear existing history
  await session.history.clear();
  
  // Restore messages from storage
  for (const msg of messages) {
    if (msg.role === 'user') {
      await session.history.addMessage(new HumanMessage(msg.content));
    } else {
      await session.history.addMessage(new AIMessage(msg.content));
    }
  }
}
