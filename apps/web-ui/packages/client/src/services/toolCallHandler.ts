/**
 * Tool Call Handler Service
 * Handles execution and UI integration of LLM tool calls
 */

import { useYouTubeStore, type YouTubeSearchResult } from '../stores/youtubeStore';
import { useWebSearchStore, type SearchResult, type DuckDuckGoResult } from '../stores/webSearchStore';

/**
 * Tool call data structure from LLM
 */
export interface ToolCall {
  name: string;
  args?: Record<string, any>;
  result?: any;
}

/**
 * Result of handling a tool call
 */
export interface ToolCallResult {
  systemMessage: string;  // Message for conversation history
  speechMessage: string;  // Message to synthesize via TTS (may be empty for silent tools)
}

/**
 * Parse tool result from string or object
 */
function parseToolResult(toolResult: any): any {
  if (typeof toolResult === 'string') {
    try {
      return JSON.parse(toolResult);
    } catch {
      return { success: false, error: 'Invalid tool response' };
    }
  }
  return toolResult;
}

/**
 * Handle YouTube search tool call
 */
function handleYouTubeSearch(result: any, args?: Record<string, any>): void {
  if (!result?.success || !result.results) return;
  
  const youtubeStore = useYouTubeStore.getState();
  const searchResults: YouTubeSearchResult[] = result.results.map((video: any) => ({
    videoId: video.videoId || '',
    title: video.title || '',
    channelTitle: video.channel || '',
    thumbnailUrl: video.thumbnail || '',
    viewCount: video.views,
    duration: video.duration,
  }));
  
  const query = result.query || args?.query || 'YouTube';
  youtubeStore.showSearch(query, searchResults);
}

/**
 * Handle YouTube video playback tool call
 */
function handlePlayYouTubeVideo(result: any): void {
  if (!result?.success || !result.videoId) return;
  
  const youtubeStore = useYouTubeStore.getState();
  youtubeStore.playVideo(result.videoId);
}

/**
 * Handle YouTube player control tool call
 */
function handleControlYouTubePlayer(result: any, args?: Record<string, any>): void {
  if (!result?.success) return;
  
  const youtubeStore = useYouTubeStore.getState();
  const action = args?.action;
  const value = args?.value;
  const player = youtubeStore.player;
  
  if (!player) return;
  
  switch (action) {
    case 'play':
      player.playVideo();
      break;
    case 'pause':
      player.pauseVideo();
      break;
    case 'volume':
      if (typeof value === 'number') {
        youtubeStore.setVolume(value);
      }
      break;
    case 'seek':
      if (typeof value === 'number') {
        player.seekTo(value, true);
      }
      break;
  }
}

/**
 * Handle closing YouTube modal
 */
function handleCloseYouTube(result: any): void {
  if (!result?.success) return;
  
  const youtubeStore = useYouTubeStore.getState();
  youtubeStore.hide();
}

/**
 * Handle closing Web Search modal
 */
function handleCloseWebSearch(result: any): void {
  if (!result?.success) return;
  
  const webSearchStore = useWebSearchStore.getState();
  webSearchStore.hide();
}

/**
 * Handle Web Search tool call
 */
function handleWebSearch(result: any, args?: Record<string, any>): void {
  if (!result?.success || !result.results) return;
  
  const webSearchStore = useWebSearchStore.getState();
  const searchResults: SearchResult[] = result.results.map((article: any) => ({
    pageid: article.pageid || 0,
    title: article.title || '',
    snippet: article.snippet || '',
    wordcount: article.wordcount || 0,
    url: article.url || '',
    tags: Array.isArray(article.tags) ? article.tags : ['wikipedia'],
  }));
  
  const query = result.query || args?.query || 'Web Search';
  const totalHits = result.totalHits || searchResults.length;
  const suggestion = result.suggestion;
  const duckduckgoResults: DuckDuckGoResult[] = (result.duckduckgoResults || []).map((item: any) => ({
    title: item.title || '',
    url: item.url || '',
    snippet: item.snippet || '',
    displayUrl: item.displayUrl,
    tags: Array.isArray(item.tags) ? item.tags : ['duckduckgo'],
  }));
  
  webSearchStore.showResults(query, searchResults, totalHits, suggestion, duckduckgoResults);
}

/**
 * Main handler for all tool calls
 * Executes tool-specific logic and returns messages for history/speech
 */
export function handleToolCall(toolCall: ToolCall): ToolCallResult {
  const { name: toolName, args: toolArgs, result: toolResult } = toolCall;
  
  console.log('🧰 Tool call received:', toolName, toolArgs);
  
  // Parse result
  const result = parseToolResult(toolResult);
  
  // Execute tool-specific handlers
  switch (toolName) {
    case 'search_youtube':
      handleYouTubeSearch(result, toolArgs);
      break;
    case 'play_youtube_video':
      handlePlayYouTubeVideo(result);
      break;
    case 'control_youtube_player':
      handleControlYouTubePlayer(result, toolArgs);
      break;
    case 'close_youtube':
      handleCloseYouTube(result);
      break;
    case 'web_search':
      handleWebSearch(result, toolArgs);
      break;
    case 'close_web_search':
      handleCloseWebSearch(result);
      break;
    default:
      console.warn(`Unknown tool: ${toolName}`);
  }
  
  // Build messages
  let systemMessage = `Tool call: ${toolName}`;
  let speechMessage = '';
  
  if (result?.success && result.message) {
    systemMessage = `${systemMessage} - ${result.message}`;
    // Don't synthesize system messages - only user-facing content
    // System messages like "Video playing" or tool confirmations are silent
  } else if (result && result.success === false && result.error) {
    systemMessage = `${systemMessage} - Error: ${result.error}`;
    // Don't synthesize error messages - they're for debugging/display only
  }
  
  // speechMessage remains empty - tool results are silent
  return { systemMessage, speechMessage };
}
