import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useYouTubeStore } from '../youtubeStore';

// Mock settings store
const mockSettingsStore = {
  getState: vi.fn(() => ({ audioDuckingVolume: 10 })),
};

if (typeof window !== 'undefined') {
  (window as any).__settingsStore = mockSettingsStore;
}

describe('YouTubeStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useYouTubeStore.setState({
      viewMode: 'hidden',
      modalSize: 'normal',
      searchResults: [],
      currentVideoId: null,
      searchQuery: null,
      player: null,
      isPlaying: false,
      volume: 100,
      isMuted: false,
      previousVolume: null,
    });
  });

  describe('Audio Ducking', () => {
    beforeEach(() => {
      // Reset mock to default 10%
      mockSettingsStore.getState.mockReturnValue({ audioDuckingVolume: 10 });
    });

    it('should duck volume to configured level and store previous volume', () => {
      const mockPlayer = {
        setVolume: vi.fn(),
        getVolume: vi.fn().mockReturnValue(75),
        isMuted: vi.fn().mockReturnValue(false),
      };

      const { setPlayer, duckVolume } = useYouTubeStore.getState();
      setPlayer(mockPlayer);
      useYouTubeStore.setState({ volume: 75 });

      duckVolume();

      expect(mockPlayer.setVolume).toHaveBeenCalledWith(10);
      expect(useYouTubeStore.getState().volume).toBe(10);
      expect(useYouTubeStore.getState().previousVolume).toBe(75);
    });

    it('should use custom ducking volume from settings', () => {
      // Set custom ducking volume to 20%
      mockSettingsStore.getState.mockReturnValue({ audioDuckingVolume: 20 });

      const mockPlayer = {
        setVolume: vi.fn(),
        getVolume: vi.fn().mockReturnValue(80),
        isMuted: vi.fn().mockReturnValue(false),
      };

      const { setPlayer, duckVolume } = useYouTubeStore.getState();
      setPlayer(mockPlayer);
      useYouTubeStore.setState({ volume: 80 });

      duckVolume();

      expect(mockPlayer.setVolume).toHaveBeenCalledWith(20);
      expect(useYouTubeStore.getState().volume).toBe(20);
      expect(useYouTubeStore.getState().previousVolume).toBe(80);
    });

    it('should restore volume to previous level', () => {
      const mockPlayer = {
        setVolume: vi.fn(),
        getVolume: vi.fn().mockReturnValue(10),
        isMuted: vi.fn().mockReturnValue(false),
      };

      const { setPlayer, restoreVolume } = useYouTubeStore.getState();
      setPlayer(mockPlayer);
      useYouTubeStore.setState({ volume: 10, previousVolume: 75 });

      restoreVolume();

      expect(mockPlayer.setVolume).toHaveBeenCalledWith(75);
      expect(useYouTubeStore.getState().volume).toBe(75);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);
    });

    it('should not duck if already ducked (previousVolume is set)', () => {
      const mockPlayer = {
        setVolume: vi.fn(),
        getVolume: vi.fn().mockReturnValue(10),
        isMuted: vi.fn().mockReturnValue(false),
      };

      const { setPlayer, duckVolume } = useYouTubeStore.getState();
      setPlayer(mockPlayer);
      useYouTubeStore.setState({ volume: 10, previousVolume: 75 });

      duckVolume();

      // Should not call setVolume again
      expect(mockPlayer.setVolume).not.toHaveBeenCalled();
      expect(useYouTubeStore.getState().previousVolume).toBe(75); // Unchanged
    });

    it('should not restore if not ducked (previousVolume is null)', () => {
      const mockPlayer = {
        setVolume: vi.fn(),
        getVolume: vi.fn().mockReturnValue(50),
        isMuted: vi.fn().mockReturnValue(false),
      };

      const { setPlayer, restoreVolume } = useYouTubeStore.getState();
      setPlayer(mockPlayer);
      useYouTubeStore.setState({ volume: 50, previousVolume: null });

      restoreVolume();

      // Should not call setVolume
      expect(mockPlayer.setVolume).not.toHaveBeenCalled();
      expect(useYouTubeStore.getState().previousVolume).toBe(null); // Still null
    });

    it('should handle duck/restore cycle correctly', () => {
      const mockPlayer = {
        setVolume: vi.fn(),
        getVolume: vi.fn().mockReturnValue(80),
        isMuted: vi.fn().mockReturnValue(false),
      };

      const { setPlayer, duckVolume, restoreVolume } = useYouTubeStore.getState();
      setPlayer(mockPlayer);
      useYouTubeStore.setState({ volume: 80 });

      // Duck
      duckVolume();
      expect(mockPlayer.setVolume).toHaveBeenCalledWith(10);
      expect(useYouTubeStore.getState().volume).toBe(10);
      expect(useYouTubeStore.getState().previousVolume).toBe(80);

      // Restore
      restoreVolume();
      expect(mockPlayer.setVolume).toHaveBeenCalledWith(80);
      expect(useYouTubeStore.getState().volume).toBe(80);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);
    });

    it('should not duck if player is not available', () => {
      const { duckVolume } = useYouTubeStore.getState();
      useYouTubeStore.setState({ player: null, volume: 75 });

      duckVolume();

      // Should not change state
      expect(useYouTubeStore.getState().volume).toBe(75);
      expect(useYouTubeStore.getState().previousVolume).toBe(null);
    });

    it('should not restore if player is not available', () => {
      const { restoreVolume } = useYouTubeStore.getState();
      useYouTubeStore.setState({ player: null, volume: 10, previousVolume: 75 });

      restoreVolume();

      // Should not change state
      expect(useYouTubeStore.getState().volume).toBe(10);
      expect(useYouTubeStore.getState().previousVolume).toBe(75); // Unchanged
    });
  });

  describe('Volume Controls', () => {
    it('should set volume and clear mute state', () => {
      const mockPlayer = {
        setVolume: vi.fn(),
        isMuted: vi.fn().mockReturnValue(true),
        unMute: vi.fn(),
      };

      const { setPlayer, setVolume } = useYouTubeStore.getState();
      setPlayer(mockPlayer);

      setVolume(50);

      expect(mockPlayer.setVolume).toHaveBeenCalledWith(50);
      expect(mockPlayer.unMute).toHaveBeenCalled();
      expect(useYouTubeStore.getState().volume).toBe(50);
      expect(useYouTubeStore.getState().isMuted).toBe(false);
    });

    it('should clamp volume to 0-100 range', () => {
      const mockPlayer = {
        setVolume: vi.fn(),
        isMuted: vi.fn().mockReturnValue(false),
        unMute: vi.fn(),
      };

      const { setPlayer, setVolume } = useYouTubeStore.getState();
      setPlayer(mockPlayer);

      // Test upper bound
      setVolume(150);
      expect(mockPlayer.setVolume).toHaveBeenCalledWith(100);
      expect(useYouTubeStore.getState().volume).toBe(100);

      // Test lower bound
      setVolume(-10);
      expect(mockPlayer.setVolume).toHaveBeenCalledWith(0);
      expect(useYouTubeStore.getState().volume).toBe(0);
    });
  });

  describe('View Mode', () => {
    it('should show search results with maximized modal', () => {
      const results = [
        {
          videoId: 'test123',
          title: 'Test Video',
          channelTitle: 'Test Channel',
          thumbnailUrl: 'http://example.com/thumb.jpg',
        },
      ];

      const { showSearch } = useYouTubeStore.getState();
      showSearch('test query', results);

      const state = useYouTubeStore.getState();
      expect(state.viewMode).toBe('search');
      expect(state.modalSize).toBe('maximized');
      expect(state.searchQuery).toBe('test query');
      expect(state.searchResults).toEqual(results);
      expect(state.currentVideoId).toBe(null);
    });

    it('should play video with maximized modal', () => {
      const { playVideo } = useYouTubeStore.getState();
      playVideo('abc123');

      const state = useYouTubeStore.getState();
      expect(state.viewMode).toBe('video');
      expect(state.modalSize).toBe('maximized');
      expect(state.currentVideoId).toBe('abc123');
    });

    it('should hide modal and destroy player', () => {
      const mockPlayer = {
        destroy: vi.fn(),
      };

      const { setPlayer, hide } = useYouTubeStore.getState();
      setPlayer(mockPlayer);
      useYouTubeStore.setState({ viewMode: 'video', currentVideoId: 'test123' });

      hide();

      expect(mockPlayer.destroy).toHaveBeenCalled();
      const state = useYouTubeStore.getState();
      expect(state.viewMode).toBe('hidden');
      expect(state.currentVideoId).toBe(null);
      expect(state.player).toBe(null);
    });
  });
});
