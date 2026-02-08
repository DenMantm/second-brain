# YouTube Search & Playback Feature - Overview

## Feature Summary

Enable the LLM to search YouTube via headless browser scraping and play selected videos in an embedded player, providing a fully voice-controlled YouTube browsing experience.

## User Flow

1. **User Request**: "Show me cooking videos" or "Search YouTube for pasta recipes"
2. **LLM Processing**: Identifies search intent and query
3. **Backend Scraping**: Headless browser searches YouTube, extracts results
4. **Result Display**: Shows video list with thumbnails, titles, channels
5. **User Selection**: User says "play the second one" or clicks a video
6. **Video Playback**: Embedded YouTube player loads and plays the video
7. **Playback Control**: Voice commands for play/pause/seek/volume

## System Architecture

```
┌─────────────────────────────────────────────────┐
│  User Voice/Text Input                          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Frontend (React + TypeScript)                  │
│  - Voice input component                        │
│  - Video search results display                 │
│  - YouTube iframe player component              │
└─────────────────────────────────────────────────┘
                    ↓ WebSocket
┌─────────────────────────────────────────────────┐
│  API Server (Node.js + TypeScript)              │
│  - LLM service (intent detection)               │
│  - YouTube scraping service proxy               │
│  - Player control orchestration                 │
└─────────────────────────────────────────────────┘
                    ↓ HTTP
┌─────────────────────────────────────────────────┐
│  YouTube Scraper Service (Python)               │
│  - Playwright/Puppeteer headless browser        │
│  - YouTube search page scraping                 │
│  - Video metadata extraction                    │
└─────────────────────────────────────────────────┘
```

## Core Components

### 1. YouTube Scraper Service (New)
- **Technology**: Python + Playwright
- **Port**: 3003
- **Responsibilities**:
  - Launch headless browser
  - Navigate to YouTube search
  - Extract video metadata (title, channel, thumbnail, videoId, views, duration)
  - Handle rate limiting and errors

### 2. API Server Extensions
- **New Endpoints**:
  - `POST /api/youtube/search` - Proxy to scraper service
  - `GET /api/youtube/video/:id` - Get video details
- **LLM Tools**:
  - `search_youtube(query)` - Search for videos
  - `play_video(videoId)` - Load video in player

### 3. Frontend Components
- **YouTubeSearchResults**: Display search results
- **YouTubePlayer**: Embedded iframe with IFrame Player API
- **VideoCard**: Thumbnail, title, channel, stats

### 4. LLM Integration
- Detect YouTube search intent from natural language
- Parse user's video selection ("play the first one")
- Control playback via voice commands

## Technology Stack

**Scraper Service**:
- Python 3.11
- Playwright (headless Chromium)
- FastAPI (HTTP server)
- BeautifulSoup4 (HTML parsing)

**Backend**:
- Existing Node.js + TypeScript stack
- Add YouTube tool definitions

**Frontend**:
- React components for video display
- YouTube IFrame Player API
- Socket.io for real-time updates

## Security & Legal Considerations

### Rate Limiting
- Max 10 searches per minute per user
- Cache results for 5 minutes
- Implement exponential backoff

### YouTube TOS Compliance
- Only scrape public search results
- No video downloading
- Use official embed player
- Respect robots.txt

### Privacy
- No user data sent to YouTube (scraping is server-side)
- Don't track video watches
- Clear search history on demand

## Performance Requirements

- **Search Response**: < 3 seconds (including scrape)
- **Video Load**: < 1 second (YouTube player)
- **Concurrent Searches**: Support 5 simultaneous users
- **Caching**: 5-minute TTL for search results

## Future Enhancements

- [ ] Video transcript extraction for LLM context
- [ ] Playlist support
- [ ] Save favorite videos
- [ ] Video recommendations based on viewing history
- [ ] Multiple video queue
- [ ] Picture-in-picture mode for voice chat during playback

## Related Documentation

- [Backend Implementation](./YOUTUBE_BACKEND.md)
- [Frontend Implementation](./YOUTUBE_FRONTEND.md)
- [LLM Integration](./YOUTUBE_LLM_INTEGRATION.md)
- [API Specification](./YOUTUBE_API_SPEC.md)
