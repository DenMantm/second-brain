# YouTube Frontend Implementation

## Component Architecture

### Components to Create

```
apps/web-ui/packages/client/src/
├── components/
│   └── YouTube/
│       ├── YouTubePlayer.tsx        # Embedded iframe player
│       ├── YouTubeSearchResults.tsx # Search results display
│       ├── VideoCard.tsx            # Individual video card
│       └── YouTubeControls.tsx      # Player controls
├── stores/
│   └── youtubeStore.ts              # Zustand store for YouTube state
└── services/
    ├── youtubePlayer.ts             # YouTube IFrame API wrapper
    └── youtubeApi.ts                # Backend API calls
```

## Implementation

### 1. YouTube Store (youtubeStore.ts)

```typescript
import { create } from 'zustand';

export interface VideoResult {
  video_id: string;
  title: string;
  channel: string;
  channel_url: string;
  thumbnail: string;
  duration: string;
  views: string;
  published: string;
  description: string;
}

interface YouTubeState {
  // Search
  searchQuery: string;
  searchResults: VideoResult[];
  isSearching: boolean;
  searchError: string | null;
  
  // Player
  currentVideo: VideoResult | null;
  isPlayerReady: boolean;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  
  // Actions
  setSearchQuery: (query: string) => void;
  searchVideos: (query: string) => Promise<void>;
  selectVideo: (video: VideoResult) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  clearResults: () => void;
}

export const useYouTubeStore = create<YouTubeState>((set, get) => ({
  // Initial state
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  searchError: null,
  currentVideo: null,
  isPlayerReady: false,
  isPlaying: false,
  volume: 100,
  currentTime: 0,
  duration: 0,
  
  // Actions
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  searchVideos: async (query) => {
    set({ isSearching: true, searchError: null });
    
    try {
      const response = await fetch('http://localhost:3030/api/youtube/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, maxResults: 10 }),
      });
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      set({ 
        searchResults: data.results,
        searchQuery: query,
        isSearching: false 
      });
    } catch (error) {
      set({ 
        searchError: error.message,
        isSearching: false 
      });
    }
  },
  
  selectVideo: (video) => {
    set({ currentVideo: video, isPlaying: true });
  },
  
  playVideo: () => set({ isPlaying: true }),
  pauseVideo: () => set({ isPlaying: false }),
  
  seekTo: (seconds) => set({ currentTime: seconds }),
  
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
  
  clearResults: () => set({ 
    searchResults: [], 
    searchQuery: '',
    searchError: null 
  }),
}));
```

### 2. YouTube Player API Service (youtubePlayer.ts)

```typescript
/// <reference types="youtube" />

export class YouTubePlayerService {
  private player: YT.Player | null = null;
  private isAPIReady = false;
  
  constructor() {
    this.loadYouTubeAPI();
  }
  
  private loadYouTubeAPI(): Promise<void> {
    return new Promise((resolve) => {
      // Check if API already loaded
      if (window.YT && window.YT.Player) {
        this.isAPIReady = true;
        resolve();
        return;
      }
      
      // Load API script
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode!.insertBefore(tag, firstScriptTag);
      
      // API ready callback
      (window as any).onYouTubeIframeAPIReady = () => {
        this.isAPIReady = true;
        resolve();
      };
    });
  }
  
  async createPlayer(
    elementId: string,
    videoId: string,
    onReady?: () => void,
    onStateChange?: (state: number) => void
  ): Promise<YT.Player> {
    await this.loadYouTubeAPI();
    
    this.player = new YT.Player(elementId, {
      height: '100%',
      width: '100%',
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        enablejsapi: 1,
      },
      events: {
        onReady: (event) => {
          onReady?.();
        },
        onStateChange: (event) => {
          onStateChange?.(event.data);
        },
      },
    });
    
    return this.player;
  }
  
  loadVideo(videoId: string) {
    this.player?.loadVideoById(videoId);
  }
  
  playVideo() {
    this.player?.playVideo();
  }
  
  pauseVideo() {
    this.player?.pauseVideo();
  }
  
  stopVideo() {
    this.player?.stopVideo();
  }
  
  seekTo(seconds: number) {
    this.player?.seekTo(seconds, true);
  }
  
  setVolume(volume: number) {
    this.player?.setVolume(volume);
  }
  
  getCurrentTime(): number {
    return this.player?.getCurrentTime() || 0;
  }
  
  getDuration(): number {
    return this.player?.getDuration() || 0;
  }
  
  getPlayerState(): number {
    return this.player?.getPlayerState() || -1;
  }
  
  destroy() {
    this.player?.destroy();
    this.player = null;
  }
}

export const youtubePlayerService = new YouTubePlayerService();
```

### 3. YouTube Player Component (YouTubePlayer.tsx)

```typescript
import React, { useEffect, useRef } from 'react';
import { useYouTubeStore } from '../../stores/youtubeStore';
import { youtubePlayerService } from '../../services/youtubePlayer';

export const YouTubePlayer: React.FC = () => {
  const playerRef = useRef<HTMLDivElement>(null);
  const { currentVideo, isPlaying, volume, setVolume } = useYouTubeStore();
  
  useEffect(() => {
    if (!currentVideo || !playerRef.current) return;
    
    const initPlayer = async () => {
      await youtubePlayerService.createPlayer(
        'youtube-player',
        currentVideo.video_id,
        () => {
          console.log('Player ready');
          useYouTubeStore.setState({ isPlayerReady: true });
        },
        (state) => {
          // YT.PlayerState: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
          useYouTubeStore.setState({ 
            isPlaying: state === 1 
          });
        }
      );
    };
    
    initPlayer();
    
    return () => {
      youtubePlayerService.destroy();
    };
  }, [currentVideo]);
  
  useEffect(() => {
    if (isPlaying) {
      youtubePlayerService.playVideo();
    } else {
      youtubePlayerService.pauseVideo();
    }
  }, [isPlaying]);
  
  useEffect(() => {
    youtubePlayerService.setVolume(volume);
  }, [volume]);
  
  if (!currentVideo) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <p>Select a video to play</p>
      </div>
    );
  }
  
  return (
    <div className="relative w-full h-full bg-black">
      <div id="youtube-player" ref={playerRef} className="w-full h-full" />
    </div>
  );
};
```

### 4. Video Card Component (VideoCard.tsx)

```typescript
import React from 'react';
import { VideoResult } from '../../stores/youtubeStore';

interface VideoCardProps {
  video: VideoResult;
  onSelect: (video: VideoResult) => void;
  isSelected?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({ 
  video, 
  onSelect,
  isSelected = false 
}) => {
  return (
    <div
      onClick={() => onSelect(video)}
      className={`
        cursor-pointer rounded-lg overflow-hidden transition-all
        hover:scale-105 hover:shadow-lg
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-200">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-1 right-1 bg-black bg-opacity-80 text-white text-xs px-1 rounded">
          {video.duration}
        </div>
      </div>
      
      {/* Video Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1">
          {video.title}
        </h3>
        <p className="text-xs text-gray-600 mb-1">
          {video.channel}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{video.views}</span>
          <span>•</span>
          <span>{video.published}</span>
        </div>
      </div>
    </div>
  );
};
```

### 5. Search Results Component (YouTubeSearchResults.tsx)

```typescript
import React from 'react';
import { useYouTubeStore } from '../../stores/youtubeStore';
import { VideoCard } from './VideoCard';

export const YouTubeSearchResults: React.FC = () => {
  const { 
    searchResults, 
    isSearching, 
    searchError,
    currentVideo,
    selectVideo 
  } = useYouTubeStore();
  
  if (isSearching) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="ml-3">Searching YouTube...</span>
      </div>
    );
  }
  
  if (searchError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {searchError}</p>
      </div>
    );
  }
  
  if (searchResults.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No videos found. Try searching for something!</p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {searchResults.map((video) => (
        <VideoCard
          key={video.video_id}
          video={video}
          onSelect={selectVideo}
          isSelected={currentVideo?.video_id === video.video_id}
        />
      ))}
    </div>
  );
};
```

### 6. Main YouTube Page Component

```typescript
import React, { useState } from 'react';
import { useYouTubeStore } from '../../stores/youtubeStore';
import { YouTubePlayer } from '../../components/YouTube/YouTubePlayer';
import { YouTubeSearchResults } from '../../components/YouTube/YouTubeSearchResults';

export const YouTubePage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const { searchVideos, currentVideo } = useYouTubeStore();
  
  const handleSearch = () => {
    if (searchInput.trim()) {
      searchVideos(searchInput.trim());
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  return (
    <div className="flex flex-col h-screen">
      {/* Header with Search */}
      <div className="bg-white border-b p-4">
        <div className="max-w-7xl mx-auto flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search YouTube..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Search
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Video Player */}
        <div className="w-2/3 bg-black">
          <YouTubePlayer />
        </div>
        
        {/* Search Results Sidebar */}
        <div className="w-1/3 overflow-y-auto bg-gray-50 p-4">
          <YouTubeSearchResults />
        </div>
      </div>
    </div>
  );
};
```

## Styling

Use Tailwind CSS for all components. Key design principles:

- **Dark theme** for video player area
- **Light theme** for search results
- **Smooth transitions** on hover/select
- **Responsive grid** for video cards
- **Loading states** for search

## Integration with Voice Chat

Add to voice command handlers:

```typescript
// In voiceStore.ts
if (transcript.toLowerCase().includes('search youtube')) {
  const query = transcript.replace(/search youtube for/i, '').trim();
  useYouTubeStore.getState().searchVideos(query);
}

if (transcript.toLowerCase().match(/play (the )?(first|second|third)/i)) {
  const index = parseVideoIndex(transcript);
  const video = useYouTubeStore.getState().searchResults[index];
  if (video) {
    useYouTubeStore.getState().selectVideo(video);
  }
}
```

## TypeScript Types

Create `src/types/youtube.d.ts`:

```typescript
declare namespace YT {
  interface Player {
    loadVideoById(videoId: string): void;
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    setVolume(volume: number): void;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    destroy(): void;
  }
  
  interface PlayerOptions {
    height?: string;
    width?: string;
    videoId?: string;
    playerVars?: PlayerVars;
    events?: Events;
  }
  
  interface PlayerVars {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    modestbranding?: 0 | 1;
    rel?: 0 | 1;
    enablejsapi?: 0 | 1;
  }
  
  interface Events {
    onReady?: (event: PlayerEvent) => void;
    onStateChange?: (event: OnStateChangeEvent) => void;
  }
  
  interface PlayerEvent {
    target: Player;
  }
  
  interface OnStateChangeEvent extends PlayerEvent {
    data: number;
  }
  
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
}

interface Window {
  YT: typeof YT;
  onYouTubeIframeAPIReady: () => void;
}
```
