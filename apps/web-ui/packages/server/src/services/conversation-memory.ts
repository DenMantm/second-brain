/**
 * Conversation Memory Service using LangChain v0.3
 * Manages conversation history and context for each user session
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatMessageHistory } from '@langchain/community/stores/message/in_memory';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
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
    modelName: 'openai/gpt-oss-20b', // GPT OSS 20B model
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 2048,
    configuration: {
      baseURL: config.llmServiceUrl,
    },
  });

  const history = new ChatMessageHistory();
  
  // Add system prompt optimized for voice assistant
  const systemPrompt = options?.systemPrompt ?? `You are a helpful voice assistant, a replacement for Google Assistant. Your responses will be converted to speech and played back to the user, so follow these guidelines:

1. Keep responses conversational and natural - speak like a friendly, knowledgeable assistant
2. Be concise but complete - aim for 2-4 sentences unless more detail is specifically requested
3. Avoid visual formatting - no markdown (no **bold**, *italic*, \`code\`, [links]), bullet points, or numbered lists (use "first", "second", "also" instead)
4. Speak information clearly:
   - Spell out acronyms the first time (TTS as "T T S" or "text to speech")
   - Write out symbols: use "and" not "&", "percent" not "%", "number" not "#", "dollars" not "$"
   - Write out abbreviations: "Doctor" not "Dr.", "Mister" not "Mr.", "et cetera" not "etc."
   - Say numbers naturally: "one hundred twenty-three" not "123", "three thirty PM" not "3:30pm"
   - Write out units: "degrees Celsius" not "°C", "copyright" not "©"
5. Use natural speech patterns - contractions are fine, use "and" instead of commas for lists
6. For multi-step instructions, use transition words: "First...", "Then...", "Finally..."
7. If asked about time-sensitive information, acknowledge you don't have real-time data
8. Keep a friendly, helpful tone - you're here to assist, not lecture

Remember: The user is listening, not reading. Make every response easy to understand when spoken aloud. Never use visual-only symbols or formatting.`;

  history.addMessage(new SystemMessage(systemPrompt));
  
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
 * Send a message and stream the response chunk by chunk
 */
export async function* sendMessageStream(
  sessionId: string,
  message: string,
  options?: ConversationOptions
): AsyncGenerator<string, void, unknown> {
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
  
  // Stream LLM response
  const stream = await session.llm.stream(messages);
  
  let fullResponse = '';
  
  for await (const chunk of stream) {
    const content = chunk.content.toString();
    fullResponse += content;
    yield content;
  }
  
  // Add full AI response to history
  await session.history.addMessage(new AIMessage(fullResponse));
  
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
