/**
 * YouTube Store - Manages embedded YouTube viewer state
 */
import { create } from 'zustand';

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount?: string;
  duration?: string;
}

export type YouTubeViewMode = 'hidden' | 'search' | 'video';
export type YouTubeModalSize = 'minimized' | 'normal' | 'maximized';

interface YouTubeState {
  // Modal state
  viewMode: YouTubeViewMode;
  modalSize: YouTubeModalSize;
  
  // Content state
  searchResults: YouTubeSearchResult[];
  currentVideoId: string | null;
  searchQuery: string | null;
  
  // Player state
  player: any | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  
  // Actions
  showSearch: (query: string, results: YouTubeSearchResult[]) => void;
  playVideo: (videoId: string) => void;
  setModalSize: (size: YouTubeModalSize) => void;
  toggleSize: () => void;
  hide: () => void;
  
  // Player controls
  setPlayer: (player: any | null) => void;
  togglePlayPause: () => void;
  setVolume: (volume: number) => void;
  volumeUp: () => void;
  volumeDown: () => void;
  toggleMute: () => void;
  updatePlayerState: () => void;
}

export const useYouTubeStore = create<YouTubeState>((set, get) => ({
  // Initial state
  viewMode: 'hidden',
  modalSize: 'normal',
  searchResults: [],
  currentVideoId: null,
  searchQuery: null,
  
  // Player state
  player: null,
  isPlaying: false,
  volume: 100,
  isMuted: false,

  // Show search results and maximize modal
  showSearch: (query: string, results: YouTubeSearchResult[]) => {
    set({
      viewMode: 'search',
      modalSize: 'maximized',
      searchQuery: query,
      searchResults: results,
      currentVideoId: null,
    });
  },

  // Play a specific video
  playVideo: (videoId: string) => {
    set({
      viewMode: 'video',
      modalSize: 'maximized',
      currentVideoId: videoId,
    });
  },

  // Set modal size
  setModalSize: (size: YouTubeModalSize) => {
    set({ modalSize: size });
  },

  // Toggle between minimized and previous size
  toggleSize: () => {
    const { modalSize } = get();
    if (modalSize === 'minimized') {
      set({ modalSize: 'maximized' });
    } else {
      set({ modalSize: 'minimized' });
    }
  },

  // Hide modal
  hide: () => {
    const { player } = get();
    if (player) {
      player.destroy();
    }
    set({
      viewMode: 'hidden',
      currentVideoId: null,
      player: null,
    });
  },
  
  // Player controls
  setPlayer: (player: any | null) => {
    set({ player });
  },
  
  togglePlayPause: () => {
    const { player, isPlaying } = get();
    if (!player) return;
    
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  },
  
  setVolume: (volume: number) => {
    const { player } = get();
    if (!player) return;
    
    const clampedVolume = Math.max(0, Math.min(100, volume));
    player.setVolume(clampedVolume);
    set({ volume: clampedVolume, isMuted: false });
    if (player.isMuted()) {
      player.unMute();
    }
  },
  
  volumeUp: () => {
    const { volume } = get();
    get().setVolume(volume + 10);
  },
  
  volumeDown: () => {
    const { volume } = get();
    get().setVolume(volume - 10);
  },
  
  toggleMute: () => {
    const { player, isMuted } = get();
    if (!player) return;
    
    if (isMuted) {
      player.unMute();
      set({ isMuted: false });
    } else {
      player.mute();
      set({ isMuted: true });
    }
  },
  
  updatePlayerState: () => {
    const { player } = get();
    if (!player) return;
    
    try {
      const state = player.getPlayerState();
      const isPlaying = state === 1; // YT.PlayerState.PLAYING
      const volume = player.getVolume();
      const isMuted = player.isMuted();
      
      set({ isPlaying, volume, isMuted });
    } catch (error) {
      console.error('Error updating player state:', error);
    }
  },
}));
