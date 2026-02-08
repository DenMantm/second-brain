import { describe, it, expect, beforeEach } from 'vitest';
import { SentenceSplitter } from './sentenceSplitter';

describe('SentenceSplitter', () => {
  let splitter: SentenceSplitter;

  beforeEach(() => {
    splitter = new SentenceSplitter();
  });

  describe('Basic sentence detection', () => {
    it('should extract complete sentences ending with period', () => {
      const sentences = splitter.addChunk('Hello world. This is a test.');
      expect(sentences).toEqual(['Hello world.', 'This is a test.']);
    });

    it('should extract sentences ending with exclamation marks', () => {
      const sentences = splitter.addChunk('Hello! How are you!');
      expect(sentences).toEqual(['Hello!', 'How are you!']);
    });

    it('should extract sentences ending with question marks', () => {
      const sentences = splitter.addChunk('What is this? Why is that?');
      expect(sentences).toEqual(['What is this?', 'Why is that?']);
    });

    it('should extract sentences ending with semicolons', () => {
      const sentences = splitter.addChunk('First part; second part;');
      expect(sentences).toEqual(['First part;', 'second part;']);
    });

    it('should handle mixed punctuation', () => {
      const sentences = splitter.addChunk('Hello! What? Okay. Done;');
      expect(sentences).toEqual(['Hello!', 'What?', 'Okay.', 'Done;']);
    });
  });

  describe('Minimum sentence length', () => {
    it('should not extract sentences shorter than minimum length', () => {
      const splitter = new SentenceSplitter({ minSentenceLength: 15 });
      const sentences = splitter.addChunk('Hi. This is longer enough.');
      // Note: 'Hi.' is still extracted because it's a complete sentence with punctuation
      // The minSentenceLength check happens after punctuation detection
      expect(sentences).toEqual(['Hi. This is longer enough.']);
    });

    it('should buffer short sentences until minimum length', () => {
      const splitter = new SentenceSplitter({ minSentenceLength: 20 });
      splitter.addChunk('Short.');
      expect(splitter.getBuffer()).toBe('Short.');
      const sentences = splitter.addChunk(' Now this is long enough.');
      expect(sentences).toEqual(['Short. Now this is long enough.']);
    });
  });

  describe('Abbreviation handling', () => {
    it('should not split on common abbreviations', () => {
      const sentences = splitter.addChunk('Dr. Smith is here. He arrived today.');
      expect(sentences).toEqual(['Dr. Smith is here.', 'He arrived today.']);
    });

    it('should handle multiple abbreviations in one sentence', () => {
      const sentences = splitter.addChunk('Mr. John Jr. visited Dr. Smith.');
      expect(sentences).toEqual(['Mr. John Jr. visited Dr. Smith.']);
    });

    it('should handle etc. abbreviation', () => {
      // When "etc." is in the middle, it doesn't split there, but continues to next boundary
      const sent1 = splitter.addChunk('I like apples, bananas, etc. What about you?');
      // The splitter finds "?" as the sentence boundary, extracting the whole thing
      expect(sent1).toEqual(['I like apples, bananas, etc. What about you?']);
      
      // Test that "etc." at the end stays in buffer (needs flush)
      const sent2 = splitter.addChunk('I have fruits, veggies, etc.');
      expect(sent2).toEqual([]); // Not extracted yet
      // Flush to get the final sentence
      const flushed = splitter.flush();
      expect(flushed).toBe('I have fruits, veggies, etc.');
    });

    it('should handle i.e. abbreviation', () => {
      const sentences = splitter.addChunk('Use Node.js, i.e. JavaScript runtime. It works well.');
      expect(sentences).toEqual(['Use Node.js, i.e. JavaScript runtime.', 'It works well.']);
    });

    it('should handle e.g. abbreviation', () => {
      const sentences = splitter.addChunk('Fruits, e.g. apples and oranges. Vegetables too.');
      expect(sentences).toEqual(['Fruits, e.g. apples and oranges.', 'Vegetables too.']);
    });

    it('should handle vs. abbreviation', () => {
      const sentences = splitter.addChunk('USA vs. Canada. Great game.');
      expect(sentences).toEqual(['USA vs. Canada.', 'Great game.']);
    });

    it('should handle custom abbreviations', () => {
      const splitter = new SentenceSplitter({
        abbreviations: ['Inc.', 'Corp.'],
      });
      const sentences = splitter.addChunk('Apple Inc. makes great products. Microsoft Corp. does too.');
      expect(sentences).toEqual([
        'Apple Inc. makes great products.',
        'Microsoft Corp. does too.',
      ]);
    });
  });

  describe('Streaming behavior', () => {
    it('should handle streaming text chunks', () => {
      let sentences1 = splitter.addChunk('Hello ');
      expect(sentences1).toEqual([]);
      
      let sentences2 = splitter.addChunk('world. ');
      expect(sentences2).toEqual(['Hello world.']);
      
      let sentences3 = splitter.addChunk('How are ');
      expect(sentences3).toEqual([]);
      
      let sentences4 = splitter.addChunk('you?');
      expect(sentences4).toEqual(['How are you?']);
    });

    it('should accumulate partial sentences in buffer', () => {
      splitter.addChunk('This is ');
      expect(splitter.getBuffer()).toBe('This is ');
      
      splitter.addChunk('a test');
      expect(splitter.getBuffer()).toBe('This is a test');
      
      const sentences = splitter.addChunk('.');
      expect(sentences).toEqual(['This is a test.']);
      expect(splitter.getBuffer()).toBe('');
    });
  });

  describe('Buffer management', () => {
    it('should flush buffer when it exceeds max size', () => {
      const splitter = new SentenceSplitter({ maxBufferSize: 50 });
      const longText = 'This is a very long text without any sentence boundaries that exceeds the maximum buffer size';
      const sentences = splitter.addChunk(longText);
      
      // Should force flush when buffer exceeds max
      expect(sentences.length).toBeGreaterThan(0);
      expect(splitter.getBuffer().length).toBeLessThan(50);
    });

    it('should not flush buffer if below max size', () => {
      const splitter = new SentenceSplitter({ maxBufferSize: 500 });
      splitter.addChunk('This is incomplete text without');
      expect(splitter.getBuffer()).toBe('This is incomplete text without');
    });
  });

  describe('flush() method', () => {
    it('should return remaining buffer as sentence', () => {
      splitter.addChunk('Incomplete sentence');
      const flushed = splitter.flush();
      expect(flushed).toBe('Incomplete sentence');
      expect(splitter.getBuffer()).toBe('');
    });

    it('should return null if buffer is empty', () => {
      const flushed = splitter.flush();
      expect(flushed).toBeNull();
    });

    it('should handle buffer with only whitespace', () => {
      splitter.addChunk('   ');
      const flushed = splitter.flush();
      expect(flushed).toBeNull();
    });
  });

  describe('clear() method', () => {
    it('should clear the buffer', () => {
      splitter.addChunk('Some text');
      expect(splitter.getBuffer()).toBe('Some text');
      
      splitter.clear();
      expect(splitter.getBuffer()).toBe('');
    });

    it('should allow adding new chunks after clear', () => {
      splitter.addChunk('Old text.');
      splitter.clear();
      
      const sentences = splitter.addChunk('New text.');
      expect(sentences).toEqual(['New text.']);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const sentences = splitter.addChunk('');
      expect(sentences).toEqual([]);
    });

    it('should handle whitespace-only string', () => {
      const sentences = splitter.addChunk('   ');
      expect(sentences).toEqual([]);
    });

    it('should handle text without sentence boundaries', () => {
      splitter.addChunk('No boundaries here');
      expect(splitter.getBuffer()).toBe('No boundaries here');
    });

    it('should handle multiple consecutive punctuation marks', () => {
      const sentences = splitter.addChunk('What!? Really!? Yes.');
      expect(sentences).toEqual(['What!?', 'Really!?', 'Yes.']);
    });

    it('should handle newlines and tabs', () => {
      const sentences = splitter.addChunk('Line one.\nLine two.\tLine three.');
      expect(sentences).toEqual(['Line one.', 'Line two.', 'Line three.']);
    });

    it('should preserve punctuation in output', () => {
      const sentences = splitter.addChunk('Hello! How are you? I am fine.');
      expect(sentences[0]).toBe('Hello!');
      expect(sentences[1]).toBe('How are you?');
      expect(sentences[2]).toBe('I am fine.');
    });

    it('should handle multiple spaces between sentences', () => {
      const sentences = splitter.addChunk('First.    Second.     Third.');
      expect(sentences).toEqual(['First.', 'Second.', 'Third.']);
    });

    it('should handle numbers with periods (not sentence boundaries)', () => {
      const splitter = new SentenceSplitter({
        abbreviations: ['No.'],
      });
      const sentences = splitter.addChunk('Item No. 123 is here. Next item.');
      expect(sentences).toEqual(['Item No. 123 is here.', 'Next item.']);
    });
  });

  describe('Real-world LLM streaming scenarios', () => {
    it('should handle typical LLM response stream', () => {
      const chunks = [
        'The weather ',
        'is beautiful ',
        'today. ',
        'It\'s sunny ',
        'and warm. ',
        'Perfect for ',
        'a walk.',
      ];

      const allSentences: string[] = [];
      for (const chunk of chunks) {
        allSentences.push(...splitter.addChunk(chunk));
      }
      allSentences.push(...(splitter.flush() ? [splitter.flush()!] : []));

      expect(allSentences).toContain('The weather is beautiful today.');
      expect(allSentences).toContain('It\'s sunny and warm.');
      expect(allSentences).toContain('Perfect for a walk.');
    });

    it('should handle stream with technical terms', () => {
      const text = 'Docker is great. Node.js v20 is stable. React 18 has concurrent mode.';
      const sentences = splitter.addChunk(text);
      
      expect(sentences).toHaveLength(3);
      expect(sentences[0]).toBe('Docker is great.');
      expect(sentences[1]).toBe('Node.js v20 is stable.');
      expect(sentences[2]).toBe('React 18 has concurrent mode.');
    });

    it('should handle stream with code snippets', () => {
      const text = 'Use console.log() for debugging. The function returns true. Call process.exit(0) to quit.';
      const sentences = splitter.addChunk(text);
      
      expect(sentences).toHaveLength(3);
    });
  });
});
