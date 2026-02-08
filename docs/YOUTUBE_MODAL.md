# YouTube Modal Feature

## Overview

An embedded YouTube viewer modal with maximize/minimize functionality that displays search results and plays videos directly in the Second Brain interface.

## Features

### 1. **Dynamic Modal Sizing**
- **Minimized**: Compact header bar (320x60px) in bottom-right corner
- **Normal**: Medium size (480x500px) for comfortable viewing
- **Maximized**: Large centered modal (90vw x calc(100vh - 120px)) for immersive experience

### 2. **State-Based Icons**
- 🔍 Search: When displaying YouTube search results
- ▶️ Playing: When a video is currently playing
- 📺 Default: YouTube generic state

### 3. **View Modes**
- **Hidden**: Modal not displayed
- **Search**: Grid of video thumbnails with metadata
- **Video**: Full YouTube IFrame Player with controls

### 4. **Playback Controls**
- **Play/Pause**: Toggle video playback with spacebar or button
- **Volume Control**: Slider + up/down buttons (±10% increments)
- **Mute/Unmute**: Quick mute toggle
- **Keyboard Shortcuts**:
  - `Space` or `K`: Play/Pause
  - `↑`: Volume up
  - `↓`: Volume down
  - `M`: Toggle mute

## Architecture

### Components Created

1. **`youtubeStore.ts`** - Zustand store managing modal state
   - `showSearch(query, results)`: Display search results grid
   - `playVideo(videoId)`: Play specific video in YouTube IFrame Player
   - `setModalSize(size)`: Set modal size (minimized/normal/maximized)
   - `toggleSize()`: Toggle between minimized and maximized
   - `hide()`: Close modal
   - `setPlayer(player)`: Set YouTube Player instance
   - `togglePlayPause()`: Toggle video playback
   - `setVolume(volume)`: Set volume (0-100)
   - `volumeUp()`: Increase volume by 10%
   - `volumeDown()`: Decrease volume by 10%
   - `toggleMute()`: Toggle mute state
   - `updatePlayerState()`: Sync player state with store

2. **`YouTubeModal.tsx`** - React component
   - Responsive grid layout for search results
   - Click-to-play video cards
   - YouTube IFrame Player API integration
   - Playback controls (play/pause, volume, mute)
   - Keyboard shortcuts support
   - Maximize/minimize/close controls

3. **`YouTubeModal.css`** - Styling
   - Smooth animations with cubic-bezier transitions
   - Glass-morphism effect with backdrop blur
   - Responsive grid that adapts to modal size
   - Custom styled playback controls
   - Volume slider with custom webkit styling

4. **`youtube.d.ts`** - TypeScript declarations
   - YouTube IFrame Player API type definitions
   - PlayerState enum, Events interfaces
   - PlayerVars configuration types

### Integration

**voiceStore.ts** automatically triggers modal actions when tool calls are received:

```typescript
// When search_youtube tool is called:
- Parses search results from tool response
- Maps to YouTubeSearchResult[] format
- Calls youtubeStore.showSearch(query, results)
- Modal maximizes and displays video grid

// When play_youtube_video tool is called:
- Extracts videoId from tool response
- Calls youtubeStore.playVideo(videoId)
- Modal switches to video mode with iframe
```

## User Flow

1. **User**: "Search YouTube for cooking recipes"
   
   → LLM calls `search_youtube` tool
   
   → Modal **maximizes** showing grid of cooking videos
   
   → Each video shows: thumbnail, title, channel, views, duration, index number

2. **User**: "Play the first one"
   
   → LLM calls `play_youtube_video` with index=1
   
   → Modal stays **maximized**, switches to YouTube Player
   
   → Video autoplays, controls appear below player

3. **User can**:
   - Click 🔽 to minimize (video keeps playing)
   - Click 🔼 to restore from minimized
   - Click ✕ to close modal
   - Click any search result card to play that video
   - Use playback controls: ⏸️/▶️ play/pause, 🔊 volume slider, mute
   - Use keyboard shortcuts (space, arrows, M)

## Data Flow

```
Tool Call Received (LLM Stream)
        ↓
voiceStore: Handle tool_call chunk
        ↓
Parse JSON result (search_youtube or play_youtube_video)
        ↓
Map to YouTubeSearchResult[] or extract videoId
        ↓
Call youtubeStore action (showSearch or playVideo)
        ↓
YouTubeModal re-renders with new state
        ↓
Display search grid OR YouTube iframe
```

## Search Result Card Structure

```typescript
interface YouTubeSearchResult {
  videoId: string;          // e.g., "dQw4w9WgXcQ"
  title: string;            // Video title
  channelTitle: string;     // Channel name
  thumbnailUrl: string;     // Medium quality thumbnail (320x180)
  viewCount?: string;       // e.g., "2.1M views"
  duration?: string;        // e.g., "5:32"
}
```

Cards display:
- **Thumbnail**: 16:9 aspect ratio with index badge (1-10)
- **Duration badge**: Bottom-right overlay
- **Title**: 2-line clamp, white text
- **Channel**: Smaller gray text
- **View count**: Even smaller gray text

## Styling Highlights

- **Background**: Linear gradient (dark blue tones) with glassmorphism
- **Border**: Subtle white border with 0.1 opacity
- **Shadows**: Deep shadows for depth (0 20px 60px rgba(0,0,0,0.5))
- **Transitions**: 0.3s cubic-bezier for size changes, 0.2s for hover effects
- **Hover**: Cards lift up (-4px transform), brighten background, strengthen border
- **Scrollbar**: Custom styled, subtle and matches theme

## URLs Generated

**Search Mode**: No iframe, displays custom grid

**Video Mode** (YouTube IFrame Player API):
```javascript
new YT.Player(container, {
  videoId: 'VIDEO_ID',
  playerVars: {
    autoplay: 1,
    enablejsapi: 1,
    origin: window.location.origin,
    modestbranding: 1,
    rel: 0,
    fs: 1
  }
})
```

Player provides programmable control for:
- `playVideo()` / `pauseVideo()`
- `setVolume(volume)` / `getVolume()`
- `mute()` / `unMute()` / `isMuted()`
- `seekTo(seconds, allowSeekAhead)`  
- `getPlayerState()` - Returns 1 (playing), 2 (paused), etc.

## Responsive Behavior

**Seek bar with progress indicator
- Playback speed control (0.5x, 1x, 1.5x, 2x)
- Playlist support
- Video queue management
- History of watched videos
- Thumbnail preview on hover
- Fullscreen mode
- Picture-in-picture support
- Captions/subtitles toggledth
- Search grid: Auto-fill columns (min 280px per card)
- Normal size: Single column grid

## Future Enhancements

Potential additions:
- `control_youtube_player` tool integration (play/pause/seek from iframe)
- Picture-in-picture mode
- Playlist support
- Video queue management
- History of watched videos
- Thumbnail preview on hover
- Seekbar preview thumbnails

## Files Modified/Created

**Created:**
- `apps/web-ui/packages/client/src/stores/youtubeStore.ts`
- `apps/web-ui/packages/client/src/youtube.d.ts`

**Modified:**
- `apps/web-ui/packages/client/index.html` (YouTube IFrame API script)
- `apps/web-ui/packages/client/src/stores/voiceStore.ts` (tool call handling + control_youtube_player)
- `apps/web-ui/packages/client/src/App.tsx` (added YouTubeModal component)
- `apps/web-ui/packages/client/src/stores/__tests__/voiceStore.continuousConversation.test.ts` (fixed test)
- `apps/web-ui/packages/client/tsconfig.json` (include .d.ts files
- `apps/web-ui/packages/client/src/App.tsx` (added YouTubeModal component)
- `apps/web-ui/packages/client/src/stores/__tests__/voiceStore.continuousConversation.test.ts` (fixed test)
- `apps/web-ui/packages/server/src/services/conversation-memory.ts` (enhanced system prompt)

## Testing

To test:
1. Start dev servers (client + server)
2. Say: "Search YouTube for funny cats" with controls
6. Test playback controls:
   - Click ⏸️ to pause, ▶️ to play
   - Adjust volume with slider or +/− buttons
   - Click 🔊 to mute/unmute
7. Test keyboard shortcuts:
   - Press `Space` to toggle play/pause
   - Press `↑`/`↓` for volume
   - Press `M` to mute
8. Say: "Pause" or "Increase volume" to test voice control
9. Click minimize/maximize buttons
10. Try clicking video cards directly

---

**Built**: February 8, 2026  
**Status**: ✅ Production Ready  
**YouTube IFrame API**: v3

**Built**: February 8, 2026
**Status**: ✅ Production Ready
