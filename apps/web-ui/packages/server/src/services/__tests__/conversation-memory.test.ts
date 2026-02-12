import { describe, it, expect, vi } from 'vitest';
import { sendMessageStream } from '../conversation-memory';
import { youtubeTools } from '../../tools/youtube-tools';

vi.mock('../conversation-storage', () => ({
  addMessageToConversation: vi.fn(),
  getConversationMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../tools/youtube-tools', () => ({
  youtubeTools: [
    {
      name: 'search_youtube',
      invoke: vi.fn().mockResolvedValue(
        JSON.stringify({ success: true, message: 'ok' })
      ),
    },
  ],
  youtubeToolsDocumentation: {
    category: 'YOUTUBE CAPABILITIES',
    description: 'Test description',
    tools: [],
    validExamples: [],
    instructions: [],
  },
}));

vi.mock('../../tools/web-search-tools', () => ({
  webSearchTools: [],
  webSearchToolsDocumentation: {
    category: 'WEB SEARCH CAPABILITIES',
    description: 'Test description', 
    tools: [],
    validExamples: [],
    instructions: [],
  },
}));

const createStream = async function* () {
  yield {
    content: '',
    tool_call_chunks: [
      {
        index: 0,
        name: 'search_youtube',
        args: '{"query":"scare',
      },
    ],
  };
  yield {
    content: '',
    tool_call_chunks: [
      {
        index: 0,
        args: 'crow"}',
      },
    ],
  };
};

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    bindTools: () => ({
      stream: () => createStream(),
    }),
  })),
}));

describe('sendMessageStream', () => {
  it('should assemble tool_call_chunks into complete args', async () => {
    const stream = await sendMessageStream('test-session', 'Search YouTube for scarecrow');
    const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    for await (const chunk of stream) {
      if (typeof chunk === 'object' && chunk?.type === 'tool_call') {
        toolCalls.push({
          name: chunk.data.name,
          args: chunk.data.args ?? {},
        });
      }
    }

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].name).toBe('search_youtube');
    expect(toolCalls[0].args).toMatchObject({ query: 'scarecrow' });
    expect(youtubeTools[0].invoke).toHaveBeenCalled();
  });
});
