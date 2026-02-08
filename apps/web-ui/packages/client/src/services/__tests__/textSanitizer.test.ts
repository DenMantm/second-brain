/**
 * Text Sanitization Tests
 */
import { describe, it, expect } from 'vitest';
import { sanitizeTextForTTS, validateTextForTTS, prepareTextForTTS } from '../textSanitizer';

describe('textSanitizer', () => {
  describe('sanitizeTextForTTS', () => {
    it('should remove bold markdown (**text**)', () => {
      expect(sanitizeTextForTTS('This is **bold** text')).toBe('This is bold text');
      expect(sanitizeTextForTTS('**Hades** is a game')).toBe('Hades is a game');
    });
    
    it('should remove bold markdown (__text__)', () => {
      expect(sanitizeTextForTTS('This is __bold__ text')).toBe('This is bold text');
    });
    
    it('should remove italic markdown (*text*)', () => {
      expect(sanitizeTextForTTS('This is *italic* text')).toBe('This is italic text');
    });
    
    it('should remove italic markdown (_text_)', () => {
      expect(sanitizeTextForTTS('This is _italic_ text')).toBe('This is italic text');
    });
    
    it('should remove inline code (`code`)', () => {
      expect(sanitizeTextForTTS('Use the `console.log` function')).toBe('Use the console.log function');
    });
    
    it('should replace code blocks with placeholder', () => {
      expect(sanitizeTextForTTS('Here is code:\n```js\nconsole.log("hi")\n```')).toBe('Here is code: code block');
    });
    
    it('should remove markdown links but keep text', () => {
      expect(sanitizeTextForTTS('Visit [Google](https://google.com)')).toBe('Visit Google');
    });
    
    it('should remove headings', () => {
      expect(sanitizeTextForTTS('# Title\n## Subtitle')).toBe('Title Subtitle');
    });
    
    it('should remove strikethrough', () => {
      expect(sanitizeTextForTTS('This is ~~wrong~~ correct')).toBe('This is wrong correct');
    });
    
    it('should remove HTML tags', () => {
      expect(sanitizeTextForTTS('This is <strong>bold</strong>')).toBe('This is bold');
    });
    
    it('should remove bullet points', () => {
      expect(sanitizeTextForTTS('- Item 1\n* Item 2\n+ Item 3')).toBe('Item 1 Item 2 Item 3');
    });
    
    it('should remove numbered lists', () => {
      expect(sanitizeTextForTTS('1. First\n2. Second\n3. Third')).toBe('First Second Third');
    });
    
    it('should normalize whitespace', () => {
      expect(sanitizeTextForTTS('Text   with    extra     spaces')).toBe('Text with extra spaces');
    });
    
    it('should handle mixed markdown', () => {
      const input = '**Bold** and *italic* and `code` and [link](url)';
      const expected = 'Bold and italic and code and link';
      expect(sanitizeTextForTTS(input)).toBe(expected);
    });
    
    it('should return empty string for empty input', () => {
      expect(sanitizeTextForTTS('')).toBe('');
    });
    
    it('should handle text with no markdown', () => {
      const plain = 'This is plain text';
      expect(sanitizeTextForTTS(plain)).toBe(plain);
    });
  });
  
  describe('validateTextForTTS', () => {
    it('should accept valid text', () => {
      expect(validateTextForTTS('Hello world')).toBe(true);
    });
    
    it('should reject empty text', () => {
      expect(validateTextForTTS('')).toBe(false);
      expect(validateTextForTTS('   ')).toBe(false);
    });
    
    it('should reject very short text', () => {
      expect(validateTextForTTS('a')).toBe(false);
    });
    
    it('should reject very long text', () => {
      const longText = 'a'.repeat(6000);
      expect(validateTextForTTS(longText)).toBe(false);
    });
    
    it('should accept reasonable length text', () => {
      const text = 'This is a reasonable sentence for TTS.';
      expect(validateTextForTTS(text)).toBe(true);
    });
  });
  
  describe('prepareTextForTTS', () => {
    it('should sanitize and validate valid text', () => {
      const result = prepareTextForTTS('This is **bold** text');
      expect(result).toBe('This is bold text');
    });
    
    it('should return null for invalid text', () => {
      expect(prepareTextForTTS('')).toBe(null);
      expect(prepareTextForTTS('a')).toBe(null);
    });
    
    it('should handle complex markdown', () => {
      const input = '# Title\n\n**Bold** text with *italic* and `code`.\n\n- Item 1\n- Item 2';
      const result = prepareTextForTTS(input);
      expect(result).toBe('Title Bold text with italic and code. Item 1 Item 2');
    });
  });
});
