/**
 * Wikipedia Service - Search Wikipedia articles using the MediaWiki API
 */

import axios from 'axios';

export interface WikipediaArticle {
  pageid: number;
  title: string;
  snippet: string;
  wordcount: number;
  timestamp: string;
}

export interface WikipediaSearchResponse {
  query: string;
  results: WikipediaArticle[];
  count: number;
  totalHits: number;
  suggestion?: string;
}

/**
 * Search Wikipedia articles using the MediaWiki API
 * @param query - Search query string
 * @param maxResults - Maximum number of results (default: 10, max: 20)
 * @returns Search results with article metadata
 */
export async function searchWikipedia(
  query: string,
  maxResults: number = 10
): Promise<WikipediaSearchResponse> {
  try {
    const apiUrl = 'https://en.wikipedia.org/w/api.php';
    
    const params = {
      action: 'query',
      list: 'search',
      srsearch: query,
      format: 'json',
      srlimit: Math.min(maxResults, 20), // Wikipedia API max is 20
      srprop: 'snippet|wordcount|timestamp',
    };
    
    const response = await axios.get(apiUrl, {
      params,
      headers: {
        'User-Agent': 'SecondBrainAssistant/1.0 (Educational Project)',
      },
      timeout: 10000,
    });
    
    if (response.status !== 200) {
      throw new Error(`Wikipedia API returned status ${response.status}`);
    }
    
    const data = response.data;
    
    if (!data.query || !data.query.search) {
      throw new Error('Invalid response from Wikipedia API');
    }
    
    // Extract search results
    const articles: WikipediaArticle[] = data.query.search.map((article: any) => ({
      pageid: article.pageid,
      title: article.title,
      snippet: stripHtmlTags(article.snippet),
      wordcount: article.wordcount,
      timestamp: article.timestamp,
    }));
    
    return {
      query,
      results: articles,
      count: articles.length,
      totalHits: data.query.searchinfo?.totalhits || articles.length,
      suggestion: data.query.searchinfo?.suggestion,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Wikipedia API request failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Strip HTML tags from Wikipedia snippet
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<span class="searchmatch">/g, '"')
    .replace(/<\/span>/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/<[^>]+>/g, '');
}

/**
 * Get Wikipedia article URL from title
 */
export function getWikipediaUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}
