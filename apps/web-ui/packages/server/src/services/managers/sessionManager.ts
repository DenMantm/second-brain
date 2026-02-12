/**
 * Session Manager
 * Manages conversation sessions and their associated data
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatMessageHistory } from '@langchain/community/stores/message/in_memory';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import type { AIMessageChunk } from '@langchain/core/messages';
import { config } from '../../config';
import { youtubeTools } from '../../tools/youtube-tools';
import { webSearchTools } from '../../tools/web-search-tools';
import { PromptManager } from './promptManager';
import { logger } from '../../utils/logger';

// Combine all tools
const allTools = [...youtubeTools, ...webSearchTools];

export interface SessionData {
  history: ChatMessageHistory;
  llm: ChatOpenAI | Runnable<BaseLanguageModelInput, AIMessageChunk>;
}

export interface SessionOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  model?: string;
}

export class SessionManager {
  private sessions = new Map<string, SessionData>();
  private promptManager = new PromptManager();
  private readonly maxMessagesInContext = 10; // Keep only last 10 messages (+ system prompt)

  /**
   * Get or create a session with message history
   */
  getSession(sessionId: string, options?: SessionOptions): SessionData {
    // Return existing session if it exists
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // Create new session
    const sessionData = this.createSession(options);
    this.sessions.set(sessionId, sessionData);
    return sessionData;
  }

  /**
   * Create a new session with LLM and history
   */
  private createSession(options?: SessionOptions): SessionData {
    logger.separator('CREATING NEW SESSION');
    logger.dev('Options:', options);
    
    // Create base LLM instance
    const modelName = options?.model || 'openai/gpt-oss-20b';
    const baseLlm = new ChatOpenAI({
      apiKey: 'sk-dummy-key-for-local-llm', // LM Studio doesn't validate API key
      modelName: modelName,
      temperature: options?.temperature ?? 0.2,
      maxTokens: options?.maxTokens ?? 2048,
      configuration: {
        baseURL: config.llmServiceUrl,
      },
    });
    
    logger.dev('Base LLM created:', {
      model: modelName,
      temperature: options?.temperature ?? 0.2,
      maxTokens: options?.maxTokens ?? 2048,
      baseURL: config.llmServiceUrl
    });

    // Bind tools (YouTube + Wikipedia) to LLM for function calling
    // Note: bindTools returns a Runnable, not ChatOpenAI
    logger.dev('Binding tools to LLM...');
    logger.dev('Available tools:', allTools.map(t => t.name));
    const llm = baseLlm.bindTools(allTools) as unknown as SessionData['llm'];
    logger.dev('Tools bound successfully. Total tools:', allTools.length);

    const history = new ChatMessageHistory();
    
    // Add system prompt
    const systemPrompt = this.promptManager.getSystemPrompt({ 
      customPrompt: options?.systemPrompt 
    });
    history.addMessage(new SystemMessage(systemPrompt));
    logger.dev('System prompt added to history');
    logger.separator();
    
    return { history, llm };
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Clear conversation history for a session
   */
  async clearSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.history.clear();
    }
  }

  /**
   * Delete a session completely
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Add a message to session history
   */
  async addMessage(sessionId: string, message: HumanMessage | AIMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.history.addMessage(message);
    }
  }

  /**
   * Get all messages from session history
   * Trims to keep only recent messages within context limit
   */
  async getMessages(sessionId: string): Promise<any[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    
    const allMessages = await session.history.getMessages();
    
    // Always keep system prompt (first message) + last N messages
    if (allMessages.length <= this.maxMessagesInContext + 1) {
      return allMessages;
    }
    
    // Keep: [SystemMessage, ...last N messages]
    const systemPrompt = allMessages[0];
    const recentMessages = allMessages.slice(-this.maxMessagesInContext);
    
    logger.dev(`Context trimmed: ${allMessages.length} → ${recentMessages.length + 1} messages (keeping system prompt + last ${this.maxMessagesInContext})`);
    
    return [systemPrompt, ...recentMessages];
  }

  /**
   * Restore messages to a session from storage
   */
  async restoreMessages(sessionId: string, messages: Array<{ role: string; content: string }>): Promise<void> {
    const session = this.getSession(sessionId);
    
    // Clear existing history
    await session.history.clear();
    
    // Restore messages
    for (const msg of messages) {
      if (msg.role === 'user') {
        await session.history.addMessage(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        await session.history.addMessage(new AIMessage(msg.content));
      }
    }
  }

  /**
   * Get the prompt manager instance
   */
  getPromptManager(): PromptManager {
    return this.promptManager;
  }
}
