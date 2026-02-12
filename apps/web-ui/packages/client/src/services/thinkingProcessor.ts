/**
 * Thinking Block Processor
 * Handles extraction and sanitization of <think></think> blocks from LLM responses
 */

export interface ProcessedContent {
  /** Text without thinking blocks (for TTS) */
  speech: string;
  /** Full text with thinking blocks (for display) */
  full: string;
  /** Extracted thinking blocks */
  thinking: string[];
}

/**
 * Extract thinking blocks and separate from speech content
 */
export function processThinkingBlocks(text: string): ProcessedContent {
  const thinkingBlocks: string[] = [];
  
  // Extract all <think>...</think> content
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  let match;
  
  while ((match = thinkRegex.exec(text)) !== null) {
    if (match[1]) {
      thinkingBlocks.push(match[1].trim());
    }
  }
  
  // Remove thinking blocks for speech
  const speechText = text.replace(thinkRegex, '').trim();
  
  return {
    speech: speechText,
    full: text,
    thinking: thinkingBlocks,
  };
}

/**
 * Strip thinking blocks from text (for TTS)
 */
export function stripThinkingBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Check if text contains thinking blocks
 */
export function hasThinkingBlocks(text: string): boolean {
  return /<think>[\s\S]*?<\/think>/i.test(text);
}

/**
 * Extract only thinking blocks without surrounding text
 */
export function extractThinkingBlocks(text: string): string[] {
  const blocks: string[] = [];
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  let match;
  
  while ((match = thinkRegex.exec(text)) !== null) {
    if (match[1]) {
      blocks.push(match[1].trim());
    }
  }
  
  return blocks;
}
