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
import { youtubeTools } from '../tools/youtube-tools';

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

  // Create base LLM instance
  const baseLlm = new ChatOpenAI({
    apiKey: 'sk-dummy-key-for-local-llm', // LM Studio doesn't validate API key
    modelName: 'openai/gpt-oss-20b', // GPT OSS 20B model
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 2048,
    configuration: {
      baseURL: config.llmServiceUrl,
    },
  });

  // Bind YouTube tools to LLM for function calling
  const llm = baseLlm.bindTools(youtubeTools);

  const history = new ChatMessageHistory();
  
  // Add system prompt optimized for voice assistant with YouTube capabilities
  const systemPrompt = options?.systemPrompt ?? `You are a helpful voice assistant with YouTube search and playback capabilities, a replacement for Google Assistant. Your responses will be converted to speech and played back to the user.

YOUTUBE CAPABILITIES:
You can search YouTube, play videos, and control playback using these tools:
- search_youtube: Search for videos (e.g., "search YouTube for cooking recipes")
- play_youtube_video: Play a video by index from search results (e.g., "play the first one")
- control_youtube_player: Control playback (play, pause, seek, volume)

When user asks to search YouTube:
1. Use search_youtube with their query
2. After getting results, describe the top videos naturally
3. Ask which one they'd like to watch

When user selects a video (e.g., "play the first one", "play number 3"):
IMPORTANT: When presenting search results, describe them conversationally:
- "I found some great cooking videos. The top one is 'Easy 15-Minute Pasta' by Chef John with 2 million views."
- "There's also 'Traditional Italian Pasta' by Italia Squisita with 850 thousand views."
- Use natural language for numbers and avoid listing format

1. Use play_youtube_video with the index
2. Confirm what's now playing

For playback controls (pause, play, skip to time, volume):
1. Use control_youtube_player with the appropriate action
2. Confirm the action

VOICE RESPONSE GUIDELINES:
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
 * Handles both text streaming and tool calls (YouTube functions)
 */
export async function* sendMessageStream(
  sessionId: string,
  message: string,
  options?: ConversationOptions
): AsyncGenerator<string | { type: 'tool_call'; data: any }, void, unknown> {
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
  const toolCalls: any[] = [];
  
  for await (const chunk of stream) {
    // Handle text content
    const content = chunk.content?.toString() || '';
    if (content) {
      fullResponse += content;
      yield content; // Yield text chunks for streaming display
    }
    
    // Handle tool calls (YouTube functions)
    if (chunk.tool_calls && chunk.tool_calls.length > 0) {
      console.log(`[YouTube Tool] Raw tool calls from LLM:`, JSON.stringify(chunk.tool_calls, null, 2));
      for (const toolCall of chunk.tool_calls) {
        toolCalls.push(toolCall);
      }
    }
  }
  
  // Execute any tool calls that were made
  if (toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      try {
        // Log the tool call for debugging
        console.log(`[YouTube Tool] Tool call received:`, {
          name: toolCall.name,
          args: toolCall.args,
          argsType: typeof toolCall.args,
          argsKeys: toolCall.args ? Object.keys(toolCall.args) : [],
        });
        
        // Find the matching tool
        const tool = youtubeTools.find(t => t.name === toolCall.name);
        
        if (tool) {
          // Fallback: If search_youtube is called without query, try to extract from user message
          let toolArgs = toolCall.args;
          if (toolCall.name === 'search_youtube' && (!toolArgs.query || toolArgs.query === '')) {
            console.log(`[YouTube Tool] search_youtube called without query, trying to extract from user message: "${message}"`);
            
            // Try to extract search query from user message
            // Remove common phrases like "search for", "find", "show me", etc.
            let extractedQuery = message.toLowerCase()
              .replace(/^(can you\s+)?search\s+(for\s+)?/i, '')
              .replace(/^(find|show|look for|get|play)\s+(me\s+)?(some\s+)?/i, '')
              .replace(/^(a\s+)?youtube\s+(videos?\s+)?/i, '')
              .replace(/(videos?\s+)?(for|about|on|of)\s+/i, '')
              .replace(/\s+on\s+youtube$/i, '')
              .trim();
            
            if (extractedQuery) {
              console.log(`[YouTube Tool] Extracted query: "${extractedQuery}"`);
              toolArgs = { ...toolArgs, query: extractedQuery };
            } else {
              // If extraction failed, use the original message
              console.log(`[YouTube Tool] Extraction failed, using original message as query`);
              toolArgs = { ...toolArgs, query: message };
            }
          }
          
          // Execute the tool
          const result = await tool.invoke(toolArgs);
          
          // Parse the JSON result
          const parsedResult = JSON.parse(result);
          
          // Yield tool execution result to frontend
          yield {
            type: 'tool_call',
            data: {
              name: toolCall.name,
              args: toolCall.args,
              result: parsedResult,
            },
          };
          
          // Add note about tool execution to response text
          if (parsedResult.success) {
            fullResponse += `\n[Executed: ${toolCall.name}]`;
          }
        }
      } catch (error) {
        console.error(`Failed to execute tool ${toolCall.name}:`, error);
        yield {
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
