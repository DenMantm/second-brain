/**
 * Example Components Using New Hooks
 * Demonstrates how to use the refactored hooks and managers in React components
 */

import { useEffect, useState } from 'react';
import {
  useWakeWord,
  useRecording,
  useLLMStream,
  useConversationFormatting,
  useConversationManager
} from '../hooks';
import { StreamingOrchestrator } from '../services/streamingOrchestrator';

// ===========================================
// Example 1: Simple Wake Word Component
// ===========================================

export function WakeWordButton() {
  const [isActive, setIsActive] = useState(false);
  
  const { initialize, start, stop, isListening } = useWakeWord({
    selectedWakeWord: 'go',
    threshold: 0.75,
    onDetected: async () => {
      console.log('Wake word detected!');
      alert('Wake word detected!');
    }
  });
  
  useEffect(() => {
    initialize('go');
  }, [initialize]);
  
  const toggle = async () => {
    if (isListening()) {
      await stop();
      setIsActive(false);
    } else {
      await start();
      setIsActive(true);
    }
  };
  
  return (
    <button onClick={toggle} className={isActive ? 'active' : ''}>
      {isActive ? '🎤 Listening for "go"...' : '▶️ Start Wake Word'}
    </button>
  );
}

// ===========================================
// Example 2: Voice Recorder with Transcription
// ===========================================

export function VoiceRecorder() {
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('idle');
  
  const { startRecording, isRecording } = useRecording({
    onStart: () => setStatus('recording'),
    onStop: () => setStatus('processing'),
    onTranscribed: (text) => {
      setTranscript(text);
      setStatus('idle');
    },
    onSilence: () => {
      setTranscript('(silence detected)');
      setStatus('idle');
    },
    onError: (error) => {
      console.error('Recording error:', error);
      setStatus('error');
    }
  });
  
  const handleRecord = async () => {
    const result = await startRecording();
    if (result && !result.isSilence) {
      console.log('Recording result:', result);
    }
  };
  
  return (
    <div className="voice-recorder">
      <button 
        onClick={handleRecord} 
        disabled={isRecording}
        className={isRecording ? 'recording' : ''}
      >
        {isRecording ? '🔴 Recording...' : '🎤 Start Recording'}
      </button>
      
      <div className="status">
        Status: <strong>{status}</strong>
      </div>
      
      {transcript && (
        <div className="transcript">
          <strong>Transcript:</strong> {transcript}
        </div>
      )}
    </div>
  );
}

// ===========================================
// Example 3: LLM Chat with Streaming
// ===========================================

export function StreamingChat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState('');
  const [sessionId] = useState(() => crypto.randomUUID());
  
  // Create orchestrator instance
  const [orchestrator] = useState(() => new StreamingOrchestrator({
    onTTSStart: () => console.log('TTS started'),
    onTTSComplete: () => console.log('TTS complete'),
    onComplete: () => console.log('All complete'),
  }));
  
  const { streamResponse, abort, isStreaming } = useLLMStream(orchestrator, {
    temperature: 0.7,
    maxTokens: 1024,
    onTextChunk: (_chunk, fullText) => {
      setStreaming(fullText);
    },
    onToolCall: (toolName, systemMessage) => {
      console.log(`Tool ${toolName}: ${systemMessage}`);
      setMessages(prev => [...prev, `🔧 ${systemMessage}`]);
    },
    onComplete: () => {
      setMessages(prev => [...prev, `🤖: ${streaming}`]);
      setStreaming('');
    },
    onError: (error) => {
      console.error('Stream error:', error);
      setStreaming('');
    }
  });
  
  const handleSend = async () => {
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, `👤: ${input}`]);
    const userInput = input;
    setInput('');
    
    try {
      await streamResponse(userInput, { sessionId });
    } catch (error) {
      console.error('Failed to stream:', error);
    }
  };
  
  const handleAbort = () => {
    abort();
    setStreaming('');
  };
  
  return (
    <div className="streaming-chat">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className="message">{msg}</div>
        ))}
        {streaming && (
          <div className="message streaming">
            🤖: {streaming}<span className="cursor">▊</span>
          </div>
        )}
      </div>
      
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          disabled={isStreaming}
        />
        <button onClick={handleSend} disabled={isStreaming || !input.trim()}>
          Send
        </button>
        {isStreaming && (
          <button onClick={handleAbort} className="abort">
            ⏹️ Stop
          </button>
        )}
      </div>
    </div>
  );
}

// ===========================================
// Example 4: Conversation List Panel
// ===========================================

export function ConversationListPanel() {
  const {
    conversations,
    handleLoadConversation,
    handleDeleteConversation,
    isConversationActive,
    refreshConversations
  } = useConversationManager();
  
  const { formatRelativeTime, truncateText } = useConversationFormatting();
  
  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);
  
  return (
    <div className="conversation-list">
      <div className="header">
        <h3>Conversations</h3>
        <button onClick={refreshConversations}>🔄 Refresh</button>
      </div>
      
      <div className="list">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`conversation-item ${isConversationActive(conv.id) ? 'active' : ''}`}
            onClick={() => handleLoadConversation(conv.id)}
          >
            <div className="title">{truncateText(conv.title, 40)}</div>
            <div className="meta">
              <span className="time">{formatRelativeTime(conv.updatedAt)}</span>
              <span className="count">{conv.messageCount} messages</span>
            </div>
            {conv.lastMessage && (
              <div className="preview">
                {truncateText(conv.lastMessage, 60)}
              </div>
            )}
            <button
              className="delete-btn"
              onClick={(e) => handleDeleteConversation(conv.id, e)}
              title="Delete conversation"
            >
              🗑️
            </button>
          </div>
        ))}
        
        {conversations.length === 0 && (
          <div className="empty">
            No conversations yet. Start talking to create one!
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================
// Example 5: Combined Voice Assistant Component
// ===========================================

export function MiniVoiceAssistant() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  
  // Wake word setup
  const wakeWord = useWakeWord({
    selectedWakeWord: 'go',
    onDetected: async () => {
      console.log('Wake word detected!');
      // Start recording when wake word detected
      await recordAudio();
    }
  });
  
  // Recording setup
  const recording = useRecording({
    onTranscribed: async (text) => {
      console.log('User said:', text);
      setMessage(text);
      // Send to LLM when transcription complete
      await handleLLM(text);
    },
    onSilence: async () => {
      // Resume wake word listening if no speech
      await wakeWord.start();
    }
  });
  
  // Orchestrator for TTS
  const [orchestrator] = useState(() => new StreamingOrchestrator({
    onComplete: async () => {
      // Resume wake word after AI response
      await wakeWord.start();
    }
  }));
  
  // LLM streaming setup
  const llm = useLLMStream(orchestrator, {
    onTextChunk: (_chunk, fullText) => {
      setResponse(fullText);
    }
  });
  
  const recordAudio = async () => {
    await wakeWord.stop();
    await recording.startRecording();
  };
  
  const handleLLM = async (text: string) => {
    setResponse('');
    await llm.streamResponse(text, { sessionId });
  };
  
  useEffect(() => {
    // Initialize on mount
    wakeWord.initialize('go').then(() => {
      wakeWord.start();
    });
  }, []);
  
  return (
    <div className="mini-voice-assistant">
      <div className="status">
        {recording.isRecording && <span>🔴 Recording...</span>}
        {llm.isStreaming && <span>💬 AI is responding...</span>}
        {!recording.isRecording && !llm.isStreaming && <span>👂 Say "go" to start</span>}
      </div>
      
      {message && (
        <div className="user-message">
          <strong>You:</strong> {message}
        </div>
      )}
      
      {response && (
        <div className="ai-response">
          <strong>AI:</strong> {response}
        </div>
      )}
    </div>
  );
}

// ===========================================
// CSS Styles (example)
// ===========================================

const exampleStyles = `
.voice-recorder {
  padding: 20px;
  border: 2px solid #ddd;
  border-radius: 8px;
}

.voice-recorder button {
  padding: 12px 24px;
  font-size: 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: #007bff;
  color: white;
}

.voice-recorder button.recording {
  background: #dc3545;
  animation: pulse 1s infinite;
}

.conversation-list {
  max-width: 400px;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.conversation-item {
  padding: 12px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  position: relative;
}

.conversation-item.active {
  background: #e3f2fd;
}

.conversation-item:hover {
  background: #f5f5f5;
}

.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.6;
}

.delete-btn:hover {
  opacity: 1;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.streaming-chat .message.streaming .cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
`;

// Export styles for reference
export { exampleStyles };
