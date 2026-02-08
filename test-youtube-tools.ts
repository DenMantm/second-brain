/**
 * Test YouTube LLM Tools
 * 
 * This demonstrates how the LangChain YouTube tools work with the LLM
 * 
 * Run with: npx tsx test-youtube-tools.ts
 */

import { searchYouTube } from './apps/web-ui/packages/server/src/services/youtube';
import { youtubeTools } from './apps/web-ui/packages/server/src/tools/youtube-tools';

async function testYouTubeSearch() {
  console.log('='.repeat(60));
  console.log('Testing YouTube Search Service');
  console.log('='.repeat(60));
  
  try {
    const results = await searchYouTube('cooking recipes', 5);
    
    console.log(`\nFound ${results.count} videos for "${results.query}":\n`);
    
    results.results.forEach((video, idx) => {
      console.log(`${idx + 1}. ${video.title}`);
      console.log(`   Channel: ${video.channel}`);
      console.log(`   Views: ${video.views} | Duration: ${video.duration}`);
      console.log(`   Video ID: ${video.video_id}`);
      console.log();
    });
  } catch (error) {
    console.error('Search failed:', error);
  }
}

async function testYouTubeTools() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing YouTube LangChain Tools');
  console.log('='.repeat(60));
  
  // Test search tool
  const searchTool = youtubeTools[0]; // search_youtube
  console.log(`\nTool: ${searchTool.name}`);
  console.log(`Description: ${searchTool.description}`);
  
  try {
    const searchResult = await searchTool.invoke({
      query: 'jazz music',
      max_results: 3,
    });
    
    console.log('\nSearch Result:');
    console.log(searchResult);
  } catch (error) {
    console.error('Tool execution failed:', error);
  }
  
  // Test play tool
  console.log('\n' + '-'.repeat(60));
  const playTool = youtubeTools[1]; // play_youtube_video
  console.log(`\nTool: ${playTool.name}`);
  console.log(`Description: ${playTool.description}`);
  
  try {
    const playResult = await playTool.invoke({ index: 1 });
    console.log('\nPlay Result:');
    console.log(playResult);
  } catch (error) {
    console.error('Tool execution failed:', error);
  }
  
  // Test control tool
  console.log('\n' + '-'.repeat(60));
  const controlTool = youtubeTools[2]; // control_youtube_player
  console.log(`\nTool: ${controlTool.name}`);
  console.log(`Description: ${controlTool.description}`);
  
  try {
    const controlResult = await controlTool.invoke({
      action: 'volume',
      value: 75,
    });
    console.log('\nControl Result:');
    console.log(controlResult);
  } catch (error) {
    console.error('Tool execution failed:', error);
  }
}

async function main() {
  console.log('\n🎵 YouTube LLM Tools Test Suite\n');
  
  await testYouTubeSearch();
  await testYouTubeTools();
  
  console.log('\n✅ Tests complete!\n');
}

main().catch(console.error);
