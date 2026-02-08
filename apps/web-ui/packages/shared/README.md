# @second-brain/shared

Shared types and interfaces for the Second Brain project.

## Purpose

This package contains common TypeScript interfaces and types that are shared between the client and server packages, ensuring type consistency across the application.

## Structure

```
src/
├── message.types.ts      # Message and conversation message types
├── conversation.types.ts # Conversation metadata types
├── youtube.types.ts      # YouTube integration types
├── tool.types.ts         # LangChain tool types
└── index.ts             # Main export file
```

## Usage

### In Server (Future)

```typescript
import { Message, ToolResult, YouTubeSearchResult } from '@second-brain/shared';
```

### In Client

Currently, types are defined locally in `packages/client/src/types/index.ts` to avoid circular dependencies and build complexity.

**Future improvement**: Set up proper workspace linking so both client and server can import from this shared package.

## Type Categories

### Message Types
- `Message` - Individual conversation message
- `MessageMetadata` - Optional metadata for messages
- `MessageRole` - 'user' | 'assistant' | 'system'

### Conversation Types
- `Conversation` - Conversation metadata
- `ConversationListItem` - Extended conversation with UI fields

### YouTube Types
- `VideoResult` - Individual video from search
- `YouTubeSearchResult` - Search results container
- `YouTubePlayerAction` - Player control actions
- Tool result types: `SearchYouTubeResult`, `PlayVideoResult`, `ControlPlayerResult`

### Tool Types
- `ToolCall` - LangChain tool invocation
- `ToolResult` - Generic tool result
- `YouTubeToolName` - Specific YouTube tool names
- `ToolCallChunk` - Streaming tool call chunk

## Building

```bash
npm run build
```

This compiles TypeScript to JavaScript with type definitions in the `dist/` directory.

## Next Steps

1. Set up workspace references in `tsconfig.json`
2. Update client to import from `@second-brain/shared`
3. Update server to import from `@second-brain/shared`
4. Remove duplicate type definitions
