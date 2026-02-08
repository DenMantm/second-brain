/**
 * YouTube Integration Tests
 * Tests real LLM with tool calling against actual YouTube search
 * 
 * These tests are SKIPPED by default because they:
 * - Require LLM service running (localhost:1234)
 * - Make real YouTube API calls
 * - Take 30+ seconds to complete
 * 
 * To run:
 *   npm run test:integration
 *   or
 *   RUN_INTEGRATION_TESTS=true npm test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ChatOpenAI } from '@langchain/openai';
import type { Runnable } from '@langchain/core/runnables';
import type { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import type { AIMessageChunk } from '@langchain/core/messages';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { youtubeTools } from '../youtube-tools';
import { sendMessageStream } from '../../services/conversation-memory';
import { config } from '../../config';

// Skip these tests by default (too slow for regular test runs)
const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = shouldRunIntegrationTests ? describe : describe.skip;

describeIntegration('YouTube LLM Integration', () => {
  let llm: ChatOpenAI;

  beforeAll(() => {
    console.log('\n' + '='.repeat(80));
    console.log('🤖 REAL LLM INTEGRATION TEST');
    console.log('='.repeat(80));
    console.log('LLM Service URL:', config.llmServiceUrl);
    console.log('Model:', 'openai/gpt-oss-20b');
    console.log('Tools bound:', youtubeTools.map(t => t.name).join(', '));
    console.log('='.repeat(80) + '\n');

    // Initialize real LLM with tool binding
    const baseLlm = new ChatOpenAI({
      apiKey: 'sk-dummy-key-for-local-llm',
      modelName: 'openai/gpt-oss-20b',
      temperature: 0.7,
      maxTokens: 2048,
      configuration: {
        baseURL: config.llmServiceUrl,
      },
    });

    llm = baseLlm.bindTools(youtubeTools);
  });

  it('should use search_youtube tool when asked to search', async () => {
    const systemPrompt = `You are a helpful assistant with YouTube search capabilities.
When the user asks to search YouTube, use the search_youtube tool.
Available tools:
- search_youtube: Search for YouTube videos

Be concise in your responses.`;

    const userMessage = 'Search YouTube for cooking recipes';

    console.log('\n' + '-'.repeat(80));
    console.log('📨 USER MESSAGE:', userMessage);
    console.log('-'.repeat(80));

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ];

    const response = await llm.invoke(messages);

    console.log('\n🤖 LLM RESPONSE:');
    console.log('  Text content:', response.content || '(no text, only tool call)');
    console.log('  Tool calls:', response.tool_calls?.length || 0);
    if (response.tool_calls && response.tool_calls.length > 0) {
      response.tool_calls.forEach((tc, idx) => {
        console.log(`\n  Tool Call #${idx + 1}:`);
        console.log('    Name:', tc.name);
        console.log('    Args:', JSON.stringify(tc.args, null, 6));
      });
    }
    console.log('-'.repeat(80) + '\n');

    // LLM should have made a tool call
    expect(response.tool_calls).toBeDefined();
    expect(response.tool_calls!.length).toBeGreaterThan(0);

    const toolCall = response.tool_calls![0];
    
    // Should be calling search_youtube
    expect(toolCall.name).toBe('search_youtube');
    
    // Should have query parameter
    expect(toolCall.args).toHaveProperty('query');
    expect(toolCall.args.query).toContain('cooking');
    
    console.log('✓ LLM correctly identified search intent');
    console.log('  Tool call:', toolCall.name);
    console.log('  Args:', JSON.stringify(toolCall.args, null, 2));
  }, 30000); // 30 second timeout for LLM call

  it('should use tool args in real streaming code path', async () => {
    const sessionId = `integration-${Date.now()}`;
    const userMessage = 'Search YouTube for videos about scarecrows';

    const stream = await sendMessageStream(sessionId, userMessage, {
      temperature: 0.2,
      maxTokens: 512,
    });

    const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    for await (const chunk of stream) {
      if (typeof chunk === 'object' && chunk?.type === 'tool_call') {
        toolCalls.push({
          name: chunk.data.name,
          args: chunk.data.args ?? {},
        });
      }
    }

    expect(toolCalls.length).toBeGreaterThan(0);
    const searchCall = toolCalls.find(c => c.name === 'search_youtube');
    expect(searchCall).toBeDefined();
    expect(searchCall?.args).toHaveProperty('query');
    expect(String(searchCall?.args.query || '')).toContain('scarecrow');
  }, 60000);

  it('should execute tool and return real YouTube results', async () => {
    const systemPrompt = `You are a helpful assistant with YouTube capabilities.
When user asks to search YouTube, use search_youtube tool.
After tool returns results, describe the top video naturally.`;

    const userMessage = 'Find me some guitar tutorial videos on YouTube';

    console.log('\n' + '-'.repeat(80));
    console.log('📨 USER MESSAGE:', userMessage);
    console.log('-'.repeat(80));

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ];

    // First LLM call - should return tool call
    const firstResponse = await llm.invoke(messages);

    console.log('\n🤖 LLM RESPONSE (First):', firstResponse.content || '(tool call only)');
    console.log('  Tool calls:', firstResponse.tool_calls?.length || 0);
    if (firstResponse.tool_calls && firstResponse.tool_calls.length > 0) {
      console.log('  Tool:', firstResponse.tool_calls[0].name);
      console.log('  Args:', JSON.stringify(firstResponse.tool_calls[0].args, null, 4));
    }
    
    expect(firstResponse.tool_calls).toBeDefined();
    expect(firstResponse.tool_calls!.length).toBeGreaterThan(0);

    const toolCall = firstResponse.tool_calls![0];
    expect(toolCall.name).toBe('search_youtube');

    // Execute the tool
    const tool = youtubeTools.find(t => t.name === toolCall.name);
    expect(tool).toBeDefined();

    console.log('\n⚙️  EXECUTING TOOL:', toolCall.name);
    // @ts-expect-error - Tool invocation type compatibility
    const toolResult = await tool!.invoke(toolCall.args);
    const parsedResult = JSON.parse(toolResult);

    console.log('\n📦 TOOL RESULT:');
    console.log('  Success:', parsedResult.success);
    console.log('  Count:', parsedResult.count);
    console.log('  First video:', parsedResult.results[0].title);
    console.log('  Channel:', parsedResult.results[0].channel);

    // Validate tool execution returned real results
    expect(parsedResult.success).toBe(true);
    expect(parsedResult.count).toBeGreaterThan(0);
    expect(parsedResult.results).toBeDefined();
    expect(parsedResult.results.length).toBeGreaterThan(0);

    // Validate result structure
    const firstVideo = parsedResult.results[0];
    expect(firstVideo).toHaveProperty('index');
    expect(firstVideo).toHaveProperty('title');
    expect(firstVideo).toHaveProperty('channel');
    expect(firstVideo).toHaveProperty('videoId');
    expect(firstVideo.title).toBeTruthy();

    console.log('✓ Tool executed successfully');
    console.log('  Query:', toolCall.args.query);
    console.log('  Results count:', parsedResult.count);
    console.log('  First video:', firstVideo.title);
    console.log('  Channel:', firstVideo.channel);

    // Now send tool result back to LLM for natural language response
    console.log('\n📨 SENDING TOOL RESULT BACK TO LLM...');
    const messagesWithToolResult = [
      ...messages,
      firstResponse,
      new HumanMessage(`Tool result: ${toolResult}`),
    ];

    const finalResponse = await llm.invoke(messagesWithToolResult);
    
    console.log('\n🤖 LLM FINAL RESPONSE:');
    console.log(finalResponse.content.toString());
    console.log('-'.repeat(80) + '\n');

    // LLM should respond with natural language about the results
    expect(finalResponse.content).toBeDefined();
    expect(typeof finalResponse.content).toBe('string');
    expect(finalResponse.content.toString().length).toBeGreaterThan(0);

    console.log('✓ LLM generated natural response');
    console.log('  Response length:', finalResponse.content.toString().length, 'characters');
  }, 45000); // 45 seconds for full round-trip

  it('should handle play_youtube_video tool after search', async () => {
    const systemPrompt = `You are a helpful assistant with YouTube capabilities.
Available tools: search_youtube, play_youtube_video
When user searches, use search_youtube. When they ask to play a video by number, use play_youtube_video with the index.`;

    console.log('\n' + '-'.repeat(80));
    console.log('📨 USER MESSAGE: Search YouTube for piano music');
    console.log('-'.repeat(80));

    // Simulate a search was already done
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage('Search YouTube for piano music'),
    ];

    const searchResponse = await llm.invoke(messages);
    console.log('🤖 LLM RESPONSE: Tool call ->', searchResponse.tool_calls?.[0]?.name);
    expect(searchResponse.tool_calls).toBeDefined();
    
    const searchTool = youtubeTools.find(t => t.name === 'search_youtube');
    // @ts-expect-error - Tool invocation type compatibility
    const searchResult = await searchTool!.invoke(searchResponse.tool_calls![0].args);

    console.log('✓ Performed search, got results');

    // Now ask to play the first video
    console.log('\n📨 USER MESSAGE: Play the first one');
    const playMessages = [
      ...messages,
      searchResponse,
      new HumanMessage(`Tool result: ${searchResult}`),
      new HumanMessage('Play the first one'),
    ];

    const playResponse = await llm.invoke(playMessages);
    
    console.log('🤖 LLM RESPONSE:');
    console.log('  Tool call:', playResponse.tool_calls?.[0]?.name);
    console.log('  Args:', JSON.stringify(playResponse.tool_calls?.[0]?.args, null, 4));
    console.log('-'.repeat(80) + '\n');
    
    // LLM should call play_youtube_video
    expect(playResponse.tool_calls).toBeDefined();
    expect(playResponse.tool_calls!.length).toBeGreaterThan(0);

    const playToolCall = playResponse.tool_calls![0];
    expect(playToolCall.name).toBe('play_youtube_video');
    
    // Should have index parameter set to 1
    expect(playToolCall.args).toHaveProperty('index');
    expect(playToolCall.args.index).toBe(1);

    console.log('✓ LLM correctly identified play intent');
    console.log('  Tool call:', playToolCall.name);
    console.log('  Index:', playToolCall.args.index);
  }, 60000); // 60 seconds for multi-step conversation

  it('should use control_youtube_player for playback controls', async () => {
    const systemPrompt = `You are a helpful assistant with YouTube playback controls.
When user asks to pause, play, seek, or adjust volume, use control_youtube_player tool.`;

    console.log('\n' + '-'.repeat(80));
    console.log('📨 USER MESSAGE: Pause the video');
    console.log('-'.repeat(80));

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage('Pause the video'),
    ];

    const response = await llm.invoke(messages);
    
    console.log('🤖 LLM RESPONSE:');
    console.log('  Tool call:', response.tool_calls?.[0]?.name);
    console.log('  Args:', JSON.stringify(response.tool_calls?.[0]?.args, null, 4));
    console.log('-'.repeat(80) + '\n');

    expect(response.tool_calls).toBeDefined();
    expect(response.tool_calls!.length).toBeGreaterThan(0);

    const toolCall = response.tool_calls![0];
    expect(toolCall.name).toBe('control_youtube_player');
    expect(toolCall.args).toHaveProperty('action');
    expect(toolCall.args.action).toBe('pause');

    console.log('✓ LLM correctly identified pause control');
    console.log('  Tool call:', toolCall.name);
    console.log('  Action:', toolCall.args.action);
  }, 30000);

  it('should handle volume control with value', async () => {
    const systemPrompt = `You are a helpful assistant with YouTube playback controls.
When user asks to change volume, use control_youtube_player with action='volume' and the value.`;

    console.log('\n' + '-'.repeat(80));
    console.log('📨 USER MESSAGE: Set volume to 50 percent');
    console.log('-'.repeat(80));

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage('Set volume to 50 percent'),
    ];

    const response = await llm.invoke(messages);
    
    console.log('🤖 LLM RESPONSE:');
    console.log('  Tool call:', response.tool_calls?.[0]?.name);
    console.log('  Args:', JSON.stringify(response.tool_calls?.[0]?.args, null, 4));
    console.log('-'.repeat(80) + '\n');

    expect(response.tool_calls).toBeDefined();
    expect(response.tool_calls!.length).toBeGreaterThan(0);

    const toolCall = response.tool_calls![0];
    expect(toolCall.name).toBe('control_youtube_player');
    expect(toolCall.args.action).toBe('volume');
    expect(toolCall.args.value).toBe(50);

    console.log('✓ LLM correctly parsed volume command');
    console.log('  Action:', toolCall.args.action);
    console.log('  Value:', toolCall.args.value);
  }, 30000);

  it('should handle seek command with time', async () => {
    const systemPrompt = `You are a helpful assistant with YouTube playback controls.
When user asks to skip/seek to a time, use control_youtube_player with action='seek' and value in seconds.`;

    console.log('\n' + '-'.repeat(80));
    console.log('📨 USER MESSAGE: Skip to 2 minutes and 30 seconds');
    console.log('-'.repeat(80));

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage('Skip to 2 minutes and 30 seconds'),
    ];

    const response = await llm.invoke(messages);
    
    console.log('🤖 LLM RESPONSE:');
    console.log('  Tool call:', response.tool_calls?.[0]?.name);
    console.log('  Args:', JSON.stringify(response.tool_calls?.[0]?.args, null, 4));
    console.log('-'.repeat(80) + '\n');

    expect(response.tool_calls).toBeDefined();
    const toolCall = response.tool_calls![0];
    
    expect(toolCall.name).toBe('control_youtube_player');
    expect(toolCall.args.action).toBe('seek');
    expect(toolCall.args.value).toBe(150); // 2:30 = 150 seconds

    console.log('✓ LLM correctly converted time to seconds');
    console.log('  Time requested: 2:30');
    console.log('  Seconds:', toolCall.args.value);
  }, 30000);
});
