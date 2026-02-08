/**
 * Text Sanitization Utilities
 * Clean text before sending to TTS to improve audio quality
 */

/**
 * Remove markdown formatting and unwanted characters from text
 * to improve TTS audio quality
 */
export function sanitizeTextForTTS(text: string): string {
  if (!text) return text;
  
  let sanitized = text;
  
  // Remove markdown bold (**text** or __text__)
  sanitized = sanitized.replace(/\*\*(.+?)\*\*/g, '$1');
  sanitized = sanitized.replace(/__(.+?)__/g, '$1');
  
  // Remove markdown italic (*text* or _text_)
  sanitized = sanitized.replace(/\*(.+?)\*/g, '$1');
  sanitized = sanitized.replace(/_(.+?)_/g, '$1');
  
  // Remove markdown code blocks (```code``` or `code`)
  sanitized = sanitized.replace(/```[\s\S]*?```/g, 'code block');
  sanitized = sanitized.replace(/`(.+?)`/g, '$1');
  
  // Remove markdown links but keep the text [text](url) -> text
  sanitized = sanitized.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove markdown headings (# Header)
  sanitized = sanitized.replace(/^#{1,6}\s+/gm, '');
  
  // Remove markdown strikethrough (~~text~~)
  sanitized = sanitized.replace(/~~(.+?)~~/g, '$1');
  
  // Remove markdown horizontal rules (---, ___, ***)
  sanitized = sanitized.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '');
  
  // Remove HTML tags (in case LLM outputs any)
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove bullet points (-, *, +) at start of lines - BEFORE whitespace normalization
  sanitized = sanitized.replace(/^[\s]*[-*+]\s+/gm, '');
  
  // Remove numbered lists (1. 2. 3.) - BEFORE whitespace normalization
  sanitized = sanitized.replace(/^\s*\d+\.\s+/gm, '');
  
  // Remove excessive whitespace and normalize
  sanitized = sanitized.replace(/\s+/g, ' ');
  sanitized = sanitized.trim();
  
  // Log if we made changes (helpful for debugging)
  if (sanitized !== text) {
    console.log('🧹 Sanitized text for TTS:', {
      original: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      sanitized: sanitized.substring(0, 100) + (sanitized.length > 100 ? '...' : '')
    });
  }
  
  return sanitized;
}

/**
 * Validate that text is safe and suitable for TTS
 */
export function validateTextForTTS(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }
  
  // Check if text is too short
  if (text.trim().length < 2) {
    return false;
  }
  
  // Check if text is suspiciously long (might be an error)
  if (text.length > 5000) {
    console.warn('⚠️ Text too long for TTS:', text.length, 'characters');
    return false;
  }
  
  return true;
}

/**
 * Prepare text for TTS: sanitize and validate
 */
export function prepareTextForTTS(text: string): string | null {
  const sanitized = sanitizeTextForTTS(text);
  
  if (!validateTextForTTS(sanitized)) {
    console.warn('⚠️ Text failed validation:', text);
    return null;
  }
  
  return sanitized;
}
