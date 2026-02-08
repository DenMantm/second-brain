# YouTube Scraper Backend Implementation

## Service Architecture

### YouTube Scraper Service (Python)

**Location**: `apps/youtube-scraper/`

**Purpose**: Headless browser-based YouTube search scraping

**Tech Stack**:
- Python 3.11
- FastAPI (HTTP API)
- Playwright (headless browser)
- Pydantic (validation)

## Directory Structure

```
apps/youtube-scraper/
├── src/
│   ├── main.py              # FastAPI app entry point
│   ├── scraper.py           # Playwright scraping logic
│   ├── models.py            # Pydantic models
│   ├── config.py            # Configuration
│   └── cache.py             # Redis/in-memory cache
├── tests/
│   ├── test_scraper.py
│   └── test_api.py
├── requirements.txt
├── Dockerfile
└── README.md
```

## Implementation Details

### 1. Scraper Service (scraper.py)

```python
from playwright.async_api import async_playwright, Browser, Page
from typing import List, Dict, Optional
import asyncio
from dataclasses import dataclass

@dataclass
class VideoResult:
    video_id: str
    title: str
    channel: str
    channel_url: str
    thumbnail: str
    duration: str
    views: str
    published: str
    description: str

class YouTubeScraper:
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.context = None
        
    async def initialize(self):
        """Launch headless browser"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        
    async def search(self, query: str, max_results: int = 10) -> List[VideoResult]:
        """Search YouTube and extract video metadata"""
        page = await self.context.new_page()
        
        try:
            # Navigate to search results
            search_url = f"https://www.youtube.com/results?search_query={query}"
            await page.goto(search_url, wait_until='networkidle')
            
            # Wait for video elements to load
            await page.wait_for_selector('ytd-video-renderer', timeout=5000)
            
            # Extract video data
            videos = await page.evaluate('''
                () => {
                    const results = [];
                    const videoElements = document.querySelectorAll('ytd-video-renderer');
                    
                    for (let i = 0; i < videoElements.length; i++) {
                        const el = videoElements[i];
                        
                        try {
                            const titleEl = el.querySelector('#video-title');
                            const channelEl = el.querySelector('#channel-name a');
                            const thumbnailEl = el.querySelector('img');
                            const durationEl = el.querySelector('span.style-scope.ytd-thumbnail-overlay-time-status-renderer');
                            const metadataEls = el.querySelectorAll('#metadata-line span');
                            
                            const videoUrl = titleEl?.href || '';
                            const videoId = videoUrl.match(/v=([^&]+)/)?.[1] || '';
                            
                            if (videoId) {
                                results.push({
                                    video_id: videoId,
                                    title: titleEl?.textContent?.trim() || '',
                                    channel: channelEl?.textContent?.trim() || '',
                                    channel_url: channelEl?.href || '',
                                    thumbnail: thumbnailEl?.src || '',
                                    duration: durationEl?.textContent?.trim() || '',
                                    views: metadataEls[0]?.textContent?.trim() || '',
                                    published: metadataEls[1]?.textContent?.trim() || '',
                                    description: el.querySelector('#description-text')?.textContent?.trim() || ''
                                });
                            }
                        } catch (e) {
                            console.error('Error parsing video:', e);
                        }
                    }
                    
                    return results;
                }
            ''')
            
            return [VideoResult(**v) for v in videos[:max_results]]
            
        finally:
            await page.close()
            
    async def close(self):
        """Cleanup browser resources"""
        if self.browser:
            await self.browser.close()
```

### 2. FastAPI Service (main.py)

```python
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import asyncio
from datetime import datetime, timedelta
import logging

from scraper import YouTubeScraper, VideoResult
from cache import Cache

app = FastAPI(title="YouTube Scraper Service")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3030"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global scraper instance
scraper: Optional[YouTubeScraper] = None
cache = Cache(ttl=300)  # 5-minute cache

class SearchRequest(BaseModel):
    query: str
    max_results: int = 10

class SearchResponse(BaseModel):
    query: str
    results: List[VideoResult]
    cached: bool
    timestamp: datetime

@app.on_event("startup")
async def startup_event():
    """Initialize browser on startup"""
    global scraper
    scraper = YouTubeScraper()
    await scraper.initialize()
    logging.info("YouTube scraper initialized")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup browser on shutdown"""
    if scraper:
        await scraper.close()
    logging.info("YouTube scraper closed")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "youtube-scraper",
        "browser_ready": scraper is not None
    }

@app.post("/search", response_model=SearchResponse)
async def search_youtube(request: SearchRequest):
    """Search YouTube and return video results"""
    if not scraper:
        raise HTTPException(status_code=503, detail="Scraper not initialized")
    
    # Check cache
    cache_key = f"search:{request.query}:{request.max_results}"
    cached_results = cache.get(cache_key)
    
    if cached_results:
        return SearchResponse(
            query=request.query,
            results=cached_results,
            cached=True,
            timestamp=datetime.now()
        )
    
    try:
        # Perform search
        results = await scraper.search(request.query, request.max_results)
        
        # Cache results
        cache.set(cache_key, results)
        
        return SearchResponse(
            query=request.query,
            results=results,
            cached=False,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logging.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/video/{video_id}")
async def get_video_details(video_id: str):
    """Get details for a specific video (placeholder for future enhancement)"""
    return {
        "video_id": video_id,
        "embed_url": f"https://www.youtube.com/embed/{video_id}"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3003)
```

### 3. Cache Implementation (cache.py)

```python
from typing import Any, Optional
from datetime import datetime, timedelta
import json

class Cache:
    """Simple in-memory cache with TTL"""
    
    def __init__(self, ttl: int = 300):
        self.ttl = ttl  # seconds
        self.store = {}
        
    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired"""
        if key in self.store:
            value, expiry = self.store[key]
            if datetime.now() < expiry:
                return value
            else:
                del self.store[key]
        return None
        
    def set(self, key: str, value: Any):
        """Store value with expiry"""
        expiry = datetime.now() + timedelta(seconds=self.ttl)
        self.store[key] = (value, expiry)
        
    def clear(self):
        """Clear all cached values"""
        self.store.clear()
```

### 4. Configuration (config.py)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Service
    host: str = "0.0.0.0"
    port: int = 3003
    
    # Browser
    headless: bool = True
    viewport_width: int = 1920
    viewport_height: int = 1080
    
    # Scraping
    max_results: int = 20
    search_timeout: int = 10000  # ms
    cache_ttl: int = 300  # seconds
    
    # Rate limiting
    max_searches_per_minute: int = 10
    
    class Config:
        env_prefix = "YOUTUBE_SCRAPER_"
        env_file = ".env"

settings = Settings()
```

## API Server Integration

### Node.js Proxy (apps/web-ui/packages/server)

**New file**: `src/services/youtube.ts`

```typescript
import axios from 'axios';

const YOUTUBE_SCRAPER_URL = process.env.YOUTUBE_SCRAPER_URL || 'http://localhost:3003';

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

export interface SearchResponse {
  query: string;
  results: VideoResult[];
  cached: boolean;
  timestamp: string;
}

export class YouTubeService {
  async search(query: string, maxResults: number = 10): Promise<SearchResponse> {
    try {
      const response = await axios.post<SearchResponse>(
        `${YOUTUBE_SCRAPER_URL}/search`,
        { query, max_results: maxResults },
        { timeout: 15000 }
      );
      
      return response.data;
    } catch (error) {
      console.error('YouTube search failed:', error);
      throw new Error('Failed to search YouTube');
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${YOUTUBE_SCRAPER_URL}/health`);
      return response.data.status === 'healthy';
    } catch {
      return false;
    }
  }
}

export const youtubeService = new YouTubeService();
```

**New routes**: `src/routes/youtube.routes.ts`

```typescript
import { Router } from 'express';
import { youtubeService } from '../services/youtube';

const router = Router();

router.post('/search', async (req, res) => {
  try {
    const { query, maxResults = 10 } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await youtubeService.search(query, maxResults);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/health', async (req, res) => {
  const healthy = await youtubeService.healthCheck();
  res.json({ healthy });
});

export default router;
```

## Deployment

### Docker Setup

**Dockerfile** (`apps/youtube-scraper/Dockerfile`):

```dockerfile
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install chromium

# Copy application
COPY src/ ./src/

# Expose port
EXPOSE 3003

# Run service
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3003"]
```

**docker-compose.yml** addition:

```yaml
youtube-scraper:
  build: ./apps/youtube-scraper
  ports:
    - "3003:3003"
  environment:
    - YOUTUBE_SCRAPER_HEADLESS=true
    - YOUTUBE_SCRAPER_CACHE_TTL=300
  restart: unless-stopped
```

## Error Handling

- **Browser crashes**: Auto-restart browser on failure
- **Timeout**: 10-second max per search
- **Rate limiting**: 10 searches/minute per user
- **Invalid results**: Filter out videos without IDs
- **Network errors**: Retry with exponential backoff

## Monitoring

- Log all searches with timestamps
- Track scraping success rate
- Monitor browser memory usage
- Alert on repeated failures
