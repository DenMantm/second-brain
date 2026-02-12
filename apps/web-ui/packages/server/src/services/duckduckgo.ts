/**
 * DuckDuckGo Service - Scrape DuckDuckGo HTML results
 */

import axios from 'axios';

export interface DuckDuckGoResult {
  title: string;
  url: string;
  snippet: string;
  displayUrl?: string;
}

export interface DuckDuckGoSearchResponse {
  query: string;
  results: DuckDuckGoResult[];
  count: number;
}

const DUCKDUCKGO_SEARCH_URL = 'https://duckduckgo.com/html/';

/**
 * Search DuckDuckGo HTML results
 */
export async function searchDuckDuckGo(
  query: string,
  maxResults: number = 10
): Promise<DuckDuckGoSearchResponse> {
  try {
    const response = await axios.get(DUCKDUCKGO_SEARCH_URL, {
      params: {
        q: query,
      },
      headers: {
        'User-Agent': 'SecondBrainAssistant/1.0 (Educational Project)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    if (response.status !== 200) {
      throw new Error(`DuckDuckGo returned status ${response.status}`);
    }

    const results = parseDuckDuckGoHtml(response.data, maxResults);

    return {
      query,
      results,
      count: results.length,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`DuckDuckGo request failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Parse DuckDuckGo HTML results into structured data
 */
export function parseDuckDuckGoHtml(html: string, maxResults: number = 10): DuckDuckGoResult[] {
  const results: DuckDuckGoResult[] = [];
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="result__snippet"[^>]*>|<div[^>]*class="result__snippet"[^>]*>)([\s\S]*?)<\/(?:a|div)>/g;

  let match: RegExpExecArray | null = null;
  while ((match = resultRegex.exec(html)) !== null) {
    if (results.length >= maxResults) {
      break;
    }

    const rawUrl = match[1] || '';
    const rawTitle = match[2] || '';
    const rawSnippet = match[3] || '';

    const url = normalizeDuckDuckGoUrl(rawUrl);
    const title = decodeHtmlEntities(stripHtmlTags(rawTitle));
    const snippet = decodeHtmlEntities(stripHtmlTags(rawSnippet));

    if (!title || !url) {
      continue;
    }

    results.push({
      title,
      url,
      snippet,
      displayUrl: getDisplayUrl(url),
    });
  }

  return results;
}

function normalizeDuckDuckGoUrl(url: string): string {
  if (!url) {
    return url;
  }

  try {
    if (url.startsWith('/l/?')) {
      const parsed = new URL(`https://duckduckgo.com${url}`);
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) {
        return decodeURIComponent(uddg);
      }
    }
  } catch {
    // ignore parsing errors, return raw url
  }

  return url;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
