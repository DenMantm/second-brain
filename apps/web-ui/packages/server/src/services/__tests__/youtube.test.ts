/**
 * YouTube Service Tests
 * Fetches REAL data once, then reuses for all tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { searchYouTube, getEmbedUrl, type YouTubeSearchResponse } from '../youtube';

// Fetch real data once and reuse
let realSearchResult: YouTubeSearchResponse;
let realSearchResultSmall: YouTubeSearchResponse;

describe('YouTube Service', () => {
  // Fetch real data once before all tests
  beforeAll(async () => {
    console.log('Fetching real YouTube data once...');
    realSearchResult = await searchYouTube('cooking recipes', 10);
    realSearchResultSmall = await searchYouTube('javascript tutorial', 3);
    console.log(`Fetched ${realSearchResult.count} videos (large query)`);
    console.log(`Fetched ${realSearchResultSmall.count} videos (small query)`);
  }, 30000); // 30 second timeout for initial fetch

  describe('searchYouTube', () => {

    it('should search YouTube and parse results correctly', () => {
      // Use pre-fetched real data
      expect(realSearchResult.query).toBe('cooking recipes');
      expect(realSearchResult.count).toBeGreaterThan(0);
      expect(realSearchResult.results.length).toBeGreaterThan(0);
      expect(realSearchResult.results.length).toBeLessThanOrEqual(10);

      // Check first video has all required fields
      const firstVideo = realSearchResult.results[0];
      expect(firstVideo).toHaveProperty('video_id');
      expect(firstVideo).toHaveProperty('title');
      expect(firstVideo).toHaveProperty('channel');
      expect(firstVideo).toHaveProperty('thumbnail');
      expect(firstVideo).toHaveProperty('duration');
      expect(firstVideo).toHaveProperty('views');
      expect(firstVideo).toHaveProperty('published');
      
      // Validate data types and non-empty values
      expect(typeof firstVideo.video_id).toBe('string');
      expect(firstVideo.video_id.length).toBeGreaterThan(0);
      expect(typeof firstVideo.title).toBe('string');
      expect(firstVideo.title.length).toBeGreaterThan(0);
      expect(typeof firstVideo.channel).toBe('string');
      expect(firstVideo.channel.length).toBeGreaterThan(0);
    });

    it('should respect maxResults parameter', () => {
      // Use pre-fetched small query result
      expect(realSearchResultSmall.results.length).toBeGreaterThan(0);
      expect(realSearchResultSmall.results.length).toBeLessThanOrEqual(3);
      expect(realSearchResultSmall.count).toBeLessThanOrEqual(3);
    });

    it('should handle search queries with special characters', async () => {
      // This one makes a real call to test special character encoding
      const result = await searchYouTube('cooking & baking', 3);

      expect(result.query).toBe('cooking & baking');
      expect(result.results.length).toBeGreaterThan(0);
    }, 15000); // Real API call

    it('should successfully scrape without brotli compression', () => {
      // Use pre-fetched data - validates gzip-only approach worked
      expect(realSearchResult.count).toBeGreaterThan(0);
      expect(realSearchResult.results.length).toBeGreaterThan(0);
      // If this passes, it means the header configuration (no brotli) works
    });

    it('should complete within timeout period', async () => {
      // Make a real call to test performance
      const startTime = Date.now();
      const result = await searchYouTube('test query', 3);
      const duration = Date.now() - startTime;

      expect(result.count).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10000); // Should complete in < 10 seconds
    }, 15000); // Real API call

    it('should return valid video metadata', () => {
      // Use pre-fetched data
      // All results should have valid structure
      realSearchResult.results.forEach(video => {
        expect(video.video_id).toBeTruthy();
        expect(video.title).toBeTruthy();
        expect(video.channel).toBeTruthy();
        expect(video.thumbnail).toBeTruthy();
        // Optional fields might be empty but should exist
        expect(video).toHaveProperty('views');
        expect(video).toHaveProperty('published');
        expect(video).toHaveProperty('description');
      });
    });

    it('should handle different video types (regular, live, shorts)', () => {
      // Use pre-fetched data
      expect(realSearchResult.count).toBeGreaterThan(0);
      // Validate that we can handle mixed content types
      realSearchResult.results.forEach(video => {
        expect(typeof video.duration).toBe('string');
        // Duration might be 'LIVE' for live streams or 'X:XX' for regular videos
      });
    });
  });

  describe('getEmbedUrl', () => {
    it('should generate correct embed URL', () => {
      const url = getEmbedUrl('dQw4w9WgXcQ');
      expect(url).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('should handle different video ID formats', () => {
      expect(getEmbedUrl('abc123')).toBe('https://www.youtube.com/embed/abc123');
      expect(getEmbedUrl('xyz-ABC_123')).toBe('https://www.youtube.com/embed/xyz-ABC_123');
    });
  });
});
