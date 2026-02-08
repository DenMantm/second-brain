/**
 * Tool Call Handler Service
 * Handles execution and UI integration of LLM tool calls
 */

import { useYouTubeStore, type YouTubeSearchResult } from '../stores/youtubeStore';

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
    default:
      console.warn(`Unknown tool: ${toolName}`);
  }
  
  // Build messages
  let systemMessage = `Tool call: ${toolName}`;
  let speechMessage = '';
  
  if (result?.success && result.message) {
    systemMessage = `${systemMessage} - ${result.message}`;
    speechMessage = result.message;
  } else if (result && result.success === false && result.error) {
    systemMessage = `${systemMessage} - Error: ${result.error}`;
    speechMessage = result.error;
  }
  
  return { systemMessage, speechMessage };
}
