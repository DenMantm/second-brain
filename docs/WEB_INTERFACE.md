# Web Interface Documentation

## Overview

The web interface is a modern, responsive Progressive Web App (PWA) that provides text and voice interaction with the Second Brain system. Built with React and TypeScript, it connects to the Local PC Server via REST API and WebSocket for real-time communication.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Interface (Browser)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Presentation Layer (React Components)             │    │
│  │  - ChatInterface, Sidebar, DocumentViewer         │    │
│  │  - VoiceControls, MemoryBrowser, Settings         │    │
│  └────────────────────────────────────────────────────┘    │
│                    ↕                                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │  State Management (Zustand/Redux)                  │    │
│  │  - Chat state, User state, UI state               │    │
│  │  - Document state, Memory state                   │    │
│  └────────────────────────────────────────────────────┘    │
│                    ↕                                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Service Layer (API Clients)                       │    │
│  │  - HTTP Client (Axios)                            │    │
│  │  - WebSocket Client (Socket.io)                   │    │
│  │  - Audio Service (Web Audio API)                  │    │
│  └────────────────────────────────────────────────────┘    │
│                    ↕                                         │
└────────────────────────────────────────────────────────────┘
                     ↕ HTTPS/WSS
┌─────────────────────────────────────────────────────────────┐
│              Local PC Server (API + WebSocket)               │
│  - REST API endpoints (port 8000)                           │
│  - WebSocket server (port 8001)                             │
│  - Authentication & authorization                            │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **User Input** → React Component (ChatInput)
2. **Component** → State Management (dispatch action)
3. **State** → Service Layer (API call)
4. **Service** → Local PC Server (HTTP/WebSocket)
5. **Server** → LLM Service (inference)
6. **Response** → WebSocket → Service → State → Component → UI Update

---

## Technology Stack

### Core Framework
```json
{
  "react": "^18.2.0",
  "typescript": "^5.3.0",
  "vite": "^5.0.0"
}
```

### UI Library
```json
{
  "@radix-ui/react-*": "^1.0.0",  // Accessible components
  "tailwindcss": "^3.4.0",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.0.0",
  "tailwind-merge": "^2.0.0"
}
```

### State Management
```json
{
  "zustand": "^4.4.0",           // Primary choice (simpler)
  // OR
  "@reduxjs/toolkit": "^2.0.0"   // Alternative (more features)
}
```

### Communication
```json
{
  "axios": "^1.6.0",
  "socket.io-client": "^4.6.0"
}
```

### Audio Processing
```json
{
  "recordrtc": "^5.6.2",
  "wavesurfer.js": "^7.0.0"
}
```

### File Upload
```json
{
  "react-dropzone": "^14.2.0"
}
```

---

## Project Structure

```
apps/web/
├── public/
│   ├── icons/              # PWA icons
│   ├── manifest.json       # PWA manifest
│   └── sw.js              # Service worker
├── src/
│   ├── components/
│   │   ├── ui/            # Reusable UI components (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown.tsx
│   │   │   └── ...
│   │   ├── chat/          # Chat-specific components
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── MessageList.tsx
│   │   │   └── TypingIndicator.tsx
│   │   ├── voice/         # Voice components
│   │   │   ├── VoiceButton.tsx
│   │   │   ├── AudioVisualizer.tsx
│   │   │   └── VoiceSettings.tsx
│   │   ├── memory/        # Memory browser
│   │   │   ├── MemoryBrowser.tsx
│   │   │   ├── MemoryCard.tsx
│   │   │   └── MemorySearch.tsx
│   │   ├── documents/     # Document management
│   │   │   ├── DocumentList.tsx
│   │   │   ├── DocumentUpload.tsx
│   │   │   ├── DocumentViewer.tsx
│   │   │   └── DocumentCard.tsx
│   │   ├── layout/        # Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── MainLayout.tsx
│   │   └── settings/      # Settings pages
│   │       ├── SettingsPanel.tsx
│   │       ├── UserProfile.tsx
│   │       └── Preferences.tsx
│   ├── pages/             # Page components
│   │   ├── HomePage.tsx
│   │   ├── ChatPage.tsx
│   │   ├── MemoryPage.tsx
│   │   ├── DocumentsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── LoginPage.tsx
│   ├── services/          # API and service clients
│   │   ├── api/
│   │   │   ├── client.ts       # Axios instance
│   │   │   ├── auth.api.ts
│   │   │   ├── chat.api.ts
│   │   │   ├── memory.api.ts
│   │   │   ├── document.api.ts
│   │   │   └── user.api.ts
│   │   ├── websocket/
│   │   │   └── socket.ts       # Socket.io client
│   │   ├── audio/
│   │   │   ├── recorder.ts     # Audio recording
│   │   │   ├── player.ts       # Audio playback
│   │   │   └── processor.ts    # Audio processing
│   │   └── storage/
│   │       └── localStorage.ts # Local storage wrapper
│   ├── stores/            # State management
│   │   ├── authStore.ts
│   │   ├── chatStore.ts
│   │   ├── memoryStore.ts
│   │   ├── documentStore.ts
│   │   ├── uiStore.ts
│   │   └── index.ts
│   ├── hooks/             # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useChat.ts
│   │   ├── useWebSocket.ts
│   │   ├── useVoice.ts
│   │   ├── useMediaQuery.ts
│   │   └── useLocalStorage.ts
│   ├── types/             # TypeScript types
│   │   ├── api.types.ts
│   │   ├── chat.types.ts
│   │   ├── memory.types.ts
│   │   └── user.types.ts
│   ├── utils/             # Utility functions
│   │   ├── formatting.ts
│   │   ├── validation.ts
│   │   ├── date.ts
│   │   └── constants.ts
│   ├── styles/            # Global styles
│   │   ├── globals.css
│   │   └── themes.css
│   ├── App.tsx            # Root component
│   ├── main.tsx           # Entry point
│   └── vite-env.d.ts      # Vite types
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

---

## Component Architecture

### 1. Chat Interface

#### ChatInterface.tsx (Main Container)

```typescript
import React, { useEffect } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { useChat } from '@/hooks/useChat';
import { useWebSocket } from '@/hooks/useWebSocket';

export const ChatInterface: React.FC = () => {
  const {
    messages,
    isTyping,
    sendMessage,
    currentConversationId
  } = useChat();
  
  const { isConnected } = useWebSocket();
  
  const handleSendMessage = async (text: string) => {
    await sendMessage(text, currentConversationId);
  };
  
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Connection status */}
      {!isConnected && (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 text-sm">
          Disconnected from server. Reconnecting...
        </div>
      )}
      
      {/* Message list */}
      <MessageList messages={messages} className="flex-1 overflow-y-auto" />
      
      {/* Typing indicator */}
      {isTyping && <TypingIndicator />}
      
      {/* Input area */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={!isConnected}
        className="border-t"
      />
    </div>
  );
};
```

#### MessageList.tsx

```typescript
import React, { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { Message } from '@/types/chat.types';

interface MessageListProps {
  messages: Message[];
  className?: string;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  className
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  return (
    <div className={`p-4 space-y-4 ${className}`}>
      {messages.length === 0 ? (
        <div className="text-center text-muted-foreground mt-8">
          <p className="text-lg">Start a conversation</p>
          <p className="text-sm mt-2">Ask me anything!</p>
        </div>
      ) : (
        messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
};
```

#### ChatMessage.tsx

```typescript
import React from 'react';
import { Message } from '@/types/chat.types';
import { cn } from '@/utils/cn';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  
  return (
    <div
      className={cn(
        'flex gap-3 group',
        isUser && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8">
        <AvatarFallback className={cn(
          isUser && 'bg-primary text-primary-foreground',
          isAssistant && 'bg-secondary text-secondary-foreground'
        )}>
          {isUser ? 'U' : 'AI'}
        </AvatarFallback>
      </Avatar>
      
      {/* Message content */}
      <div className={cn(
        'flex-1 max-w-[80%]',
        isUser && 'flex flex-col items-end'
      )}>
        <div className={cn(
          'rounded-lg px-4 py-2',
          isUser && 'bg-primary text-primary-foreground',
          isAssistant && 'bg-muted'
        )}>
          {/* Render markdown content */}
          <div className="prose prose-sm dark:prose-invert">
            {message.content}
          </div>
          
          {/* Metadata (tokens, time, etc.) */}
          {message.metadata?.tokensUsed && (
            <div className="text-xs opacity-70 mt-2">
              {message.metadata.tokensUsed} tokens • 
              {message.metadata.inferenceTime}ms
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <div className="text-xs text-muted-foreground mt-1 px-1">
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
};
```

#### ChatInput.tsx

```typescript
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { Send, Paperclip } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled,
  className
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
      textareaRef.current?.focus();
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className={`p-4 ${className}`}>
      <div className="flex gap-2 items-end">
        {/* File upload button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        
        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Shift+Enter for new line)"
          disabled={disabled}
          className="min-h-[60px] max-h-[200px] resize-none"
          rows={1}
        />
        
        {/* Voice input button */}
        <VoiceButton disabled={disabled} />
        
        {/* Send button */}
        <Button
          type="submit"
          size="icon"
          disabled={disabled || !input.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};
```

### 2. Voice Components

#### VoiceButton.tsx

```typescript
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { useVoice } from '@/hooks/useVoice';
import { AudioVisualizer } from './AudioVisualizer';

interface VoiceButtonProps {
  disabled?: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ disabled }) => {
  const {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    audioLevel
  } = useVoice();
  
  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  return (
    <div className="relative">
      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'outline'}
        size="icon"
        onClick={handleClick}
        disabled={disabled || isProcessing}
      >
        {isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      
      {/* Audio visualizer */}
      {isRecording && (
        <AudioVisualizer
          level={audioLevel}
          className="absolute -top-12 left-1/2 -translate-x-1/2"
        />
      )}
    </div>
  );
};
```

#### useVoice.ts Hook

```typescript
import { useState, useCallback, useRef } from 'react';
import { audioRecorder } from '@/services/audio/recorder';
import { chatApi } from '@/services/api/chat.api';
import { useChatStore } from '@/stores/chatStore';

export const useVoice = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const { addMessage } = useChatStore();
  
  const startRecording = useCallback(async () => {
    try {
      await audioRecorder.start({
        onAudioLevel: setAudioLevel
      });
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, []);
  
  const stopRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      setIsProcessing(true);
      
      const audioBlob = await audioRecorder.stop();
      
      // Send to server
      const response = await chatApi.sendVoice(audioBlob);
      
      // Add transcript to chat
      addMessage({
        role: 'user',
        content: response.transcript,
        metadata: { voiceInput: true }
      });
      
      // Add AI response
      if (response.responseText) {
        addMessage({
          role: 'assistant',
          content: response.responseText
        });
      }
      
      // Play audio response if available
      if (response.audioResponse) {
        await audioRecorder.playAudio(response.audioResponse);
      }
    } catch (error) {
      console.error('Voice processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [addMessage]);
  
  return {
    isRecording,
    isProcessing,
    audioLevel,
    startRecording,
    stopRecording
  };
};
```

### 3. Document Upload

#### DocumentUpload.tsx

```typescript
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDocumentStore } from '@/stores/documentStore';
import { documentApi } from '@/services/api/document.api';

export const DocumentUpload: React.FC = () => {
  const { uploadProgress, addDocument } = useDocumentStore();
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await documentApi.upload(formData, {
          onUploadProgress: (progress) => {
            // Update progress in store
          }
        });
        
        addDocument(response.data);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  }, [addDocument]);
  
  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc', '.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'image/*': ['.jpg', '.jpeg', '.png']
    },
    maxSize: 100 * 1024 * 1024 // 100MB
  });
  
  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8
          transition-colors cursor-pointer
          ${isDragActive 
            ? 'border-primary bg-primary/10' 
            : 'border-muted-foreground/25 hover:border-primary/50'
          }
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-4 text-center">
          <Upload className="h-12 w-12 text-muted-foreground" />
          
          <div>
            <p className="text-lg font-medium">
              {isDragActive
                ? 'Drop files here'
                : 'Drag & drop files here'
              }
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse (PDF, DOCX, TXT, MD, Images)
            </p>
          </div>
          
          <Button variant="outline" type="button">
            Select Files
          </Button>
        </div>
      </div>
      
      {/* Upload progress */}
      {acceptedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {acceptedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <File className="h-5 w-5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <Progress value={uploadProgress[file.name] || 0} className="h-1 mt-1" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## State Management (Zustand)

### Chat Store

```typescript
// stores/chatStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Message, Conversation } from '@/types/chat.types';
import { chatApi } from '@/services/api/chat.api';

interface ChatState {
  // State
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isTyping: boolean;
  
  // Actions
  setCurrentConversation: (id: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  sendMessage: (text: string, conversationId?: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set, get) => ({
        conversations: [],
        currentConversationId: null,
        messages: [],
        isTyping: false,
        
        setCurrentConversation: (id) => {
          set({ currentConversationId: id });
          get().loadMessages(id);
        },
        
        addMessage: (message) => {
          const newMessage: Message = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date(),
            conversationId: get().currentConversationId || ''
          };
          
          set((state) => ({
            messages: [...state.messages, newMessage]
          }));
        },
        
        sendMessage: async (text, conversationId) => {
          const convId = conversationId || get().currentConversationId;
          
          // Add user message
          get().addMessage({
            role: 'user',
            content: text,
            conversationId: convId || '',
            metadata: {}
          });
          
          // Show typing indicator
          set({ isTyping: true });
          
          try {
            // Send to server
            const response = await chatApi.sendMessage({
              message: text,
              conversationId: convId || undefined
            });
            
            // Add assistant response
            get().addMessage({
              role: 'assistant',
              content: response.data.text,
              conversationId: convId || '',
              metadata: response.data.metadata
            });
            
            // Update conversation ID if new
            if (!convId && response.data.conversationId) {
              set({ currentConversationId: response.data.conversationId });
            }
          } catch (error) {
            console.error('Failed to send message:', error);
            // Handle error (show notification, etc.)
          } finally {
            set({ isTyping: false });
          }
        },
        
        loadConversations: async () => {
          try {
            const response = await chatApi.getConversations();
            set({ conversations: response.data });
          } catch (error) {
            console.error('Failed to load conversations:', error);
          }
        },
        
        loadMessages: async (conversationId) => {
          try {
            const response = await chatApi.getConversation(conversationId);
            set({ messages: response.data.messages });
          } catch (error) {
            console.error('Failed to load messages:', error);
          }
        },
        
        deleteConversation: async (id) => {
          try {
            await chatApi.deleteConversation(id);
            set((state) => ({
              conversations: state.conversations.filter(c => c.id !== id),
              currentConversationId: state.currentConversationId === id 
                ? null 
                : state.currentConversationId,
              messages: state.currentConversationId === id ? [] : state.messages
            }));
          } catch (error) {
            console.error('Failed to delete conversation:', error);
          }
        }
      }),
      {
        name: 'chat-storage',
        partialize: (state) => ({
          conversations: state.conversations,
          currentConversationId: state.currentConversationId
        })
      }
    )
  )
);
```

---

## WebSocket Integration

### Socket Service

```typescript
// services/websocket/socket.ts
import io, { Socket } from 'socket.io-client';
import { useChatStore } from '@/stores/chatStore';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  connect(url: string, token: string) {
    this.socket = io(url, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    if (!this.socket) return;
    
    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
    });
    
    // Chat events
    this.socket.on('chat:response', (data) => {
      const { addMessage } = useChatStore.getState();
      addMessage({
        role: 'assistant',
        content: data.text,
        conversationId: data.conversationId,
        metadata: data.metadata
      });
    });
    
    this.socket.on('chat:thinking', (data) => {
      // Show "AI is thinking..." indicator
      useChatStore.setState({ isTyping: true });
    });
    
    this.socket.on('memory:updated', (data) => {
      // Refresh memory store
      console.log('Memory updated:', data);
    });
    
    this.socket.on('error', (data) => {
      console.error('Server error:', data);
      // Show error notification
    });
  }
  
  sendMessage(text: string, conversationId?: string) {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }
    
    this.socket.emit('chat:message', {
      text,
      conversationId
    });
  }
  
  startTyping(conversationId: string) {
    this.socket?.emit('typing:start', { conversationId });
  }
  
  stopTyping(conversationId: string) {
    this.socket?.emit('typing:stop', { conversationId });
  }
  
  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
  
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();
```

### useWebSocket Hook

```typescript
// hooks/useWebSocket.ts
import { useEffect } from 'react';
import { websocketService } from '@/services/websocket/socket';
import { useAuthStore } from '@/stores/authStore';
import { create } from 'zustand';

interface WebSocketState {
  isConnected: boolean;
  setConnected: (connected: boolean) => void;
}

const useWebSocketStore = create<WebSocketState>((set) => ({
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected })
}));

export const useWebSocket = () => {
  const { token } = useAuthStore();
  const { isConnected, setConnected } = useWebSocketStore();
  
  useEffect(() => {
    if (!token) return;
    
    const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8001';
    
    websocketService.connect(WS_URL, token);
    
    // Monitor connection status
    const checkConnection = setInterval(() => {
      setConnected(websocketService.isConnected);
    }, 1000);
    
    return () => {
      clearInterval(checkConnection);
      websocketService.disconnect();
    };
  }, [token, setConnected]);
  
  return {
    isConnected,
    sendMessage: websocketService.sendMessage.bind(websocketService),
    startTyping: websocketService.startTyping.bind(websocketService),
    stopTyping: websocketService.stopTyping.bind(websocketService)
  };
};
```

---

## UI/UX Design System

### Theme Configuration

```typescript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' }
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-out': 'fade-out 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'pulse-slow': 'pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    }
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')]
};
```

### CSS Variables (Light/Dark Theme)

```css
/* styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    
    --radius: 0.5rem;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

---

## Responsive Design

### Breakpoints

```typescript
// hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  
  return matches;
};

// Preset hooks
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
```

### Adaptive Layouts

```typescript
// components/layout/MainLayout.tsx
import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen">
        <Header>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <Sidebar />
            </SheetContent>
          </Sheet>
        </Header>
        
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen">
      <Sidebar className="w-64 border-r" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
```

---

## Integration with Backend

### API Client Configuration

```typescript
// services/api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Request interceptor (add auth token)
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (handle errors)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 (refresh token)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const { refreshToken, setTokens } = useAuthStore.getState();
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken
        });
        
        setTokens(response.data.accessToken, response.data.refreshToken);
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

### Relationship with Server Components

```
User Action (Web UI)
    ↓
React Component Event Handler
    ↓
Zustand Store Action
    ↓
API Service Call (axios)
    ↓
HTTP Request to Local PC Server (port 8000)
    ↓
TypeScript API Server (Express)
    ↓
Route Handler
    ↓
Controller
    ↓
Service Layer
    ↓ (if LLM needed)
Python LLM Service (port 8080)
    ↓
LLM Inference (GPU)
    ↓
Response back through chain
    ↓
WebSocket event (real-time updates)
    ↓
Socket.io Client
    ↓
Zustand Store Update
    ↓
React Component Re-render
    ↓
UI Update (user sees response)
```

---

## Performance Optimization

### Code Splitting

```typescript
// App.tsx
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load pages
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const MemoryPage = lazy(() => import('@/pages/MemoryPage'));
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
```

### Memoization

```typescript
import React, { memo, useMemo } from 'react';

export const ChatMessage = memo<ChatMessageProps>(({ message }) => {
  const formattedTime = useMemo(() => 
    formatDistanceToNow(new Date(message.timestamp)),
    [message.timestamp]
  );
  
  // ... rest of component
});
```

### Virtual Scrolling (for large message lists)

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  });
  
  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            <ChatMessage message={messages[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## Progressive Web App (PWA)

### Service Worker

```javascript
// public/sw.js
const CACHE_NAME = 'second-brain-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/index.js',
  '/assets/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Network first for API calls
      if (event.request.url.includes('/api/')) {
        return fetch(event.request).catch(() => response);
      }
      
      // Cache first for assets
      return response || fetch(event.request);
    })
  );
});
```

### Manifest

```json
{
  "name": "Second Brain",
  "short_name": "2ndBrain",
  "description": "AI Assistant with Long-term Memory",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## Testing

### Unit Tests (Vitest)

```typescript
// components/chat/ChatMessage.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';

describe('ChatMessage', () => {
  it('renders user message correctly', () => {
    const message = {
      id: '1',
      role: 'user',
      content: 'Hello',
      timestamp: new Date(),
      conversationId: '1',
      metadata: {}
    };
    
    render(<ChatMessage message={message} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

---

## Next Steps

1. Set up Vite + React + TypeScript project
2. Implement core components (Chat, Voice, Documents)
3. Configure state management
4. Integrate WebSocket for real-time updates
5. Build responsive layouts
6. Add PWA features
7. Implement comprehensive testing

See [API_REFERENCE.md](./API_REFERENCE.md) for backend endpoint details.
