# YouTube LLM Integration

## LLM Tool Definitions

### Tool: search_youtube

**Purpose**: Search YouTube for videos based on natural language query

**Function Signature**:
```typescript
{
  name: 'search_youtube',
  description: 'Search YouTube for videos. Returns a list of video results with titles, channels, thumbnails, and metadata.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query (e.g., "cooking recipes", "how to play guitar")'
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 20)',
        default: 10
      }
    },
    required: ['query']
  }
}
```

**Implementation**:
```typescript
async function search_youtube(query: string, max_results: number = 10) {
  const response = await fetch('http://localhost:3030/api/youtube/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, maxResults: max_results })
  });
  
  const data = await response.json();
  
  // Format for LLM
  return {
    query,
    results: data.results.map((v, idx) => ({
      index: idx + 1,
      title: v.title,
      channel: v.channel,
      duration: v.duration,
      views: v.views,
      videoId: v.video_id
    }))
  };
}
```

### Tool: play_youtube_video

**Purpose**: Play a specific YouTube video by ID or index

**Function Signature**:
```typescript
{
  name: 'play_youtube_video',
  description: 'Play a YouTube video in the embedded player. Can specify by video ID or by index from search results.',
  parameters: {
    type: 'object',
    properties: {
      video_id: {
        type: 'string',
        description: 'YouTube video ID (11 characters)'
      },
      index: {
        type: 'number',
        description: 'Index of video from search results (1-based)'
      }
    }
  }
}
```

**Implementation**:
```typescript
async function play_youtube_video({ video_id, index }: { video_id?: string; index?: number }) {
  const store = useYouTubeStore.getState();
  
  if (video_id) {
    // Find video in search results
    const video = store.searchResults.find(v => v.video_id === video_id);
    if (video) {
      store.selectVideo(video);
      return { success: true, playing: video.title };
    }
  }
  
  if (index && index > 0 && index <= store.searchResults.length) {
    const video = store.searchResults[index - 1];
    store.selectVideo(video);
    return { success: true, playing: video.title };
  }
  
  return { success: false, error: 'Video not found' };
}
```

### Tool: control_youtube_player

**Purpose**: Control YouTube player (play/pause/seek/volume)

**Function Signature**:
```typescript
{
  name: 'control_youtube_player',
  description: 'Control the YouTube player (play, pause, seek to time, adjust volume)',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['play', 'pause', 'seek', 'volume'],
        description: 'Action to perform'
      },
      value: {
        type: 'number',
        description: 'Value for seek (seconds) or volume (0-100)'
      }
    },
    required: ['action']
  }
}
```

**Implementation**:
```typescript
async function control_youtube_player({ action, value }: { action: string; value?: number }) {
  const store = useYouTubeStore.getState();
  
  switch (action) {
    case 'play':
      store.playVideo();
      return { success: true, action: 'playing' };
    
    case 'pause':
      store.pauseVideo();
      return { success: true, action: 'paused' };
    
    case 'seek':
      if (value !== undefined) {
        store.seekTo(value);
        return { success: true, action: `seeked to ${value}s` };
      }
      break;
    
    case 'volume':
      if (value !== undefined) {
        store.setVolume(value);
        return { success: true, action: `volume set to ${value}` };
      }
      break;
  }
  
  return { success: false, error: 'Invalid action or missing value' };
}
```

## Intent Detection Patterns

### Search Intent

**Training examples**:
- "Search YouTube for cooking videos"
  → `search_youtube({ query: "cooking videos" })`
  
- "Find me some guitar tutorials"
  → `search_youtube({ query: "guitar tutorials" })`
  
- "Show me funny cat videos"
  → `search_youtube({ query: "funny cat videos" })`
  
- "I want to watch some relaxing music"
  → `search_youtube({ query: "relaxing music" })`

### Selection Intent

**Training examples**:
- "Play the first one"
  → `play_youtube_video({ index: 1 })`
  
- "Show me the third video"
  → `play_youtube_video({ index: 3 })`
  
- "Play the video about pasta"
  → LLM finds matching video from results → `play_youtube_video({ video_id: "..." })`

### Control Intent

**Training examples**:
- "Pause the video"
  → `control_youtube_player({ action: "pause" })`
  
- "Turn up the volume"
  → `control_youtube_player({ action: "volume", value: 80 })`
  
- "Skip to 2 minutes"
  → `control_youtube_player({ action: "seek", value: 120 })`

## LLM System Prompt Addition

Add to system prompt:

```
YouTube Integration:
- You can search YouTube using search_youtube(query)
- Play videos using play_youtube_video(video_id or index)
- Control playback using control_youtube_player(action, value)

When user asks to search for videos:
1. Extract the search query from their request
2. Call search_youtube with the query
3. Present results in a friendly format with numbers
4. Ask which one they'd like to watch

When user selects a video:
1. Parse their selection ("first one", "the third video", etc.)
2. Call play_youtube_video with the index
3. Confirm what's now playing

For playback controls:
- "pause" → control_youtube_player({ action: "pause" })
- "play" → control_youtube_player({ action: "play" })
- "skip to X:XX" → control_youtube_player({ action: "seek", value: seconds })
- "louder/quieter" → control_youtube_player({ action: "volume", value: 0-100 })

Always present search results in a numbered list so users can easily select by number.
```

## Example Conversation Flow

**User**: "Search YouTube for pasta recipes"

**LLM**: 
```json
{
  "tool_calls": [{
    "name": "search_youtube",
    "arguments": { "query": "pasta recipes" }
  }]
}
```

**Tool Response**:
```json
{
  "query": "pasta recipes",
  "results": [
    { "index": 1, "title": "Easy 15-Minute Pasta Recipe", "channel": "Chef John", "views": "2.1M views" },
    { "index": 2, "title": "Traditional Italian Pasta", "channel": "Italia Squisita", "views": "850K views" },
    { "index": 3, "title": "5 Quick Pasta Recipes", "channel": "Tasty", "views": "5.2M views" }
  ]
}
```

**LLM Response**: 
"I found some pasta recipes on YouTube! Here are the top results:

1. **Easy 15-Minute Pasta Recipe** by Chef John (2.1M views)
2. **Traditional Italian Pasta** by Italia Squisita (850K views)  
3. **5 Quick Pasta Recipes** by Tasty (5.2M views)

Which one would you like to watch?"

**User**: "Play the first one"

**LLM**:
```json
{
  "tool_calls": [{
    "name": "play_youtube_video",
    "arguments": { "index": 1 }
  }]
}
```

**Tool Response**:
```json
{
  "success": true,
  "playing": "Easy 15-Minute Pasta Recipe"
}
```

**LLM Response**:
"Now playing: **Easy 15-Minute Pasta Recipe** by Chef John. Enjoy!"

## Voice Command Parsing

### Direct Integration in Voice Store

```typescript
// In voiceStore.ts - after getting LLM response
const parseYouTubeCommand = (text: string) => {
  const lower = text.toLowerCase();
  
  // Search detection
  if (lower.match(/search youtube|find.*video|show me.*video/i)) {
    const query = text
      .replace(/search youtube for/i, '')
      .replace(/find.*videos? (about|for|on)/i, '')
      .replace(/show me.*videos? (about|for|on)/i, '')
      .trim();
    
    if (query) {
      return { action: 'search', query };
    }
  }
  
  // Selection detection
  const indexMatch = lower.match(/play (the )?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|[0-9]+)/i);
  if (indexMatch) {
    const indexMap = {
      'first': 1, '1st': 1,
      'second': 2, '2nd': 2,
      'third': 3, '3rd': 3,
      'fourth': 4, '4th': 4,
      'fifth': 5, '5th': 5,
    };
    
    const index = indexMap[indexMatch[2]] || parseInt(indexMatch[2]);
    return { action: 'play', index };
  }
  
  // Playback control
  if (lower.includes('pause')) return { action: 'pause' };
  if (lower.includes('play') && !indexMatch) return { action: 'play' };
  
  return null;
};
```

## Error Handling

```typescript
// YouTube search failed
{
  error: 'youtube_search_failed',
  message: 'Unable to search YouTube at this time. Please try again.',
  fallback: 'I couldn\'t search YouTube right now. Would you like me to try something else?'
}

// Video not found
{
  error: 'video_not_found',
  message: 'That video is not in the current search results',
  fallback: 'I couldn\'t find that video. Could you try selecting by number? (e.g., "play the first one")'
}

// Player not ready
{
  error: 'player_not_ready',
  message: 'The video player is not ready yet',
  fallback: 'The video player is still loading. Please wait a moment.'
}
```

## Analytics & Logging

Track YouTube interactions:

```typescript
interface YouTubeAnalytics {
  searches: number;
  videosPlayed: number;
  averageWatchTime: number;
  popularQueries: string[];
  playbackControls: {
    pauses: number;
    seeks: number;
    volumeChanges: number;
  };
}
```

Log to console/backend:
- Every search query
- Video selections
- Playback starts/stops
- Errors and failures
