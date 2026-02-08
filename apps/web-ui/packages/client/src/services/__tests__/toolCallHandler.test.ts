/**
 * Tests for Tool Call Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleToolCall, type ToolCall } from '../toolCallHandler';

// Mock YouTube store
const mockYouTubeStore = {
  showSearch: vi.fn(),
  playVideo: vi.fn(),
  setVolume: vi.fn(),
  player: {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
  }
};

vi.mock('../../stores/youtubeStore', () => ({
  useYouTubeStore: {
    getState: () => mockYouTubeStore
  }
}));

describe('toolCallHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should handle YouTube search tool call', () => {
    const toolCall: ToolCall = {
      name: 'search_youtube',
      args: { query: 'cat videos' },
      result: {
        success: true,
        message: 'Found 5 videos',
        query: 'cat videos',
        results: [
          {
            videoId: 'abc123',
            title: 'Funny Cats',
            channel: 'Cat Channel',
            thumbnail: 'https://...', views: 1000,
            duration: '5:30'
          }
        ]
      }
    };
    
    const result = handleToolCall(toolCall);
    
    expect(mockYouTubeStore.showSearch).toHaveBeenCalledWith(
      'cat videos',
      expect.arrayContaining([
        expect.objectContaining({ videoId: 'abc123', title: 'Funny Cats' })
      ])
    );
    expect(result.systemMessage).toContain('search_youtube');
    expect(result.systemMessage).toContain('Found 5 videos');
    expect(result.speechMessage).toBe('Found 5 videos');
  });
  
  it('should handle play YouTube video tool call', () => {
    const toolCall: ToolCall = {
      name: 'play_youtube_video',
      args: { videoId: 'xyz789' },
      result: {
        success: true,
        message: 'Playing video',
        videoId: 'xyz789'
      }
    };
    
    const result = handleToolCall(toolCall);
    
    expect(mockYouTubeStore.playVideo).toHaveBeenCalledWith('xyz789');
    expect(result.systemMessage).toContain('play_youtube_video');
    expect(result.speechMessage).toBe('Playing video');
  });
  
  it('should handle YouTube player control - play', () => {
    const toolCall: ToolCall = {
      name: 'control_youtube_player',
      args: { action: 'play' },
      result: { success: true }
    };
    
    handleToolCall(toolCall);
    
    expect(mockYouTubeStore.player.playVideo).toHaveBeenCalled();
  });
  
  it('should handle YouTube player control - pause', () => {
    const toolCall: ToolCall = {
      name: 'control_youtube_player',
      args: { action: 'pause' },
      result: { success: true }
    };
    
    handleToolCall(toolCall);
    
    expect(mockYouTubeStore.player.pauseVideo).toHaveBeenCalled();
  });
  
  it('should handle YouTube player control - volume', () => {
    const toolCall: ToolCall = {
      name: 'control_youtube_player',
      args: { action: 'volume', value: 50 },
      result: { success: true }
    };
    
    handleToolCall(toolCall);
    
    expect(mockYouTubeStore.setVolume).toHaveBeenCalledWith(50);
  });
  
  it('should handle YouTube player control - seek', () => {
    const toolCall: ToolCall = {
      name: 'control_youtube_player',
      args: { action: 'seek', value: 120 },
      result: { success: true }
    };
    
    handleToolCall(toolCall);
    
    expect(mockYouTubeStore.player.seekTo).toHaveBeenCalledWith(120, true);
  });
  
  it('should handle tool call errors', () => {
    const toolCall: ToolCall = {
      name: 'search_youtube',
      args: {},
      result: {
        success: false,
        error: 'Search failed'
      }
    };
    
    const result = handleToolCall(toolCall);
    
    expect(result.systemMessage).toContain('Error: Search failed');
    expect(result.speechMessage).toBe('Search failed');
  });
  
  it('should handle unknown tools', () => {
    const toolCall: ToolCall = {
      name: 'unknown_tool',
      args: {},
      result: { success: true }
    };
    
    const result = handleToolCall(toolCall);
    
    expect(result.systemMessage).toContain('unknown_tool');
  });
  
  it('should parse JSON string results', () => {
    const toolCall: ToolCall = {
      name: 'search_youtube',
      args: {},
      result: '{"success": true, "message": "Done"}'
    };
    
    const result = handleToolCall(toolCall);
    
    expect(result.speechMessage).toBe('Done');
  });
  
  it('should handle invalid JSON results', () => {
    const toolCall: ToolCall = {
      name: 'search_youtube',
      args: {},
      result: 'invalid json'
    };
    
    const result = handleToolCall(toolCall);
    
    expect(result.systemMessage).toContain('search_youtube');
  });
});
