/**
 * Sentence Splitter - Extracts complete sentences from streaming text
 */

export interface SentenceSplitterOptions {
  minSentenceLength?: number;
  maxBufferSize?: number;
  abbreviations?: string[];
}

export class SentenceSplitter {
  private buffer: string = '';
  private minSentenceLength: number;
  private maxBufferSize: number;
  private abbreviations: Set<string>;
  
  // Regex for sentence boundaries (matches punctuation followed by space OR end of string)
  private boundaryRegex = /([.!?;])(\s+|$)/g;
  
  constructor(options: SentenceSplitterOptions = {}) {
    this.minSentenceLength = options.minSentenceLength ?? 3;  // Allow very short sentences
    this.maxBufferSize = options.maxBufferSize ?? 500;
    
    // Common abbreviations to ignore
    const defaultAbbreviations = [
      'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.', 'Sr.', 'Jr.',
      'etc.', 'i.e.', 'e.g.', 'vs.', 'Inc.', 'Ltd.', 'Co.',
      'St.', 'Ave.', 'Blvd.', 'Rd.', 'U.S.', 'U.K.'
    ];
    
    this.abbreviations = new Set(options.abbreviations ?? defaultAbbreviations);
  }
  
  /**
   * Add text chunk and extract complete sentences
   */
  addChunk(text: string): string[] {
    this.buffer += text;
    const sentences: string[] = [];
    
    while (this.buffer.length >= this.minSentenceLength) {
      const sentence = this.extractSentence();
      
      if (sentence) {
        sentences.push(sentence);
      } else if (this.buffer.length > this.maxBufferSize) {
        // Force flush if buffer too large
        const flushed = this.buffer.trim();
        if (flushed) {
          sentences.push(flushed);
        }
        this.buffer = '';
        break;
      } else {
        // Wait for more text
        break;
      }
    }
    
    return sentences;
  }
  
  /**
   * Flush remaining buffer and return as final sentence
   */
  flush(): string | null {
    const trimmed = this.buffer.trim();
    this.buffer = '';
    
    return trimmed.length > 0 ? trimmed : null;
  }
  
  /**
   * Clear buffer without returning content
   */
  clear(): void {
    this.buffer = '';
  }
  
  /**
   * Get current buffer content (for debugging)
   */
  getBuffer(): string {
    return this.buffer;
  }
  
  /**
   * Extract one complete sentence from buffer
   */
  private extractSentence(): string | null {
    this.boundaryRegex.lastIndex = 0; // Reset regex
    
    const matches = Array.from(this.buffer.matchAll(this.boundaryRegex));
    
    for (const match of matches) {
      const index = match.index!;
      const endIndex = index + match[0].length;
      
      // Extract potential sentence
      const potentialSentence = this.buffer.substring(0, endIndex).trim();
      
      // Check if it ends with an abbreviation
      if (this.endsWithAbbreviation(potentialSentence)) {
        continue;
      }
      
      // Check if it's long enough
      if (potentialSentence.length < this.minSentenceLength) {
        continue;
      }
      
      // Valid sentence found
      this.buffer = this.buffer.substring(endIndex);
      return potentialSentence;
    }
    
    return null;
  }
  
  /**
   * Check if text ends with a known abbreviation
   */
  private endsWithAbbreviation(text: string): boolean {
    for (const abbr of this.abbreviations) {
      if (text.endsWith(abbr)) {
        return true;
      }
    }
    return false;
  }
}
