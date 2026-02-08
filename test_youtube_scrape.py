#!/usr/bin/env python3
"""
Test YouTube scraping without headless browser
"""

import requests
import json
import re
from typing import List, Dict

def scrape_youtube_search(query: str, max_results: int = 10) -> List[Dict]:
    """
    Scrape YouTube search results using only HTTP requests
    """
    # Create a session to persist cookies
    session = requests.Session()
    
    # First, visit YouTube homepage to get cookies (appear more like a browser)
    print("Visiting YouTube homepage to get cookies...")
    session.get('https://www.youtube.com', timeout=10)
    
    # Prepare search URL
    search_url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
    
    #More complete browser headers
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',  # Only gzip, no Brotli (br)
        'Referer': 'https://www.youtube.com/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Cache-Control': 'max-age=0',
    }
    
    # Make request
    print(f"Fetching: {search_url}")
    response = session.get(search_url, headers=headers, timeout=10)
    
    if response.status_code != 200:
        raise Exception(f"HTTP {response.status_code}: {response.reason}")
    
    # Ensure content is decoded (requests should handle gzip automatically)
    response.encoding = response.apparent_encoding or 'utf-8'
    html_content = response.text
    
    print(f"Response size: {len(html_content)} bytes")
    print(f"Encoding: {response.encoding}")
    print(f"Cookies: {len(session.cookies)}")
    print(f"Content-Type: {response.headers.get('Content-Type')}")
    print(f"Content-Encoding: {response.headers.get('Content-Encoding', 'none')}")
    
    # Check first 200 chars to see what we got
    preview = html_content[:200].replace('\n', ' ')
    print(f"Preview: {preview}...")
    
    # Extract ytInitialData JSON from HTML
    # YouTube embeds data in: var ytInitialData = {....};
    # Use non-greedy match and find the end of the JSON object
    
    # Find start of ytInitialData
    start_marker = 'var ytInitialData = '
    start_pos = html_content.find(start_marker)
    
    if start_pos == -1:
        print("❌ Could not find ytInitialData in HTML")
        # Save HTML for debugging
        with open('youtube_debug.txt', 'w', encoding='utf-8') as f:
            f.write(html_content[:5000])
        print("Saved first 5000 chars to youtube_debug.txt")
        return []
    
    # Find end of JSON (look for };</script> which marks the end)
    start_pos += len(start_marker)
    end_pos = html_content.find(';</script>', start_pos)
    
    if end_pos == -1:
        print("❌ Could not find end of ytInitialData")
        return []
    
    json_str = html_content[start_pos:end_pos]
    print(f"✅ Found ytInitialData JSON ({len(json_str)} bytes)")
    
    # Parse JSON
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e}")
        # Save JSON for debugging
        with open('youtube_debug.json', 'w', encoding='utf-8') as f:
            f.write(json_str[:10000])
        print("Saved first 10KB to youtube_debug.json")
        return []
    
    # Navigate to video results
    # Path: contents > twoColumnSearchResultsRenderer > primaryContents > sectionListRenderer > contents
    try:
        contents = data['contents']['twoColumnSearchResultsRenderer']['primaryContents']['sectionListRenderer']['contents']
    except KeyError as e:
        print(f"❌ Could not navigate JSON structure: {e}")
        # Save JSON for inspection
        with open('youtube_debug.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print("Saved JSON to youtube_debug.json")
        return []
    
    videos = []
    
    # Extract video data
    for section in contents:
        if 'itemSectionRenderer' not in section:
            continue
        
        items = section['itemSectionRenderer'].get('contents', [])
        
        for item in items:
            if 'videoRenderer' not in item:
                continue
            
            video = item['videoRenderer']
            
            try:
                video_data = {
                    'video_id': video['videoId'],
                    'title': video['title']['runs'][0]['text'],
                    'thumbnail': video['thumbnail']['thumbnails'][-1]['url'],
                    'channel': video['ownerText']['runs'][0]['text'],
                    'channel_url': 'https://www.youtube.com' + video['ownerText']['runs'][0]['navigationEndpoint']['commandMetadata']['webCommandMetadata']['url'],
                    'duration': video.get('lengthText', {}).get('simpleText', 'LIVE'),
                    'views': video.get('viewCountText', {}).get('simpleText', ''),
                    'published': video.get('publishedTimeText', {}).get('simpleText', ''),
                    'description': video.get('detailedMetadataSnippets', [{}])[0].get('snippetText', {}).get('runs', [{}])[0].get('text', ''),
                }
                
                videos.append(video_data)
                
                if len(videos) >= max_results:
                    break
            except (KeyError, IndexError, TypeError) as e:
                print(f"⚠️  Skipping video due to parse error: {e}")
                continue
        
        if len(videos) >= max_results:
            break
    
    return videos


if __name__ == '__main__':
    print("Testing YouTube scraping without headless browser\n")
    
    # Test search
    results = scrape_youtube_search('cooking recipes', max_results=5)
    
    if results:
        print(f"\nSuccessfully scraped {len(results)} videos:\n")
        for i, video in enumerate(results, 1):
            print(f"{i}. {video['title']}")
            print(f"   Channel: {video['channel']}")
            print(f"   Views: {video['views']} | Duration: {video['duration']}")
            print(f"   Video ID: {video['video_id']}")
            print()
        
        # Save to JSON
        with open('youtube_results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2)
        print("Results saved to youtube_results.json")
    else:
        print("\nNo videos found")
