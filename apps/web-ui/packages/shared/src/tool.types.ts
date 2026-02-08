/**
 * Tool Types
 * Shared between client and server for LangChain tool integration
 */

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

// Specific tool names
export type YouTubeToolName = 
  | 'search_youtube'
  | 'play_youtube_video'
  | 'control_youtube_player';

export type ToolName = YouTubeToolName; // Add more as needed

export interface ToolCallChunk {
  type: 'tool_call';
  name: string;
  args: Record<string, unknown>;
}
