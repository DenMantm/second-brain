# Custom Hooks

This directory contains reusable React hooks that encapsulate common logic and state management patterns.

## Available Hooks

### Voice & Audio Hooks

#### `useWakeWord(options)`
Manages wake word detection initialization and lifecycle.

**Options:**
- `selectedWakeWord?: string` - Wake word to detect (default: 'go')
- `threshold?: number` - Detection confidence threshold (default: 0.75)
- `onDetected?: () => void | Promise<void>` - Callback when wake word detected

**Returns:**
- `initialize(wakeWord, threshold?)` - Initialize wake word detection
- `start()` - Start listening for wake word
- `stop()` - Stop listening
- `isListening()` - Check if currently listening
- `isInitialized()` - Check if service is initialized
- `setDetectionCallback(callback)` - Update detection callback

**Example:**
```typescript
const { initialize, start, stop, isListening } = useWakeWord({
  selectedWakeWord: 'go',
  onDetected: async () => {
    console.log('Wake word detected!');
    await handleRecording();
  }
});

await initialize('go', 0.75);
await start();
// ... later
await stop();
```

#### `useRecording(options)`
Manages audio recording and speech-to-text transcription with VAD.

**Options:**
- `onStart?: () => void` - Called when recording starts
- `onStop?: () => void` - Called when recording stops
- `onTranscribed?: (text: string) => void` - Called with transcription result
- `onError?: (error: Error) => void` - Called on recording/transcription errors
- `onSilence?: () => void` - Called when no speech detected

**Returns:**
- `startRecording()` - Start recording, returns `RecordingResult` or `null`
- `isRecording` - Boolean indicating recording state

**RecordingResult:**
- `audioBlob: Blob` - Recorded audio
- `transcription: string` - Transcribed text
- `isSilence: boolean` - True if no speech detected

**Example:**
```typescript
const { startRecording } = useRecording({
  onTranscribed: (text) => console.log('User said:', text),
  onSilence: () => console.log('No speech detected')
});

const result = await startRecording();
if (result && !result.isSilence) {
  console.log('Transcription:', result.transcription);
}
```

#### `useLLMStream(orchestrator, options)`
Manages LLM response streaming with TTS orchestration and tool call handling.

**Parameters:**
- `orchestrator: StreamingOrchestrator` - TTS orchestrator instance

**Options:**
- `temperature?: number` - LLM temperature (default: 0.7)
- `maxTokens?: number` - Max tokens to generate (default: 2048)
- `onTextChunk?: (chunk, fullText) => void` - Called for each text chunk
- `onToolCall?: (toolName, systemMessage) => void` - Called when tool executed
- `onSpeechMessage?: (message) => Promise<void>` - Custom speech handler
- `onComplete?: () => void` - Called when stream completes
- `onError?: (error) => void` - Called on stream errors

**Returns:**
- `streamResponse(userMessage, options)` - Stream LLM response, returns full text
- `abort()` - Abort current stream
- `isStreaming` - Boolean indicating streaming state

**Example:**
```typescript
const orchestrator = new StreamingOrchestrator({...});
const { streamResponse, abort } = useLLMStream(orchestrator, {
  temperature: 0.7,
  onTextChunk: (chunk, fullText) => {
    console.log('Chunk:', chunk);
    setStreamingText(fullText);
  },
  onToolCall: (toolName, message) => {
    console.log(`Tool ${toolName}:`, message);
  }
});

const fullResponse = await streamResponse('Hello!', {
  sessionId: 'conv-123'
});
```

### Conversation Hooks

#### `useConversationFormatting()`
Utility functions for formatting conversation data.

**Returns:**
- `formatRelativeTime(dateString)` - Format as "2m ago", "3h ago", etc.
- `formatTime(timestamp)` - Format as HH:MM:SS
- `getRoleBadge(role)` - Get emoji + text for message role
- `truncateText(text, maxLength)` - Truncate with ellipsis

**Example:**
```typescript
const { formatRelativeTime, getRoleBadge } = useConversationFormatting();

formatRelativeTime('2024-01-01T12:00:00Z') // "2h ago"
getRoleBadge('user') // "👤 You"
getRoleBadge('assistant') // "🤖 Assistant"
```

#### `useConversationManager()`
Manages conversation CRUD operations.

**Returns:**
- `conversations` - List of conversations
- `currentConversationId` - Active conversation ID
- `handleLoadConversation(id)` - Load specific conversation
- `handleDeleteConversation(id, event?)` - Delete with confirmation
- `isConversationActive(id)` - Check if conversation is active
- `refreshConversations()` - Reload conversation list

**Example:**
```typescript
const {
  conversations,
  handleLoadConversation,
  handleDeleteConversation,
  isConversationActive
} = useConversationManager();

// Load conversation
handleLoadConversation('conv-123');

// Delete with confirmation
handleDeleteConversation('conv-123', clickEvent);

// Check if active
const isActive = isConversationActive('conv-123');
```

### Modal Hooks

#### `useYouTubeModal()`
Manages YouTube modal state and player controls.

**Returns:**
- **State:** `viewMode`, `modalSize`, `searchResults`, `currentVideoId`, `isPlaying`, `volume`, `isMuted`
- **Computed:** `isVisible`, `isMinimized`, `getHeaderIcon()`, `getHeaderTitle()`
- **Actions:** `hide()`, `toggleSize()`, `playVideo()`, `togglePlayPause()`, `setVolume()`, `volumeUp()`, `volumeDown()`, `toggleMute()`

**Example:**
```typescript
const {
  isVisible,
  isPlaying,
  togglePlayPause,
  getHeaderTitle
} = useYouTubeModal();

if (isVisible) {
  console.log('Modal title:', getHeaderTitle());
  togglePlayPause(); // Play/pause video
}
```

#### `useConversationsModal()`
Manages conversations modal state and operations.

**Returns:**
- **State:** `isOpen`, `modalSize`, `isMinimized`, `conversations`, `currentConversationId`
- **Actions:** `show()`, `hide()`, `toggleSize()`, `handleLoadConversation()`, `handleDeleteConversation()`, `refreshConversations()`
- **Utilities:** `formatRelativeTime()`, `formatLastMessage()`

**Features:**
- Auto-refreshes conversations when modal opens
- Handles conversation loading and deletion
- Formats dates and message previews

**Example:**
```typescript
const {
  isOpen,
  conversations,
  handleLoadConversation,
  formatRelativeTime
} = useConversationsModal();

// Open modal programmatically
const { show } = useConversationsModal();
show();

// Format conversation date
const timeAgo = formatRelativeTime(conversation.updatedAt);
```

## Best Practices

1. **Hook Naming:** Use `use` prefix for all custom hooks
2. **Single Responsibility:** Each hook should handle one specific concern
3. **Composition:** Hooks can use other hooks (e.g., `useConversationsModal` uses `useConversationManager`)
4. **Type Safety:** All hooks are fully typed with TypeScript
5. **Testing:** Write tests for hooks in `__tests__/` directory

## Adding New Hooks

1. Create hook file: `useMyFeature.ts`
2. Export from `index.ts`
3. Add documentation to this README
4. Write tests if applicable

## Examples

### Combining Hooks

```typescript
function ConversationList() {
  const { conversations } = useConversationManager();
  const { formatRelativeTime, getRoleBadge } = useConversationFormatting();
  
  return (
    <div>
      {conversations.map(conv => (
        <div key={conv.id}>
          <span>{conv.title}</span>
          <span>{formatRelativeTime(conv.updatedAt)}</span>
        </div>
      ))}
    </div>
  );
}
```

### Using Modal Hooks

```typescript
function MyComponent() {
  const { show: showConversations } = useConversationsModal();
  const { playVideo } = useYouTubeModal();
  
  return (
    <>
      <button onClick={showConversations}>Open Conversations</button>
      <button onClick={() => playVideo('dQw4w9WgXcQ')}>Play Video</button>
    </>
  );
}
```
