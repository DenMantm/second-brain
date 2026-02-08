/**
 * YouTube Types
 * Shared between client and server for YouTube integration
 */

export interface VideoResult {
  video_id: string;
  title: string;
  channel: string;
  views: string;
  duration: string;
  url: string;
  thumbnail: string;
}

export interface YouTubeSearchResult {
  query: string;
  count: number;
  results: VideoResult[];
}

export interface YouTubePlayerAction {
  action: 'play' | 'pause' | 'volume' | 'seek' | 'mute' | 'unmute';
  value?: number; // For volume (0-100) or seek (seconds)
}

// Tool response types
export interface YouTubeToolResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

export interface SearchYouTubeResult extends YouTubeToolResult {
  query?: string;
  count?: number;
  results?: Array<{
    index: number;
    title: string;
    channel: string;
    views: string;
    duration: string;
    videoId: string;
    thumbnail: string;
  }>;
}

export interface PlayVideoResult extends YouTubeToolResult {
  video?: {
    id: string;
    title: string;
    url: string;
  };
}

export interface ControlPlayerResult extends YouTubeToolResult {
  action?: string;
  previousValue?: number;
  newValue?: number;
}
