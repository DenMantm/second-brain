/**
 * YouTube LangChain Tools Tests
 * Uses mocked YouTube service to test tool logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  searchYouTubeTool, 
  playYouTubeVideoTool, 
  controlYouTubePlayerTool,
  youtubeTools,
  getLastSearchResults,
  clearLastSearchResults,
} from '../youtube-tools';
import * as youtubeService from '../../services/youtube';

// Mock the YouTube service
vi.mock('../../services/youtube');

describe('YouTube LangChain Tools', () => {
  const mockSearchResult = {
    query: 'test query',
    count: 3,
    results: [
      {
        video_id: 'vid1',
        title: 'First Test Video',
        channel: 'Test Channel 1',
        channel_url: 'https://youtube.com/channel/UC1',
        thumbnail: 'https://i.ytimg.com/vi/vid1/hqdefault.jpg',
        duration: '5:30',
        views: '1.2M views',
        published: '2 weeks ago',
        description: 'First test description',
      },
      {
        video_id: 'vid2',
        title: 'Second Test Video',
        channel: 'Test Channel 2',
        channel_url: 'https://youtube.com/channel/UC2',
        thumbnail: 'https://i.ytimg.com/vi/vid2/hqdefault.jpg',
        duration: '10:15',
        views: '850K views',
        published: '1 month ago',
        description: 'Second test description',
      },
      {
        video_id: 'vid3',
        title: 'Third Test Video',
        channel: 'Test Channel 3',
        channel_url: 'https://youtube.com/channel/UC3',
        thumbnail: 'https://i.ytimg.com/vi/vid3/hqdefault.jpg',
        duration: '3:45',
        views: '500K views',
        published: '3 days ago',
        description: 'Third test description',
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

  describe('searchYouTubeTool', () => {

    it('should have correct schema definition', () => {
      expect(searchYouTubeTool.name).toBe('search_youtube');
      expect(searchYouTubeTool.description).toContain('Search YouTube');
      expect(searchYouTubeTool.schema).toBeDefined();
    });

    it('should search YouTube and return formatted results', async () => {
      vi.mocked(youtubeService.searchYouTube).mockResolvedValueOnce(mockSearchResult);

      const result = await searchYouTubeTool.invoke({
        query: 'test query',
        max_results: 5,
      });

      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.query).toBe('test query');
      expect(parsed.count).toBe(3);
      expect(parsed.results).toHaveLength(3);
      
      // Validate structure of first result
      expect(parsed.results[0]).toMatchObject({
        index: 1,
        title: 'First Test Video',
        channel: 'Test Channel 1',
        videoId: 'vid1',
        thumbnail: 'https://i.ytimg.com/vi/vid1/hqdefault.jpg',
      });

      expect(youtubeService.searchYouTube).toHaveBeenCalledWith('test query', 5);
    });

    it('should store results for later reference', async () => {
      vi.mocked(youtubeService.searchYouTube).mockResolvedValueOnce(mockSearchResult);

      await searchYouTubeTool.invoke({ query: 'test query', max_results: 5 });

      const lastResults = getLastSearchResults();
      expect(lastResults).toHaveLength(3);
      expect(lastResults[0].video_id).toBe('vid1');
      expect(lastResults[1].video_id).toBe('vid2');
      expect(lastResults[2].video_id).toBe('vid3');
    });

    it('should handle search errors gracefully', async () => {
      vi.mocked(youtubeService.searchYouTube).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await searchYouTubeTool.invoke({
        query: 'test query',
        max_results: 5,
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Failed to search YouTube');
    });

    it('should use default max_results of 10', async () => {
      vi.mocked(youtubeService.searchYouTube).mockResolvedValueOnce(mockSearchResult);

      await searchYouTubeTool.invoke({ query: 'test' });

      expect(youtubeService.searchYouTube).toHaveBeenCalledWith('test', 10);
    });

    it('should format results with index for LLM', async () => {
      vi.mocked(youtubeService.searchYouTube).mockResolvedValueOnce(mockSearchResult);

      const result = await searchYouTubeTool.invoke({ query: 'test', max_results: 5 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.results[0].index).toBe(1);
      expect(parsed.results[1].index).toBe(2);
      expect(parsed.results[2].index).toBe(3);
    });
  });

  describe('playYouTubeVideoTool', () => {
    beforeEach(async () => {
      // Mock search to populate lastSearchResults
      vi.mocked(youtubeService.searchYouTube).mockResolvedValueOnce(mockSearchResult);
      await searchYouTubeTool.invoke({ query: 'test', max_results: 5 });
    });

    it('should have correct schema definition', () => {
      expect(playYouTubeVideoTool.name).toBe('play_youtube_video');
      expect(playYouTubeVideoTool.description).toContain('Play a YouTube video');
    });

    it('should play video by index', async () => {
      const result = await playYouTubeVideoTool.invoke({ index: 2 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe('play');
      expect(parsed.videoId).toBe('vid2');
      expect(parsed.title).toBe('Second Test Video');
      expect(parsed.message).toContain('Second Test Video');
    });

    it('should play video by video ID', async () => {
      const result = await playYouTubeVideoTool.invoke({ video_id: 'custom123' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe('play');
      expect(parsed.videoId).toBe('custom123');
    });

    it('should handle invalid index', async () => {
      const result = await playYouTubeVideoTool.invoke({ index: 99 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Invalid index');
    });

    it('should handle index too low', async () => {
      const result = await playYouTubeVideoTool.invoke({ index: 0 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Invalid index');
    });

    it('should handle missing parameters', async () => {
      const result = await playYouTubeVideoTool.invoke({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Must provide either');
    });
  });

  describe('controlYouTubePlayerTool', () => {
    it('should have correct schema definition', () => {
      expect(controlYouTubePlayerTool.name).toBe('control_youtube_player');
      expect(controlYouTubePlayerTool.description).toContain('Control the YouTube player');
    });

    it('should handle play action', async () => {
      const result = await controlYouTubePlayerTool.invoke({ action: 'play' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe('play');
      expect(parsed.message).toContain('Resuming playback');
    });

    it('should handle pause action', async () => {
      const result = await controlYouTubePlayerTool.invoke({ action: 'pause' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe('pause');
      expect(parsed.message).toContain('Pausing');
    });

    it('should handle seek action with value', async () => {
      const result = await controlYouTubePlayerTool.invoke({ action: 'seek', value: 125 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe('seek');
      expect(parsed.value).toBe(125);
      expect(parsed.message).toContain('2:05'); // 125 seconds = 2:05
    });

    it('should handle volume action with value', async () => {
      const result = await controlYouTubePlayerTool.invoke({ action: 'volume', value: 75 });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe('volume');
      expect(parsed.value).toBe(75);
      expect(parsed.message).toContain('75%');
    });

    it('should reject seek without value', async () => {
      const result = await controlYouTubePlayerTool.invoke({ action: 'seek' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('requires a value');
    });

    it('should reject volume without value', async () => {
      const result = await controlYouTubePlayerTool.invoke({ action: 'volume' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('requires a value');
    });
  });

  describe('youtubeTools array', () => {
    it('should export all three tools', () => {
      expect(youtubeTools).toHaveLength(3);
      expect(youtubeTools[0].name).toBe('search_youtube');
      expect(youtubeTools[1].name).toBe('play_youtube_video');
      expect(youtubeTools[2].name).toBe('control_youtube_player');
    });

    it('should all be DynamicStructuredTool instances', () => {
      youtubeTools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.schema).toBeDefined();
        expect(typeof tool.invoke).toBe('function');
      });
    });
  });

  describe('Last search results management', () => {
    it('should clear last search results', async () => {
      vi.mocked(youtubeService.searchYouTube).mockResolvedValueOnce(mockSearchResult);
      
      // First do a search
      await searchYouTubeTool.invoke({ query: 'test', max_results: 5 });
      expect(getLastSearchResults()).toHaveLength(3);

      clearLastSearchResults();
      expect(getLastSearchResults()).toHaveLength(0);
    });

    it('should return empty array when no searches performed', () => {
      const results = getLastSearchResults();
      expect(results).toEqual([]);
    });
  });
});
