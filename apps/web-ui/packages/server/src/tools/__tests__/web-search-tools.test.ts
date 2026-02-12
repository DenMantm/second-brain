/**
 * Web Search LangChain Tools Tests
 * Uses mocked Wikipedia and DuckDuckGo services to test tool logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  webSearchTool, 
  closeWebSearchTool,
  webSearchTools,
  getLastSearchResults,
  clearLastSearchResults,
} from '../web-search-tools';
import * as wikipediaService from '../../services/wikipedia';
import * as duckDuckGoService from '../../services/duckduckgo';

// Mock the services
vi.mock('../../services/wikipedia');
vi.mock('../../services/duckduckgo');

describe('Web Search LangChain Tools', () => {
  const mockSearchResult = {
    query: 'quantum physics',
    count: 3,
    totalHits: 10624,
    suggestion: undefined,
    results: [
      {
        pageid: 25197,
        title: 'Quantum mechanics',
        snippet: 'Quantum mechanics is a fundamental theory that describes the behavior of nature at and below the scale of atoms.',
        wordcount: 15248,
        timestamp: '2026-02-08T10:30:00Z',
      },
      {
        pageid: 25198,
        title: 'Quantum field theory',
        snippet: 'Quantum field theory is a theoretical framework that combines classical field theory, special relativity, and quantum mechanics.',
        wordcount: 8945,
        timestamp: '2026-02-07T15:22:00Z',
      },
      {
        pageid: 25199,
        title: 'Quantum entanglement',
        snippet: 'Quantum entanglement is a phenomenon that occurs when pairs or groups of particles interact in ways such that the quantum state of each particle cannot be described independently.',
        wordcount: 6234,
        timestamp: '2026-02-06T08:15:00Z',
      },
    ],
  };

  const mockDuckDuckGoResult = {
    query: 'quantum physics',
    count: 2,
    results: [
      {
        title: 'Quantum mechanics - Example',
        url: 'https://example.com/quantum-mechanics',
        snippet: 'An example article about quantum mechanics.',
        displayUrl: 'example.com',
      },
      {
        title: 'Quantum physics overview',
        url: 'https://example.org/quantum-physics',
        snippet: 'Overview of quantum physics from example.org.',
        displayUrl: 'example.org',
      },
    ],
  };

  beforeEach(() => {
    clearLastSearchResults();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('webSearchTool', () => {

    it('should have correct schema definition', () => {
      expect(webSearchTool.name).toBe('web_search');
      expect(webSearchTool.description).toContain('Search the web');
      expect(webSearchTool.schema).toBeDefined();
    });

    it('should search web sources and return formatted results', async () => {
      vi.mocked(wikipediaService.searchWikipedia).mockResolvedValueOnce(mockSearchResult);
      vi.mocked(duckDuckGoService.searchDuckDuckGo).mockResolvedValueOnce(mockDuckDuckGoResult);

      const result = await webSearchTool.invoke({
        query: 'quantum physics',
        max_results: 10,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.query).toBe('quantum physics');
      expect(parsed.count).toBe(5);
      expect(parsed.totalHits).toBe(10624);
      expect(parsed.results).toHaveLength(3);
      expect(parsed.duckduckgoResults).toHaveLength(2);
      expect(parsed.duckduckgoResults[0].tags).toEqual(['duckduckgo']);
      
      // Validate structure of first result
      expect(parsed.results[0]).toMatchObject({
        index: 1,
        title: 'Quantum mechanics',
        snippet: expect.stringContaining('fundamental theory'),
        wordcount: 15248,
        pageid: 25197,
        tags: ['wikipedia'],
      });

      expect(wikipediaService.searchWikipedia).toHaveBeenCalledWith('quantum physics', 5);
      expect(duckDuckGoService.searchDuckDuckGo).toHaveBeenCalledWith('quantum physics', 5);
    });

    it('should include URL in results', async () => {
      vi.mocked(wikipediaService.searchWikipedia).mockResolvedValueOnce(mockSearchResult);
      vi.mocked(duckDuckGoService.searchDuckDuckGo).mockResolvedValueOnce(mockDuckDuckGoResult);
      vi.mocked(wikipediaService.getWikipediaUrl).mockReturnValue('https://en.wikipedia.org/wiki/Quantum_mechanics');

      const result = await webSearchTool.invoke({ query: 'quantum physics' });
      const parsed = JSON.parse(result);

      expect(parsed.results[0].url).toBeDefined();
      expect(wikipediaService.getWikipediaUrl).toHaveBeenCalledWith('Quantum mechanics');
    });

    it('should store results for later reference', async () => {
      vi.mocked(wikipediaService.searchWikipedia).mockResolvedValueOnce(mockSearchResult);
      vi.mocked(duckDuckGoService.searchDuckDuckGo).mockResolvedValueOnce(mockDuckDuckGoResult);

      await webSearchTool.invoke({ query: 'quantum physics', max_results: 10 });

      const lastResults = getLastSearchResults();
      expect(lastResults).toHaveLength(3);
      expect(lastResults[0].pageid).toBe(25197);
      expect(lastResults[1].pageid).toBe(25198);
      expect(lastResults[2].pageid).toBe(25199);
    });

    it('should handle search errors gracefully', async () => {
      vi.mocked(wikipediaService.searchWikipedia).mockRejectedValueOnce(
        new Error('Network error')
      );
      vi.mocked(duckDuckGoService.searchDuckDuckGo).mockResolvedValueOnce(mockDuckDuckGoResult);

      const result = await webSearchTool.invoke({
        query: 'quantum physics',
        max_results: 10,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.warnings).toBeDefined();
      expect(parsed.warnings[0]).toContain('Wikipedia search failed');
      expect(parsed.duckduckgoResults).toHaveLength(2);
    });

    it('should cap max_results at 5', async () => {
      vi.mocked(wikipediaService.searchWikipedia).mockResolvedValueOnce(mockSearchResult);
      vi.mocked(duckDuckGoService.searchDuckDuckGo).mockResolvedValueOnce(mockDuckDuckGoResult);

      await webSearchTool.invoke({ query: 'test' });

      expect(wikipediaService.searchWikipedia).toHaveBeenCalledWith('test', 5);
      expect(duckDuckGoService.searchDuckDuckGo).toHaveBeenCalledWith('test', 5);
    });

    it('should format results with index for LLM', async () => {
      vi.mocked(wikipediaService.searchWikipedia).mockResolvedValueOnce(mockSearchResult);
      vi.mocked(duckDuckGoService.searchDuckDuckGo).mockResolvedValueOnce(mockDuckDuckGoResult);

      const result = await webSearchTool.invoke({ query: 'test', max_results: 10 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.results[0].index).toBe(1);
      expect(parsed.results[1].index).toBe(2);
      expect(parsed.results[2].index).toBe(3);
    });

    it('should include suggestion when Wikipedia suggests better query', async () => {
      const resultWithSuggestion = {
        ...mockSearchResult,
        suggestion: 'quantum field theory',
      };
      
      vi.mocked(wikipediaService.searchWikipedia).mockResolvedValueOnce(resultWithSuggestion);
      vi.mocked(duckDuckGoService.searchDuckDuckGo).mockResolvedValueOnce(mockDuckDuckGoResult);

      const result = await webSearchTool.invoke({ query: 'quantm feild', max_results: 10 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.suggestion).toBe('quantum field theory');
      expect(parsed.message).toContain('Did you mean "quantum field theory"?');
    });
  });

  describe('webSearchTools array', () => {
    it('should export all web search tools', () => {
      expect(webSearchTools).toHaveLength(2);
      expect(webSearchTools[0].name).toBe('web_search');
      expect(webSearchTools[1].name).toBe('close_web_search');
    });

    it('should have valid tool definitions', () => {
      webSearchTools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.func).toBeDefined();
        expect(typeof tool.func).toBe('function');
      });
    });
  });

  describe('closeWebSearchTool', () => {
    it('should have correct schema definition', () => {
      expect(closeWebSearchTool.name).toBe('close_web_search');
      expect(closeWebSearchTool.description).toContain('Close the web search');
      expect(closeWebSearchTool.schema).toBeDefined();
    });

    it('should return success when invoked', async () => {
      const result = await closeWebSearchTool.invoke({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe('close');
      expect(parsed.message).toBe('Closing web search results');
    });
  });

  describe('getLastSearchResults', () => {
    it('should return empty array initially', () => {
      const results = getLastSearchResults();
      expect(results).toEqual([]);
    });

    it('should return last search results after search', async () => {
      vi.mocked(wikipediaService.searchWikipedia).mockResolvedValueOnce(mockSearchResult);
      vi.mocked(duckDuckGoService.searchDuckDuckGo).mockResolvedValueOnce(mockDuckDuckGoResult);

      await webSearchTool.invoke({ query: 'test', max_results: 10 });
      const results = getLastSearchResults();

      expect(results).toHaveLength(3);
      expect(results[0].title).toBe('Quantum mechanics');
    });
  });

  describe('clearLastSearchResults', () => {
    it('should clear stored search results', async () => {
      vi.mocked(wikipediaService.searchWikipedia).mockResolvedValueOnce(mockSearchResult);
      vi.mocked(duckDuckGoService.searchDuckDuckGo).mockResolvedValueOnce(mockDuckDuckGoResult);

      await webSearchTool.invoke({ query: 'test', max_results: 10 });
      expect(getLastSearchResults()).toHaveLength(3);

      clearLastSearchResults();
      expect(getLastSearchResults()).toEqual([]);
    });
  });
});
