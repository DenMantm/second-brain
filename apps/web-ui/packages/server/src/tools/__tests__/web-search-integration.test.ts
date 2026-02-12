/**
 * DuckDuckGo & Web Search Integration Tests
 * Tests real LLM tool calling and web search scraping
 *
 * These tests are SKIPPED by default because they:
 * - Require LLM service running (localhost:1234)
 * - Make real DuckDuckGo requests
 * - Take 30+ seconds to complete
 *
 * To run:
 *   npm run test:integration
 *   or
 *   RUN_INTEGRATION_TESTS=true npm test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { webSearchTools } from '../web-search-tools';
import { sendMessageStream } from '../../services/conversation-memory';
import { config } from '../../config';

const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = shouldRunIntegrationTests ? describe : describe.skip;

describeIntegration('Web Search Integration', () => {
  let llm: ChatOpenAI;

  beforeAll(() => {
    console.log('\n' + '='.repeat(80));
    console.log('🤖 REAL LLM INTEGRATION TEST - WEB SEARCH');
    console.log('='.repeat(80));
    console.log('LLM Service URL:', config.llmServiceUrl);
    console.log('Model:', 'openai/gpt-oss-20b');
    console.log('Tools bound:', webSearchTools.map(t => t.name).join(', '));
    console.log('='.repeat(80) + '\n');

    const baseLlm = new ChatOpenAI({
      apiKey: 'sk-dummy-key-for-local-llm',
      modelName: 'openai/gpt-oss-20b',
      temperature: 0.7,
      maxTokens: 2048,
      configuration: {
        baseURL: config.llmServiceUrl,
      },
    });

    llm = baseLlm.bindTools(webSearchTools);
  });

  it('should use web_search tool when asked to search the web', async () => {
    const systemPrompt = `You are a helpful assistant with web search capabilities.
When the user asks to search the web, use the web_search tool.
Available tools:
- web_search: Search the web

Be concise in your responses.`;

    const userMessage = 'Search the web for quantum physics';

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

    expect(response.tool_calls).toBeDefined();
    expect(response.tool_calls!.length).toBeGreaterThan(0);

    const toolCall = response.tool_calls![0];
    expect(toolCall.name).toBe('web_search');
    expect(toolCall.args).toHaveProperty('query');
    expect(String(toolCall.args.query)).toContain('quantum');

    console.log('✓ LLM correctly identified web search intent');
    console.log('  Tool call:', toolCall.name);
    console.log('  Args:', JSON.stringify(toolCall.args, null, 2));
  }, 30000);

  it('should use tool args in real streaming code path', async () => {
    const sessionId = `integration-websearch-${Date.now()}`;
    const userMessage = 'Web search for open source LLMs';

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
    const searchCall = toolCalls.find(c => c.name === 'web_search');
    expect(searchCall).toBeDefined();
    expect(searchCall?.args).toHaveProperty('query');
    expect(String(searchCall?.args.query || '')).toContain('open source');
  }, 60000);

  it('should execute tool and include DuckDuckGo results', async () => {
    const systemPrompt = `You are a helpful assistant with web search capabilities.
When user asks to search the web, use web_search tool.
After tool returns results, describe the top result naturally.`;

    const userMessage = 'Find web results about the Rust programming language';

    console.log('\n' + '-'.repeat(80));
    console.log('📨 USER MESSAGE:', userMessage);
    console.log('-'.repeat(80));

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ];

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
    expect(toolCall.name).toBe('web_search');

    const tool = webSearchTools.find(t => t.name === toolCall.name);
    expect(tool).toBeDefined();

    console.log('\n⚙️  EXECUTING TOOL:', toolCall.name);
    // @ts-expect-error - Tool invocation type compatibility
    const toolResult = await tool!.invoke(toolCall.args);
    const parsedResult = JSON.parse(toolResult);

    console.log('\n📦 TOOL RESULT:');
    console.log('  Success:', parsedResult.success);
    console.log('  Wikipedia count:', parsedResult.results?.length || 0);
    console.log('  DuckDuckGo count:', parsedResult.duckduckgoResults?.length || 0);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.results).toBeDefined();
    expect(parsedResult.duckduckgoResults).toBeDefined();

    if (parsedResult.duckduckgoResults.length > 0) {
      const firstDdg = parsedResult.duckduckgoResults[0];
      expect(firstDdg).toHaveProperty('title');
      expect(firstDdg).toHaveProperty('url');
      expect(firstDdg.title).toBeTruthy();
      expect(firstDdg.url).toBeTruthy();
    }

    console.log('✓ Tool executed successfully with DuckDuckGo results');
  }, 60000);
});
