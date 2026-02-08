/**
 * Service Managers Index
 * Centralized exports for all service-level managers
 */

// Tool handling
export { handleToolCall, type ToolCall, type ToolCallResult } from './toolCallHandler';

// Wake word management
export { WakeWordManager } from './wakeWordManager';

// Recording management
export { 
  RecordingManager, 
  type RecordingResult, 
  type RecordingManagerCallbacks 
} from './recordingManager';

// LLM streaming management
export {
  LLMStreamManager,
  type LLMStreamOptions,
  type LLMStreamCallbacks,
  type LLMStreamResult
} from './llmStreamManager';

// Conversation management
export {
  ConversationManager,
  type ConversationManagerCallbacks
} from './conversationManager';

// Text sanitization
export {
  sanitizeTextForTTS,
  validateTextForTTS,
  prepareTextForTTS
} from './textSanitizer';
