/**
 * Custom hook for YouTube modal functionality
 */

import { useCallback } from 'react';
import { useYouTubeStore } from '../stores/youtubeStore';

export const useYouTubeModal = () => {
  const {
    viewMode,
    modalSize,
    searchResults,
    searchQuery,
    currentVideoId,
    player,
    isPlaying,
    volume,
    isMuted,
    hide,
    toggleSize,
    playVideo,
    togglePlayPause,
    setVolume,
    volumeUp,
    volumeDown,
    toggleMute,
  } = useYouTubeStore();

  /**
   * Get the appropriate header icon based on view mode
   */
  const getHeaderIcon = useCallback(() => {
    if (viewMode === 'search') return '🔍';
    if (viewMode === 'video') return '▶️';
    return '📺';
  }, [viewMode]);

  /**
   * Get the appropriate header title based on view mode
   */
  const getHeaderTitle = useCallback(() => {
    if (viewMode === 'search') {
      return searchQuery ? `Search: ${searchQuery}` : 'YouTube Search';
    }
    if (viewMode === 'video') return 'Now Playing';
    return 'YouTube';
  }, [viewMode, searchQuery]);

  /**
   * Check if modal is currently visible
   */
  const isVisible = viewMode !== 'hidden';

  /**
   * Check if modal is minimized
   */
  const isMinimized = modalSize === 'minimized';

  return {
    // State
    viewMode,
    modalSize,
    searchResults,
    searchQuery,
    currentVideoId,
    player,
    isPlaying,
    volume,
    isMuted,
    isVisible,
    isMinimized,
    
    // Actions
    hide,
    toggleSize,
    playVideo,
    togglePlayPause,
    setVolume,
    volumeUp,
    volumeDown,
    toggleMute,
    
    // Computed
    getHeaderIcon,
    getHeaderTitle,
  };
};
