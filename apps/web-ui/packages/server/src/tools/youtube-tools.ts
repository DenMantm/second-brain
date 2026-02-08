/**
 * LangChain Tools for YouTube Integration
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchYouTube, type VideoResult } from '../services/youtube';

// Store last search results in memory for reference
let lastSearchResults: VideoResult[] = [];

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
      
      // Store results for later reference (so user can say "play the first one")
      lastSearchResults = response.results;
      
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
const playYouTubeVideoSchema = z.object({
  video_id: z.string().optional().describe('YouTube video ID (11 characters, e.g., "dQw4w9WgXcQ")'),
  index: z.number().optional().describe('Index from search results (1-based, e.g., 1 for first video, 2 for second)'),
});

/**
 * Play a YouTube video by index or video ID
 */
// @ts-ignore - Deep type instantiation with Zod/LangChain
export const playYouTubeVideoTool = new DynamicStructuredTool({
  name: 'play_youtube_video',
  description: 'Play a YouTube video by index from previous search results (e.g., "play the first one", "play number 3") or by video ID. Returns instructions for the frontend to load the video.',
  schema: playYouTubeVideoSchema,
  func: async ({ video_id, index }) => {
    if (video_id) {
      // Play by video ID
      return JSON.stringify({
        success: true,
        action: 'play',
        videoId: video_id,
        message: `Playing video ${video_id}`,
      });
    }
    
    if (index !== undefined && index > 0 && index <= lastSearchResults.length) {
      // Play by index from last search
      const indexZeroBased = index - 1;
      const video = lastSearchResults[indexZeroBased];
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
    
    if (index !== undefined && lastSearchResults.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'No previous search results. Please search for videos first.',
      });
    }
    
    if (index !== undefined && (index < 1 || index > lastSearchResults.length)) {
      return JSON.stringify({
        success: false,
        error: `Invalid index ${index}. Please choose a number between 1 and ${lastSearchResults.length}.`,
      });
    }
    
    return JSON.stringify({
      success: false,
      error: 'Must provide either video_id or index parameter',
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

/**
 * Export all YouTube tools as an array
 */
export const youtubeTools = [
  searchYouTubeTool,
  playYouTubeVideoTool,
  controlYouTubePlayerTool,
];

/**
 * Get last search results (for debugging or external use)
 */
export function getLastSearchResults(): VideoResult[] {
  return lastSearchResults;
}

/**
 * Clear last search results
 */
export function clearLastSearchResults(): void {
  lastSearchResults = [];
}
