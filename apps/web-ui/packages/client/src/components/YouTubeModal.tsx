/**
 * YouTube Modal - Embedded YouTube viewer with maximize/minimize
 */
import { useEffect, useRef, useState } from 'react';
import { useYouTubeStore } from '../stores/youtubeStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useYouTubeModal } from '../hooks';
import './YouTubeModal.css';

// Wait for YouTube IFrame API to load
function waitForYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
    } else {
      window.onYouTubeIframeAPIReady = () => resolve();
    }
  });
}

export function YouTubeModal() {
  const {
    viewMode,
    searchResults,
    currentVideoId,
    isPlaying,
    volume,
    isMuted,
    setPlayer,
    updatePlayerState,
  } = useYouTubeStore();

  const {
    modalSize,
    isVisible,
    hide,
    toggleSize,
    playVideo,
    togglePlayPause,
    setVolume,
    volumeUp,
    volumeDown,
    toggleMute,
    getHeaderIcon,
    getHeaderTitle,
  } = useYouTubeModal();

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);

  // Get voice assistant state
  const {
    isListening,
    isRecording,
    isProcessing,
    isSpeaking,
    wakeWordDetected,
  } = useVoiceStore();

  // Load YouTube API
  useEffect(() => {
    waitForYouTubeAPI().then(() => {
      setIsApiReady(true);
    });
  }, []);

  // Initialize player when video changes
  useEffect(() => {
    if (!isApiReady || !currentVideoId || !playerContainerRef.current || viewMode !== 'video') {
      return;
    }

    // Clean up existing player
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    // Clear container
    playerContainerRef.current.innerHTML = '';

    // Create new player
    const player = new (window as any).YT.Player(playerContainerRef.current, {
      width: '100%',
      height: '100%',
      videoId: currentVideoId,
      playerVars: {
        autoplay: 1,
        enablejsapi: 1,
        origin: window.location.origin,
        modestbranding: 1,
        rel: 0,
        fs: 1,
      },
      events: {
        onReady: (_event: any) => {
          console.log('YouTube player ready');
          playerRef.current = player;
          setPlayer(player);
          updatePlayerState();
        },
        onStateChange: (event: any) => {
          console.log('Player state changed:', event.data);
          updatePlayerState();
        },
        onError: (event: any) => {
          const errorMessages: Record<number, string> = {
            2: 'Invalid video ID',
            5: 'HTML5 player error',
            100: 'Video not found or private',
            101: 'Video cannot be embedded',
            150: 'Video cannot be embedded',
          };
          console.error('Player error:', errorMessages[event.data] || 'Unknown error');
        },
      },
    });

    // Update state periodically
    const stateInterval = setInterval(() => {
      if (playerRef.current) {
        updatePlayerState();
      }
    }, 500);

    return () => {
      clearInterval(stateInterval);
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        setPlayer(null);
      }
    };
  }, [isApiReady, currentVideoId, viewMode, setPlayer, updatePlayerState]);

  // Keyboard shortcuts
  useEffect(() => {
    if (viewMode !== 'video') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if modal is visible and not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'arrowup':
          e.preventDefault();
          volumeUp();
          break;
        case 'arrowdown':
          e.preventDefault();
          volumeDown();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [viewMode, togglePlayPause, volumeUp, volumeDown, toggleMute]);

  if (!isVisible) {
    return null;
  }

  const getVoiceStatus = () => {
    if (isSpeaking) return { icon: '🔊', text: 'Speaking', className: 'speaking' };
    if (isProcessing) return { icon: '⚙️', text: 'Processing', className: 'processing' };
    if (isRecording) return { icon: '🎤', text: 'Listening', className: 'recording' };
    if (wakeWordDetected) return { icon: '✨', text: 'Wake word', className: 'wake-word' };
    if (isListening) return { icon: '👂', text: 'Wake word', className: 'listening' };
    return { icon: '💤', text: 'Idle', className: 'idle' };
  };

  const voiceStatus = getVoiceStatus();

  return (
    <div className={`youtube-modal ${modalSize}`}>
      <div className="youtube-modal-header">
        <div className="youtube-modal-title">
          <span className="youtube-icon">{getHeaderIcon()}</span>
          <span className="youtube-title-text">{getHeaderTitle()}</span>
        </div>
        
        {/* Voice Status Indicator */}
        <div className={`youtube-voice-status ${voiceStatus.className}`}>
          <span className="voice-status-icon">{voiceStatus.icon}</span>
          <span className="voice-status-text">{voiceStatus.text}</span>
        </div>
        
        <div className="youtube-modal-controls">
          <button
            className="youtube-control-btn"
            onClick={toggleSize}
            title={modalSize === 'minimized' ? 'Maximize' : 'Minimize'}
          >
            {modalSize === 'minimized' ? '🔼' : '🔽'}
          </button>
          <button
            className="youtube-control-btn"
            onClick={hide}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className={`youtube-modal-content ${modalSize === 'minimized' ? 'hidden' : ''}`}>
        {viewMode === 'search' && (
          <div className="youtube-search-results">
              {searchResults.length === 0 ? (
                <div className="youtube-empty">No results found</div>
              ) : (
                <div className="youtube-results-grid">
                  {searchResults.map((result, index) => (
                    <div
                      key={result.videoId}
                      className="youtube-result-card"
                      onClick={() => playVideo(result.videoId)}
                    >
                      <div className="youtube-thumbnail">
                        <img src={result.thumbnailUrl} alt={result.title} />
                        <div className="youtube-result-index">{index + 1}</div>
                        {result.duration && (
                          <div className="youtube-duration">{result.duration}</div>
                        )}
                      </div>
                      <div className="youtube-result-info">
                        <div className="youtube-result-title">{result.title}</div>
                        <div className="youtube-result-channel">{result.channelTitle}</div>
                        {result.viewCount && (
                          <div className="youtube-result-views">{result.viewCount} views</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'video' && currentVideoId && (
            <div className="youtube-video-container">
              <div ref={playerContainerRef} className="youtube-player" />
              
              {/* Playback Controls */}
              <div className="youtube-controls">
                <button
                  className="youtube-control-button"
                  onClick={togglePlayPause}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? '⏸️' : '▶️'}
                </button>

                <div className="youtube-volume-controls">
                  <button
                    className="youtube-control-button"
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                  
                  <button
                    className="youtube-control-button youtube-control-small"
                    onClick={volumeDown}
                    title="Volume Down"
                  >
                    −
                  </button>
                  
                  <input
                    type="range"
                    className="youtube-volume-slider"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseInt(e.target.value))}
                    title={`Volume: ${Math.round(volume)}%`}
                  />
                  
                  <button
                    className="youtube-control-button youtube-control-small"
                    onClick={volumeUp}
                    title="Volume Up"
                  >
                    +
                  </button>
                  
                  <span className="youtube-volume-label">
                    {isMuted ? '0' : Math.round(volume)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
