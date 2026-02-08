/**
 * YouTube Service - Simple HTTP scraping (no headless browser needed!)
 */

import axios from 'axios';

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

export interface YouTubeSearchResponse {
  query: string;
  results: VideoResult[];
  count: number;
}

/**
 * Search YouTube using simple HTTP scraping
 * No headless browser required - parses ytInitialData from HTML
 */
export async function searchYouTube(
  query: string,
  maxResults: number = 10
): Promise<YouTubeSearchResponse> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    
    // Mimic browser headers (important: only gzip, not brotli)
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate', // Only gzip - no brotli (br)
      'Referer': 'https://www.youtube.com/',
    };
    
    const response = await axios.get(searchUrl, { 
      headers,
      timeout: 10000,
    });
    
    if (response.status !== 200) {
      throw new Error(`YouTube returned status ${response.status}`);
    }
    
    const html = response.data;
    
    // Extract ytInitialData JSON from HTML
    const startMarker = 'var ytInitialData = ';
    const startPos = html.indexOf(startMarker);
    
    if (startPos === -1) {
      throw new Error('Could not find ytInitialData in YouTube response');
    }
    
    const jsonStart = startPos + startMarker.length;
    const jsonEnd = html.indexOf(';</script>', jsonStart);
    
    if (jsonEnd === -1) {
      throw new Error('Could not find end of ytInitialData');
    }
    
    const jsonStr = html.substring(jsonStart, jsonEnd);
    const data = JSON.parse(jsonStr);
    
    // Navigate to video results
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    
    const videos: VideoResult[] = [];
    
    for (const section of contents) {
      if (!section.itemSectionRenderer) continue;
      
      const items = section.itemSectionRenderer.contents || [];
      
      for (const item of items) {
        if (!item.videoRenderer) continue;
        
        const video = item.videoRenderer;
        
        try {
          const videoData: VideoResult = {
            video_id: video.videoId,
            title: video.title?.runs?.[0]?.text || '',
            thumbnail: video.thumbnail?.thumbnails?.[video.thumbnail.thumbnails.length - 1]?.url || '',
            channel: video.ownerText?.runs?.[0]?.text || '',
            channel_url: video.ownerText?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url 
              ? `https://www.youtube.com${video.ownerText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url}`
              : '',
            duration: video.lengthText?.simpleText || 'LIVE',
            views: video.viewCountText?.simpleText || '',
            published: video.publishedTimeText?.simpleText || '',
            description: video.detailedMetadataSnippets?.[0]?.snippetText?.runs?.[0]?.text || '',
          };
          
          videos.push(videoData);
          
          if (videos.length >= maxResults) {
            break;
          }
        } catch (error) {
          // Skip videos that fail to parse
          console.warn('Failed to parse video:', error);
          continue;
        }
      }
      
      if (videos.length >= maxResults) {
        break;
      }
    }
    
    return {
      query,
      results: videos,
      count: videos.length,
    };
  } catch (error) {
    console.error('YouTube search failed:', error);
    throw new Error(`YouTube search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get embed URL for a video
 */
export function getEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}
