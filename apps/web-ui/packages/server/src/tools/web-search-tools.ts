/**
 * LangChain Tools for Web Search
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchWikipedia, getWikipediaUrl, type WikipediaArticle } from '../services/wikipedia';
import { searchDuckDuckGo, type DuckDuckGoResult } from '../services/duckduckgo';
import type { ToolDocumentation } from '../types/tool-documentation';

// Store last search results in memory for reference
let lastSearchResults: WikipediaArticle[] = [];

/**
 * Web Search Tools Documentation for System Prompt
 */
export const webSearchToolsDocumentation: ToolDocumentation = {
  category: 'WEB SEARCH CAPABILITIES',
  description: 'You can search the web for information and facts using this tool (results come from Wikipedia and DuckDuckGo):',
  tools: [
    { name: 'web_search', usage: 'Search the web for topics (e.g., "search the web for quantum physics", "web search funny animals", "look up Napoleon Bonaparte", "find information about artificial intelligence")' },
    { name: 'close_web_search', usage: 'Close the web search results window (e.g., "close web search", "close search results", "hide search results")' },
  ],
  validExamples: [
    '"Search the web for quantum physics"',
    '"Web search funny animals"',
    '"Look up Napoleon Bonaparte"',
    '"Find information about artificial intelligence"',
    '"What does the web say about climate change"',
  ],
  instructions: [
    'When user asks to search the web:',
    '1. Use web_search with their query - ALWAYS include the query parameter',
    '2. REQUIRED format: {"query": "topic to search"} - NEVER send empty parameters!',
    '3. After getting results, summarize the most relevant article naturally',
    '4. Speak key facts from the snippet in a conversational way',
    '5. If a better search term is suggested, mention it: "Did you mean [suggestion]?"',
    '',
    'CRITICAL: The web_search tool REQUIRES a query parameter:',
    '- Correct: {"name":"web_search","args":{"query":"quantum physics"}}',
    '- Correct: {"name":"web_search","args":{"query":"artificial intelligence"}}',
    '- WRONG: {"name":"web_search","args":{}} - NEVER send empty parameters!',
    '- WRONG: {"name":"web_search","args":{"max_results":10}} - Missing required query!',
    '',
    'IMPORTANT: Recognize these patterns as web search requests:',
    '- "search the web for X"',
    '- "web search X"',
    '- "look up X"',
    '- "find information about X"',
    '- "what does the web say about X"',
    '- Any mention of searching or looking up facts or knowledge',
    '',
    'When presenting results, speak naturally and cite the source (Wikipedia or DuckDuckGo):',
    '- "I found an article about quantum physics on Wikipedia. It describes..."',
    '- "According to Wikipedia, Napoleon Bonaparte was born in 1769 and..."',
    '- "DuckDuckGo also shows a result from example.com about..."',
    '- Summarize the snippet without reading it word-for-word',
    '- Extract the most interesting facts and speak them naturally',
    '',
    'When user asks to close, hide, or dismiss search results:',
    '- Use close_web_search tool',
    '- Confirm closure: "I\'ve closed the search results"',
  ],
};

// Define search schema
const webSearchSchema = z.object({
  query: z.string().min(1).describe('REQUIRED: The search query string (e.g., "quantum physics", "napoleonic wars", "artificial intelligence"). You MUST provide this parameter. Do NOT call this tool with empty parameters. Example: {"query": "quantum physics"}'),
  max_results: z.number().optional().default(10).describe('Maximum number of results to return (default: 10, max: 20)'),
});

/**
 * Search the web for articles and information
 */
// @ts-ignore - Deep type instantiation with Zod/LangChain
export const webSearchTool = new DynamicStructuredTool({
  name: 'web_search',
  description: 'Search the web for articles and information (Wikipedia and DuckDuckGo). CRITICAL: You MUST include the "query" parameter with the search term. Required format: {"query": "topic to search"}. Use this when user asks to search, look up facts, or find information. NEVER call this with empty parameters.',
  schema: webSearchSchema,
  func: async ({ query, max_results = 10 }) => {
    // Validate query parameter
    if (!query || query.trim() === '') {
      return JSON.stringify({
        success: false,
        error: 'ERROR: The "query" parameter is REQUIRED and cannot be empty. You must provide a search term. Example: {"query": "quantum physics"}. Do not call web_search with empty parameters.',
      });
    }
    
    try {
      const cappedMaxResults = Math.min(Math.max(1, max_results), 5);
      const [wikipediaResult, duckDuckGoResult] = await Promise.allSettled([
        searchWikipedia(query, cappedMaxResults),
        searchDuckDuckGo(query, cappedMaxResults),
      ]);

      const warnings: string[] = [];

      const wikipediaResponse = wikipediaResult.status === 'fulfilled'
        ? wikipediaResult.value
        : null;
      if (!wikipediaResponse && wikipediaResult.status === 'rejected') {
        warnings.push(`Wikipedia search failed: ${wikipediaResult.reason instanceof Error ? wikipediaResult.reason.message : 'Unknown error'}`);
      }

      const duckDuckGoResponse = duckDuckGoResult.status === 'fulfilled'
        ? duckDuckGoResult.value
        : null;
      if (!duckDuckGoResponse && duckDuckGoResult.status === 'rejected') {
        warnings.push(`DuckDuckGo search failed: ${duckDuckGoResult.reason instanceof Error ? duckDuckGoResult.reason.message : 'Unknown error'}`);
      }

      if (!wikipediaResponse && !duckDuckGoResponse) {
        return JSON.stringify({
          success: false,
          error: `Failed to search the web: ${warnings.join(' | ')}`,
        });
      }

      // Store Wikipedia results for later reference
      lastSearchResults = wikipediaResponse?.results ?? [];

      // Format Wikipedia results for LLM in a natural way
      const formattedWikipediaResults = (wikipediaResponse?.results ?? []).map((article, idx) => ({
        index: idx + 1,
        title: article.title,
        snippet: article.snippet,
        wordcount: article.wordcount,
        url: getWikipediaUrl(article.title),
        pageid: article.pageid,
        tags: ['wikipedia'],
      }));

      const formattedDuckDuckGoResults = (duckDuckGoResponse?.results ?? []).map((result, idx) => ({
        index: idx + 1,
        title: result.title,
        snippet: result.snippet,
        url: result.url,
        displayUrl: result.displayUrl,
        tags: ['duckduckgo'],
      }));

      const wikiCount = wikipediaResponse?.count ?? 0;
      const ddgCount = duckDuckGoResponse?.count ?? 0;

      const resultMessage: any = {
        success: true,
        query,
        count: wikiCount + ddgCount,
        totalHits: wikipediaResponse?.totalHits ?? wikiCount,
        results: formattedWikipediaResults,
        duckduckgoResults: formattedDuckDuckGoResults,
        message: `Found ${wikiCount} Wikipedia results and ${ddgCount} DuckDuckGo results for "${query}"`,
      };

      if (warnings.length > 0) {
        resultMessage.warnings = warnings;
      }

      // Include suggestion if Wikipedia suggests a better query
      if (wikipediaResponse?.suggestion) {
        resultMessage.suggestion = wikipediaResponse.suggestion;
        resultMessage.message += `. Did you mean "${wikipediaResponse.suggestion}"?`;
      }

      return JSON.stringify(resultMessage, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to search the web: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
});

// Define close web search schema (no parameters needed)
const closeWebSearchSchema = z.object({});

/**
 * Close the web search results modal/window
 */
// @ts-ignore - Deep type instantiation with Zod/LangChain
export const closeWebSearchTool = new DynamicStructuredTool({
  name: 'close_web_search',
  description: 'Close the web search results window/modal. Use this when the user asks to close, hide, or dismiss the search results.',
  schema: closeWebSearchSchema,
  func: async () => {
    return JSON.stringify({
      success: true,
      action: 'close',
      message: 'Closing web search results',
    });
  },
});

/**
 * Get last search results (for potential future use)
 */
export function getLastSearchResults(): WikipediaArticle[] {
  return lastSearchResults;
}

/**
 * Clear last search results (for testing)
 */
export function clearLastSearchResults(): void {
  lastSearchResults = [];
}

/**
 * Export all web search tools
 */
export const webSearchTools = [webSearchTool, closeWebSearchTool];
