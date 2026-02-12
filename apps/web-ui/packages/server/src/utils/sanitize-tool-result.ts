/**
 * Sanitize Tool Results for LLM Context
 * Reduces token usage by removing URLs and truncating content
 */

/**
 * Truncate text to maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Sanitize a single search result
 */
function sanitizeSearchResult(result: any, index: number): any {
  return {
    index: index + 1, // Add 1-based index for easy reference
    title: result.title || '',
    snippet: truncateText(result.snippet || '', 150), // Max 150 chars per snippet
    // Omit: url, pageid, wordcount, displayUrl, tags
  };
}

/**
 * Sanitize tool result for LLM context to reduce token usage
 * Removes URLs, truncates snippets, keeps only essential data
 */
export function sanitizeToolResult(toolName: string, result: any): string {
  if (!result || typeof result !== 'object') {
    return JSON.stringify(result);
  }

  // Handle web_search results
  if (toolName === 'web_search' && result.success) {
    const sanitized: any = {
      success: true,
      query: result.query,
      count: result.count || 0,
    };

    // Sanitize Wikipedia results (max 3 results)
    if (result.results && Array.isArray(result.results)) {
      sanitized.results = result.results
        .slice(0, 3) // Only include top 3 Wikipedia results
        .map((item, idx) => sanitizeSearchResult(item, idx));
    }

    // Sanitize DuckDuckGo results (max 2 results)
    if (result.duckduckgoResults && Array.isArray(result.duckduckgoResults)) {
      sanitized.duckduckgo = result.duckduckgoResults
        .slice(0, 2) // Only include top 2 DuckDuckGo results
        .map((item, idx) => sanitizeSearchResult(item, idx));
    }

    // Include suggestion if present
    if (result.suggestion) {
      sanitized.suggestion = result.suggestion;
    }

    return JSON.stringify(sanitized);
  }

  // Handle search_youtube results
  if (toolName === 'search_youtube' && result.success) {
    const sanitized: any = {
      success: true,
      query: result.query,
      count: result.count || 0,
    };

    // Sanitize video results (max 5 results with index numbers)
    if (result.videos && Array.isArray(result.videos)) {
      sanitized.videos = result.videos
        .slice(0, 5) // Keep 5 videos (same as original)
        .map((video: any, idx: number) => ({
          index: idx + 1, // Add 1-based index for easy reference
          videoId: video.videoId || '', // Keep videoId for playing
          title: video.title || '',
          channel: video.channelTitle || '',
          // Omit: thumbnailUrl, url, description, duration, publishedAt
        }));
    }

    return JSON.stringify(sanitized);
  }

  // Handle play_youtube_video (minimal info)
  if (toolName === 'play_youtube_video' && result.success) {
    return JSON.stringify({
      success: true,
      message: result.message || 'Playing video',
    });
  }

  // Handle control_youtube_player (minimal info)
  if (toolName === 'control_youtube_player' && result.success) {
    return JSON.stringify({
      success: true,
      action: result.action,
    });
  }

  // Handle close tools (very minimal)
  if ((toolName === 'close_youtube' || toolName === 'close_web_search') && result.success) {
    return JSON.stringify({
      success: true,
    });
  }

  // Default: return compact JSON
  return JSON.stringify(result);
}
