/**
 * LangChain Tools for YouTube Integration
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchYouTube, type VideoResult } from '../services/youtube';
import type { ToolDocumentation } from '../types/tool-documentation';
import { sessionDataStore } from '../services/managers/sessionDataStore';
import { getCurrentSession } from '../services/managers/sessionContext';

/**
 * YouTube Tools Documentation for System Prompt
 */
export const youtubeToolsDocumentation: ToolDocumentation = {
  category: 'YOUTUBE CAPABILITIES',
  description: 'You can search YouTube, play videos, control playback, and close the YouTube window using these tools:',
  tools: [
    { name: 'search_youtube', usage: 'Search for videos (e.g., "search YouTube for cooking recipes")' },
    { name: 'play_youtube_video', usage: 'Play a video by index from search results (e.g., "play the first one")' },
    { name: 'control_youtube_player', usage: 'Control playback (play, pause, seek, volume)' },
    { name: 'close_youtube', usage: 'Close the YouTube modal window (e.g., "close YouTube", "hide the video")' },
  ],
  validExamples: [
    '"Search YouTube for cooking recipes"',
    '"Find videos about quantum physics"',
    '"Play the second one"',
    '"Pause the video"',
    '"Search for scarecrow videos"',
    '"Close YouTube" or "Hide the video"',
  ],
  instructions: [
    'When user asks to search YouTube:',
    '1. Use search_youtube with their query',
    '2. The search_youtube tool MUST include a non-empty "query" string',
    '   - Bad: {"name":"search_youtube","args":{}}',
    '   - Good: {"name":"search_youtube","args":{"query":"scarecrow"}}',
    '3. After getting results, describe the top videos naturally',
    '4. Ask which one they\'d like to watch',
    '',
    'When user selects a video (e.g., "play the first one", "play number 3", "play video 2"):',
    '1. Use play_youtube_video with ONLY the INDEX parameter from search results',
    '   - Correct: {"name":"play_youtube_video","args":{"index":1}} for first video',
    '   - Correct: {"name":"play_youtube_video","args":{"index":3}} for third video',
    '   - WRONG: {"name":"play_youtube_video","args":{}} - NEVER send empty parameters!',
    '   - WRONG: {"name":"play_youtube_video","args":{"index":1,"video_id":"None"}}',
    '   - WRONG: {"name":"play_youtube_video","args":{"video_id":"None"}}',
    '2. ALWAYS include the index parameter when playing from search results',
    '3. DO NOT send video_id parameter unless you have a specific YouTube video ID',
    '4. DO NOT send placeholder values like "None", "null", or empty strings for video_id',
    '5. DO NOT send empty parameters - always include at least the index parameter',
    '6. The server will look up the video from search results and return the actual videoId',
    '7. Confirm what\'s now playing',
    '',
    'CRITICAL: After searching, you have access to the video results with index numbers.',
    'When user says "play the first one" or "play video 1", use {"index":1}',
    'When user says "play the second one" or "play number 2", use {"index":2}',
    'When user says "play the third video", use {"index":3}',
    'ALWAYS include the index parameter - NEVER call play_youtube_video with empty args!',
    'DO NOT search again if results are already available!',,
    '',
    'For playback controls (pause, play, skip to time, volume):',
    '1. Use control_youtube_player with the appropriate action',
    '2. Confirm the action',
    '',
    'IMPORTANT: When presenting search results, describe them conversationally:',
    '- "I found some great cooking videos. The top one is \'Easy 15-Minute Pasta\' by Chef John with 2 million views."',
    '- "There\'s also \'Traditional Italian Pasta\' by Italia Squisita with 850 thousand views."',
    '- Use natural language for numbers and avoid listing format',
  ],
};

// Define search schema separately to help with type inference
const searchYouTubeSchema = z.object({
  query: z.string().describe('The search query (e.g., "cooking recipes", "jazz music", "guitar tutorials")'),
  max_results: z.number().optional().default(10).describe('Maximum number of results to return (default: 10, max: 20)'),
});

/**
 * Search YouTube for videos
 */
// @ts-ignore - Deep type instantiation with Zod/LangChain
export const searchYouTubeTool = new DynamicStructuredTool({
  name: 'search_youtube',
  description: 'Search YouTube for videos. Returns a list of videos with titles, channels, view counts, and durations. Use this when the user asks to find, search, or show videos on YouTube.',
  schema: searchYouTubeSchema,
  func: async ({ query, max_results = 10 }) => {
    try {
      const response = await searchYouTube(query, max_results);
      
      // Store results in session-specific storage (not global)
      const sessionId = getCurrentSession();
      console.log('🔍 YouTube search - Session ID:', sessionId);
      console.log('🔍 YouTube search - Results count:', response.results.length);
      
      if (sessionId) {
        sessionDataStore.setYouTubeResults(sessionId, response.results);
        console.log('✅ YouTube results stored for session:', sessionId);
        
        // Verify storage
        const stored = sessionDataStore.getYouTubeResults(sessionId);
        console.log('✅ Verification - Stored results count:', stored.length);
      } else {
        console.warn('⚠️ No session context set for YouTube search - results will not be stored');
      }
      
      // Format results for LLM in a natural way
      const formattedResults = response.results.map((v, idx) => ({
        index: idx + 1,
        title: v.title,
        channel: v.channel,
        views: v.views,
        duration: v.duration,
        videoId: v.video_id,
        thumbnail: v.thumbnail,
      }));
      
      return JSON.stringify({
        success: true,
        query: response.query,
        count: response.count,
        results: formattedResults,
        message: `Found ${response.count} videos for "${query}"`,
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to search YouTube: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
});

// Define play video schema separately
// Make both optional so we can provide custom error messages
const playYouTubeVideoSchema = z.object({
  index: z.number().int().min(1).optional().describe('The 1-based index number of the video from search results (usually 1-10). User says "play video 1" → use index: 1, "play number 3" → use index: 3. THIS IS THE PRIMARY PARAMETER - USE THIS WHEN PLAYING FROM SEARCH RESULTS.'),
  video_id: z.string().optional().describe('RARELY USED: Direct YouTube video ID (11-character string) ONLY if you have a specific video ID that is NOT from search results.'),
});

/**
 * Play a YouTube video by index or video ID
 */
// @ts-ignore - Deep type instantiation with Zod/LangChain
export const playYouTubeVideoTool = new DynamicStructuredTool({
  name: 'play_youtube_video',
  description: `Play a YouTube video from search results using the INDEX parameter.

REQUIRED PARAMETER: "index" - the 1-based position number from search results

HOW TO CALL THIS TOOL:
✅ CORRECT: {"index": 1}  // For "play the first video"
✅ CORRECT: {"index": 2}  // For "play video 2"
✅ CORRECT: {"index": 3}  // For "play number 3"
✅ CORRECT: {"index": 5}  // For "play the fifth one"

❌ WRONG: {}  // Empty object - NEVER do this!
❌ WRONG: {"video_id": "None"}  // Don't use video_id unless you have a real ID

WHEN TO USE: User says things like "play the first one", "play video 2", "play number 3", "play that one"
YOU MUST PROVIDE THE INDEX NUMBER (1-10) - Do NOT call this function without parameters!`,
  schema: playYouTubeVideoSchema,
  func: async ({ video_id, index }) => {
    console.log('🎬 play_youtube_video called - index:', index, 'video_id:', video_id);
    
    // Validate that at least one parameter was provided
    if (index === undefined && !video_id) {
      console.log('❌ No parameters provided!');
      return JSON.stringify({
        success: false,
        error: 'ERROR: No parameters provided. You MUST include the "index" parameter when playing from search results. Example: {"index": 1} for first video, {"index": 2} for second video. If there were previous search results, pick one by its index number (1-10).',
      });
    }
    
    // Get session-specific search results
    const sessionId = getCurrentSession();
    const sessionResults = sessionId ? sessionDataStore.getYouTubeResults(sessionId) : [];
    
    console.log('🔍 play_youtube_video - Session ID:', sessionId);
    console.log('🔍 play_youtube_video - Session results count:', sessionResults.length);
    if (sessionResults.length > 0) {
      console.log('🔍 play_youtube_video - First result:', sessionResults[0].title);
    }
    
    // PRIORITY 1: Use index if provided (this is the PRIMARY and RECOMMENDED way)
    if (index !== undefined) {
      if (sessionResults.length === 0) {
        return JSON.stringify({
          success: false,
          error: 'No previous search results. Please search for videos first.',
        });
      }
      
      if (index < 1 || index > sessionResults.length) {
        return JSON.stringify({
          success: false,
          error: `Invalid index ${index}. Please choose a number between 1 and ${sessionResults.length}.`,
        });
      }
      
      // Play by index from last search
      const indexZeroBased = index - 1;
      const video = sessionResults[indexZeroBased];
      if (!video) {
        return JSON.stringify({
          success: false,
          error: `Video not found at index ${index}`,
        });
      }
      
      return JSON.stringify({
        success: true,
        action: 'play',
        videoId: video.video_id,
        title: video.title,
        message: `Now playing: ${video.title}`,
      });
    }
    
    // PRIORITY 2: Use video_id only if index was not provided
    // Validate video_id (filter out "None", "null", empty strings, etc.)
    const isValidVideoId = video_id && 
                           video_id.trim() !== '' && 
                           video_id.toLowerCase() !== 'none' && 
                           video_id.toLowerCase() !== 'null' &&
                           video_id.length >= 8; // YouTube IDs are typically 11 chars, but allow some flexibility
    
    if (isValidVideoId) {
      // Play by direct video ID
      return JSON.stringify({
        success: true,
        action: 'play',
        videoId: video_id,
        message: `Playing video ${video_id}`,
      });
    }
    
    // Neither valid index nor valid video_id provided
    // This should rarely be reached due to the early validation above
    return JSON.stringify({
      success: false,
      error: 'Invalid parameters. When playing from search results, always use the index parameter. Example: {"index": 1} for the first video from search results.',
    });
  },
});

// Define control player schema separately
const controlYouTubePlayerSchema = z.object({
  action: z.enum(['play', 'pause', 'seek', 'volume']).describe('Action to perform on the player'),
  value: z.number().optional().describe('Value for action: seconds for seek (e.g., 120 for 2 minutes), 0-100 for volume'),
});

/**
 * Control YouTube player (play, pause, seek, volume)
 */
// @ts-ignore - Deep type instantiation with Zod/LangChain
export const controlYouTubePlayerTool = new DynamicStructuredTool({
  name: 'control_youtube_player',
  description: 'Control the YouTube player. Can play, pause, seek to a specific time, or adjust volume. Use this when user wants to control video playback.',
  schema: controlYouTubePlayerSchema,
  func: async ({ action, value }) => {
    const validActions = ['play', 'pause', 'seek', 'volume'];
    
    if (!validActions.includes(action)) {
      return JSON.stringify({
        success: false,
        error: `Invalid action "${action}". Must be one of: ${validActions.join(', ')}`,
      });
    }
    
    if ((action === 'seek' || action === 'volume') && value === undefined) {
      return JSON.stringify({
        success: false,
        error: `Action "${action}" requires a value parameter`,
      });
    }
    
    let message = '';
    switch (action) {
      case 'play':
        message = 'Resuming playback';
        break;
      case 'pause':
        message = 'Pausing video';
        break;
      case 'seek':
        message = `Seeking to ${Math.floor(value! / 60)}:${String(value! % 60).padStart(2, '0')}`;
        break;
      case 'volume':
        message = `Setting volume to ${value}%`;
        break;
    }
    
    return JSON.stringify({
      success: true,
      action,
      value,
      message,
    });
  },
});

// Define close YouTube schema (no parameters needed)
const closeYouTubeSchema = z.object({});

/**
 * Close the YouTube modal/window
 */
// @ts-ignore - Deep type instantiation with Zod/LangChain
export const closeYouTubeTool = new DynamicStructuredTool({
  name: 'close_youtube',
  description: 'Close the YouTube window/modal. Use this when the user asks to close, hide, or exit YouTube.',
  schema: closeYouTubeSchema,
  func: async () => {
    return JSON.stringify({
      success: true,
      action: 'close',
      message: 'Closing YouTube',
    });
  },
});

/**
 * Export all YouTube tools as an array
 */
export const youtubeTools = [
  searchYouTubeTool,
  playYouTubeVideoTool,
  controlYouTubePlayerTool,
  closeYouTubeTool,
];

/**
 * Get search results for a specific session (for debugging or external use)
 */
export function getSessionSearchResults(sessionId: string): VideoResult[] {
  return sessionDataStore.getYouTubeResults(sessionId);
}

/**
 * Clear search results for a specific session
 */
export function clearSessionSearchResults(sessionId: string): void {
  sessionDataStore.clearYouTubeResults(sessionId);
}
