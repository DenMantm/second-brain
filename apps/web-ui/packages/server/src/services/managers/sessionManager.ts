/**
 * Session Manager
 * Manages conversation sessions and their associated data
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatMessageHistory } from '@langchain/community/stores/message/in_memory';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { config } from '../../config';
import { youtubeTools } from '../../tools/youtube-tools';
import { PromptManager } from './promptManager';

export interface SessionData {
  history: ChatMessageHistory;
  llm: ChatOpenAI;
}

export interface SessionOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export class SessionManager {
  private sessions = new Map<string, SessionData>();
  private promptManager = new PromptManager();

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
    // Create base LLM instance
    const baseLlm = new ChatOpenAI({
      apiKey: 'sk-dummy-key-for-local-llm', // LM Studio doesn't validate API key
      modelName: 'openai/gpt-oss-20b', // GPT OSS 20B model
      temperature: options?.temperature ?? 0.2,
      maxTokens: options?.maxTokens ?? 2048,
      configuration: {
        baseURL: config.llmServiceUrl,
      },
    });

    // Bind YouTube tools to LLM for function calling
    const llm = baseLlm.bindTools(youtubeTools);

    const history = new ChatMessageHistory();
    
    // Add system prompt
    const systemPrompt = this.promptManager.getSystemPrompt({ 
      customPrompt: options?.systemPrompt 
    });
    history.addMessage(new SystemMessage(systemPrompt));
    
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
   */
  async getMessages(sessionId: string): Promise<any[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return await session.history.getMessages();
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
