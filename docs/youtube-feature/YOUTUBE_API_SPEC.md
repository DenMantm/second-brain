# YouTube Feature API Specification

## Backend API Endpoints

### Base URL
```
http://localhost:3030/api/youtube
```

---

## Endpoints

### 1. Search YouTube

**Endpoint**: `POST /api/youtube/search`

**Description**: Search YouTube for videos using headless browser scraping

**Request Body**:
```typescript
{
  query: string;           // Search query (required)
  maxResults?: number;     // Max results to return (default: 10, max: 20)
}
```

**Response**: `200 OK`
```typescript
{
  query: string;           // Original search query
  results: VideoResult[];  // Array of video results
  cached: boolean;         // Whether results came from cache
  timestamp: string;       // ISO timestamp of search
}

interface VideoResult {
  video_id: string;        // YouTube video ID (11 characters)
  title: string;           // Video title
  channel: string;         // Channel name
  channel_url: string;     // Channel URL
  thumbnail: string;       // Thumbnail image URL
  duration: string;        // Duration (e.g., "10:23")
  views: string;           // View count (e.g., "1.2M views")
  published: string;       // Publish time (e.g., "2 days ago")
  description: string;     // Video description snippet
}
```

**Error Responses**:
```typescript
// 400 Bad Request
{
  error: "Query is required"
}

// 500 Internal Server Error
{
  error: "Failed to search YouTube",
  details: string
}

// 503 Service Unavailable
{
  error: "YouTube scraper service is not available"
}
```

**Example Request**:
```bash
curl -X POST http://localhost:3030/api/youtube/search \
  -H "Content-Type: application/json" \
  -d '{"query": "cooking recipes", "maxResults": 5}'
```

**Example Response**:
```json
{
  "query": "cooking recipes",
  "results": [
    {
      "video_id": "dQw4w9WgXcQ",
      "title": "Easy 15-Minute Pasta Recipe",
      "channel": "Chef John",
      "channel_url": "https://www.youtube.com/@chefjohn",
      "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "duration": "10:23",
      "views": "2.1M views",
      "published": "2 months ago",
      "description": "Learn how to make delicious pasta in just 15 minutes..."
    }
  ],
  "cached": false,
  "timestamp": "2026-02-08T10:30:00.000Z"
}
```

---

### 2. Get Video Details

**Endpoint**: `GET /api/youtube/video/:videoId`

**Description**: Get embed URL and details for a specific video

**Parameters**:
- `videoId` (path): YouTube video ID

**Response**: `200 OK`
```typescript
{
  video_id: string;
  embed_url: string;       // URL for iframe embed
}
```

**Example Request**:
```bash
curl http://localhost:3030/api/youtube/video/dQw4w9WgXcQ
```

**Example Response**:
```json
{
  "video_id": "dQw4w9WgXcQ",
  "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ"
}
```

---

### 3. Health Check

**Endpoint**: `GET /api/youtube/health`

**Description**: Check if YouTube scraper service is available

**Response**: `200 OK`
```typescript
{
  healthy: boolean;
}
```

**Example Response**:
```json
{
  "healthy": true
}
```

---

## Scraper Service API (Internal)

### Base URL
```
http://localhost:3003
```

### Endpoints

#### 1. Search

**Endpoint**: `POST /search`

**Request Body**:
```typescript
{
  query: string;
  max_results: number;
}
```

**Response**:
```typescript
{
  query: string;
  results: VideoResult[];
  cached: boolean;
  timestamp: string;
}
```

#### 2. Health Check

**Endpoint**: `GET /health`

**Response**:
```typescript
{
  status: "healthy" | "unhealthy";
  service: "youtube-scraper";
  browser_ready: boolean;
}
```

---

## WebSocket Events

### Client → Server

#### youtube:search
```typescript
{
  type: 'youtube:search',
  query: string,
  maxResults?: number
}
```

#### youtube:play
```typescript
{
  type: 'youtube:play',
  videoId: string
}
```

#### youtube:control
```typescript
{
  type: 'youtube:control',
  action: 'play' | 'pause' | 'seek' | 'volume',
  value?: number
}
```

### Server → Client

#### youtube:results
```typescript
{
  type: 'youtube:results',
  query: string,
  results: VideoResult[],
  timestamp: string
}
```

#### youtube:error
```typescript
{
  type: 'youtube:error',
  error: string,
  message: string
}
```

#### youtube:status
```typescript
{
  type: 'youtube:status',
  playing: boolean,
  videoId: string,
  currentTime: number,
  duration: number
}
```

---

## LLM Function Definitions

### search_youtube

```json
{
  "name": "search_youtube",
  "description": "Search YouTube for videos and return a list of results",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The search query"
      },
      "max_results": {
        "type": "number",
        "description": "Maximum number of results (default: 10)",
        "default": 10
      }
    },
    "required": ["query"]
  }
}
```

### play_youtube_video

```json
{
  "name": "play_youtube_video",
  "description": "Play a YouTube video by ID or index from search results",
  "parameters": {
    "type": "object",
    "properties": {
      "video_id": {
        "type": "string",
        "description": "YouTube video ID"
      },
      "index": {
        "type": "number",
        "description": "1-based index from search results"
      }
    }
  }
}
```

### control_youtube_player

```json
{
  "name": "control_youtube_player",
  "description": "Control YouTube player playback",
  "parameters": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["play", "pause", "seek", "volume"],
        "description": "Action to perform"
      },
      "value": {
        "type": "number",
        "description": "Value for seek (seconds) or volume (0-100)"
      }
    },
    "required": ["action"]
  }
}
```

---

## Rate Limits

- **Search requests**: 10 per minute per IP
- **Video plays**: Unlimited
- **Cache TTL**: 5 minutes

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Video or endpoint not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Scraper service down |

---

## Caching Strategy

- Search results cached for **5 minutes**
- Cache key: `search:{query}:{maxResults}`
- Cache backend: In-memory (production: Redis)
- Cache invalidation: Time-based expiry

---

## YouTube IFrame Player API Integration

### Player Initialization

```typescript
const player = new YT.Player('player-element-id', {
  videoId: 'video_id_here',
  playerVars: {
    autoplay: 1,
    controls: 1,
    modestbranding: 1,
    rel: 0,
    enablejsapi: 1
  },
  events: {
    onReady: (event) => {
      // Player ready
    },
    onStateChange: (event) => {
      // State changed: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
    }
  }
});
```

### Player Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `loadVideoById()` | `videoId: string` | Load and play video |
| `playVideo()` | - | Start playback |
| `pauseVideo()` | - | Pause playback |
| `seekTo()` | `seconds: number, allowSeekAhead: boolean` | Seek to time |
| `setVolume()` | `volume: number (0-100)` | Set volume |
| `getCurrentTime()` | - | Get current playback time |
| `getDuration()` | - | Get video duration |

---

## Security Considerations

1. **Input Validation**: All search queries sanitized
2. **Rate Limiting**: Prevent abuse of scraping service
3. **CORS**: Restrict to localhost during development
4. **No Authentication**: Single-user system (as per design)
5. **YouTube TOS**: Only scrape public search results, use official embed player
