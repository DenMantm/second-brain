# GitHub Copilot Instructions for Second Brain Project

## Project Overview

Second Brain is a **locally-hosted AI assistant system** with voice and text interfaces, featuring long-term memory, RAG capabilities, and multi-modal processing. The system is designed for **100% privacy** with all processing running on local hardware.

### Core Principles
- **Privacy First**: All data stays local, no external API calls
- **Type Safety**: TypeScript for API layer, strong typing throughout
- **Modularity**: Microservice architecture with clear separation of concerns
- **Performance**: GPU-accelerated inference, optimized for RTX 4060 Ti 16GB
- **User Experience**: Sub-2-second voice response, smooth streaming responses

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────┐
│  User Interfaces                                     │
│  - Raspberry Pi Voice Client (Python)                │
│  - Web Interface (React + TypeScript)                │
└─────────────────────────────────────────────────────┘
                    ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────┐
│  API Layer (Node.js + TypeScript)                    │
│  - Express/Fastify server                            │
│  - Socket.io WebSocket                               │
│  - Request orchestration                             │
└─────────────────────────────────────────────────────┘
                    ↓ HTTP/gRPC
┌─────────────────────────────────────────────────────┐
│  LLM Service (Python)                                │
│  - vLLM or llama.cpp inference                       │
│  - Mistral 7B / Llama 3.1 8B (AWQ 4-bit)            │
│  - GPU-accelerated (RTX 4060 Ti)                     │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Data Layer                                          │
│  - PostgreSQL (structured data)                      │
│  - Qdrant (vector embeddings)                        │
│  - Redis (caching, sessions)                         │
│  - File system (uploads, models)                     │
└─────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React 18 + TypeScript 5.3 + Vite 5
- Zustand for state management (or Redux Toolkit)
- Socket.io-client for WebSocket
- Tailwind CSS + shadcn/ui for UI components
- Web Audio API for voice recording/playback

**Backend API:**
- Node.js 20 LTS + TypeScript
- Express.js (or Fastify for performance)
- Prisma ORM + PostgreSQL 15
- Socket.io for WebSocket

**LLM Service:**
- Python 3.11 + FastAPI
- vLLM or llama.cpp for inference
- Faster-Whisper (STT), Coqui TTS (TTS)
- HuggingFace transformers

**Databases:**
- PostgreSQL 15 (user data, conversations)
- Qdrant (vector embeddings)
- Redis (optional caching)

**Infrastructure:**
- Docker + Docker Compose
- Nginx reverse proxy
- CUDA 12.1+ for GPU acceleration

---

## Code Style Guidelines

### TypeScript Conventions

**Naming:**
- PascalCase: Interfaces, Types, Classes, React Components
- camelCase: Variables, functions, methods
- UPPER_SNAKE_CASE: Constants
- kebab-case: File names (except React components)

```typescript
// ✅ Good
interface User {
  id: string;
  email: string;
}

const MAX_RETRIES = 3;

function getUserById(id: string): Promise<User | null> {
  // ...
}

export class UserService {
  private readonly repository: UserRepository;
}

// File names
user-service.ts
UserProfile.tsx
user.types.ts
```

**Type Safety:**
```typescript
// ✅ Always use explicit return types
async function fetchUser(id: string): Promise<User> {
  // ...
}

// ✅ Use type guards
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}

// ✅ Use discriminated unions for state
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ✅ Use readonly for immutability
interface Config {
  readonly apiUrl: string;
}

// ✅ Prefer interfaces over types for objects
interface User {
  id: string;
  name: string;
}

// ✅ Use const assertions
const CONFIG = {
  timeout: 5000
} as const;

// ❌ Avoid implicit any
function process(data) { // Bad
  return data.map(x => x.value);
}
```

**Import Order:**
```typescript
// 1. External dependencies
import { Injectable } from '@nestjs/common';
import express from 'express';

// 2. Internal dependencies
import { UserService } from '@/services/user.service';
import { logger } from '@/utils/logger';

// 3. Types
import type { User } from '@/types/user.types';
```

### React Component Structure

```typescript
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/stores';
import type { User } from '@/types/user.types';

interface UserProfileProps {
  userId: string;
  onUpdate?: (user: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ 
  userId, 
  onUpdate 
}) => {
  // 1. Hooks
  const [isLoading, setIsLoading] = useState(false);
  const { user, fetchUser } = useStore();
  
  // 2. Effects
  useEffect(() => {
    fetchUser(userId);
  }, [userId, fetchUser]);
  
  // 3. Event handlers
  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      // Logic here
      onUpdate?.(user);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 4. Render helpers
  const renderContent = () => {
    if (isLoading) return <div>Loading...</div>;
    return <div>{user.name}</div>;
  };
  
  // 5. Main render
  return (
    <div className="user-profile">
      {renderContent()}
      <Button onClick={handleUpdate}>Update</Button>
    </div>
  );
};
```

### Python Conventions

```python
# Follow PEP 8 strictly

from typing import List, Optional
from fastapi import FastAPI

# Constants
MAX_TOKENS = 512
DEFAULT_TEMPERATURE = 0.7

class LLMService:
    """Service for LLM inference.
    
    Attributes:
        model: The loaded language model.
        tokenizer: The model's tokenizer.
    """
    
    def __init__(self, model_name: str) -> None:
        """Initialize the LLM service.
        
        Args:
            model_name: Name of the model to load.
        """
        self.model_name = model_name
        self._model = None
    
    def generate(
        self, 
        prompt: str, 
        max_tokens: int = MAX_TOKENS,
        temperature: float = DEFAULT_TEMPERATURE
    ) -> str:
        """Generate text from a prompt.
        
        Args:
            prompt: Input text prompt.
            max_tokens: Maximum tokens to generate.
            temperature: Sampling temperature.
            
        Returns:
            Generated text.
            
        Raises:
            ValueError: If model not loaded.
        """
        if self._model is None:
            raise ValueError("Model not loaded")
        
        # Implementation
        return generated_text
```

---

## Data Models & Schemas

### Core TypeScript Interfaces
### Core TypeScript Interfaces

```typescript
// Settings (simple single-user configuration)
interface Settings {
  theme: 'light' | 'dark' | 'auto';
  voiceEnabled: boolean;
  defaultModel: string;
  memoryRetention: 'high' | 'medium' | 'low';
  language: string;
}
// Conversation
interface Conversation {
  id: string;
  userId: string;
  title: string;
  summary?: string;
  tags: string[];
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Conversation
interface Conversation {
  id: string;
  title: string;
  summary?: string;
  tags: string[];
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
interface MessageMetadata {
  tokensUsed?: number;
  inferenceTime?: number;
  model?: string;
  temperature?: number;
  retrievedContext?: string[];
  voiceInput?: boolean;
}

// Memory
interface Memory {
  id: string;
  userId: string;
  type: 'fact' | 'preference' | 'event' | 'document';
  content: string;
  embedding: number[];
  importance: number; // 0-1
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  tags: string[];
// Memory
interface Memory {
  id: string;
  type: 'fact' | 'preference' | 'event' | 'document';
  content: string;
  embedding: number[];
  importance: number; // 0-1
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  tags: string[];
  source?: string;
}

// Document
interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  status: 'processing' | 'ready' | 'failed';
  uploadedAt: Date;
  processedAt?: Date;
  chunkCount: number;
  metadata: DocumentMetadata;
} createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  
  conversations Conversation[]
  documents     Document[]
### Prisma Schema Reference

```prisma
model Conversation {
  id           String    @id @default(uuid())
  title        String
  summary      String?
  tags         String[]
  messageCount Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  messages     Message[]
  
  @@index([createdAt])
}

model Message {
  id             String   @id @default(uuid())
  conversationId String
  role           String
  content        String   @db.Text
  timestamp      DateTime @default(now())
  metadata       Json     @default("{}")
  parentId       String?
  
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  @@index([conversationId, timestamp])
}

model Document {
  id           String    @id @default(uuid())
  filename     String
  originalName String
  mimeType     String
  size         Int
  path         String
  status       String
  uploadedAt   DateTime  @default(now())
  processedAt  DateTime?
  chunkCount   Int       @default(0)
  metadata     Json      @default("{}")
  
  @@index([status])
}

model Memory {
  id           String   @id @default(uuid())
  type         String
  content      String   @db.Text
  importance   Float    @default(0.5)
  accessCount  Int      @default(0)
  lastAccessed DateTime @default(now())
  createdAt    DateTime @default(now())
  tags         String[]
  metadata     Json     @default("{}")
  source       String?
  
  @@index([type])
  @@index([importance])
}

model Settings {
  id              String   @id @default("default")
  theme           String   @default("dark")
  voiceEnabled    Boolean  @default(true)
  defaultModel    String   @default("mistral-7b")
  memoryRetention String   @default("high")
  language        String   @default("en")
  updatedAt       DateTime @updatedAt
}ELETE /api/conversation/:id     // Delete conversation

// Voice
POST   /api/voice                // Send voice message

// Memory
POST   /api/memory/save
GET    /api/memory/recall
DELETE /api/memory/:id

// Documents
POST   /api/upload
GET    /api/documents
GET    /api/document/:id
DELETE /api/document/:id

// System
GET    /api/health
GET    /api/stats
```

### WebSocket Events

```typescript
// Client -> Server
'chat:message'     { text: string, conversationId?: string }
'voice:stream'     { audio: ArrayBuffer, format: string }
'typing:start'     { conversationId: string }
'typing:stop'      { conversationId: string }

// Server -> Client
'chat:response'    { text: string, messageId: string, done: boolean }
'chat:thinking'    { status: string }
'voice:response'   { audio: ArrayBuffer, text: string }
'memory:updated'   { memoryId: string, type: string }
'error'           { code: string, message: string }
```

### Error Handling

```typescript
interface ErrorResponse {
  error: {
    type: 'VALIDATION_ERROR' | 'LLM_ERROR' | 'VECTOR_ERROR' | 'INTERNAL_ERROR';
    message: string;
    code: string;
    details?: Record<string, any>;
    requestId: string;
    timestamp: Date;
  };
}

// HTTP Status Codes
200 OK                  // Success
201 Created             // Resource created
400 Bad Request         // Validation failed
404 Not Found           // Resource not found
413 Payload Too Large   // File too large
500 Internal Server     // Server error
503 Service Unavailable // LLM/DB unavailable
```

---

## Security Best Practices

### Input Validation

```typescript
import { z } from 'zod';

const MessageSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4096).optional()
});

// Validate before processing
const validated = MessageSchema.parse(req.body);
```

---

## Performance Optimization

### Caching Strategy

```typescript
// Redis cache layers
const cacheConfig = {
  sessions: { ttl: 3600 },           // 1 hour
  context: { ttl: 1800 },            // 30 minutes
  vectorResults: { ttl: 300 },       // 5 minutes
  modelCache: { ttl: 86400 }         // 24 hours
};
```

### Database Optimization

```typescript
// Connection pooling
const dbConfig = {
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000
  }
};

// Always use indexes
// Index on: userId, createdAt, conversationId
// Pagination for large results
// Eager loading with Prisma include/select
```

### Vector Search Optimization

```typescript
// Qdrant configuration
{
  hnsw_config: {
    m: 16,
    ef_construct: 100
### Caching Strategy

```typescript
// Redis cache layers (optional)
const cacheConfig = {
  context: { ttl: 1800 },            // 30 minutes
  vectorResults: { ttl: 300 },       // 5 minutes
  modelCache: { ttl: 86400 }         // 24 hours
};
```Testing Requirements

### Test Coverage Targets

```typescript
{
  statements: 80,
  branches: 75,
  functions: 80,
  lines: 80
}
```

### Test Structure

```typescript
// Unit test example (Vitest)
describe('UserService', () => {
  let userService: UserService;
  let userRepository: UserRepository;
  
  beforeEach(() => {
    userRepository = createMock<UserRepository>();
    userService = new UserService(userRepository);
  });
  
  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
      
      const result = await userService.getUserById('123');
      
      expect(result).toEqual(mockUser);
      expect(userRepository.findById).toHaveBeenCalledWith('123');
    });
    
    it('should return null when user not found', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);
      
      const result = await userService.getUserById('999');
      
      expect(result).toBeNull();
    });
  });
});
```

---

## Common Patterns & Anti-Patterns

### ✅ Do This

```typescript
// Use async/await consistently
async function fetchData(): Promise<Data> {
  const result = await api.getData();
  return result;
}

// Handle errors properly
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', { error });
  return { success: false, error: error.message };
}

// Use dependency injection
class UserService {
  constructor(
    private readonly repository: UserRepository,
    private readonly logger: Logger
  ) {}
}

// Structured logging
logger.info('User created', {
  userId: user.id,
  timestamp: new Date(),
  action: 'user.created'
});
```

### ❌ Don't Do This

```typescript
// Don't use any
function process(data: any) { // Bad
  return data.value;
}

// Don't ignore errors
api.getData(); // Bad - no error handling

// Don't use synchronous operations for I/O
const data = fs.readFileSync('file.txt'); // Bad - blocks event loop

// Don't mutate props in React
props.user.name = 'New Name'; // Bad

// Don't put business logic in components
const Component = () => {
  // Bad - business logic in component
  const calculateDiscount = (price: number) => {
    return price * 0.1;
  };
};
```

---

## File Organization

### Monorepo Structure

```
second-brain/
├── apps/
│   ├── api/                 # TypeScript API server
├── apps/
│   ├── api/                 # TypeScript API server
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── routes/
│   │   │   ├── websocket/
│   │   │   ├── utils/
│   │   │   └── types/
│   │   ├── tests/
│   │   └── package.json
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── services/
│   │   │   ├── stores/
│   │   │   ├── hooks/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   └── package.json
│   ├── llm-service/         # Python LLM service
│   │   ├── src/
│   │   ├── models/
│   │   ├── utils/
│   │   └── requirements.txt
│   └── pi-client/           # Raspberry Pi client
│       ├── src/
│       ├── config/
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/secondbrain"
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379  # Optional

# LLM Service
LLM_SERVICE_URL=http://localhost:8080
LLM_MODEL=mistralai/Mistral-7B-Instruct-v0.2
LLM_MAX_CONTEXT=8192
LLM_GPU_MEMORY_UTILIZATION=0.9

# Loggingproduction
API_PORT=8000
WS_PORT=8001

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/secondbrain"
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379

# LLM Service
LLM_SERVICE_URL=http://localhost:8080
LLM_MODEL=mistralai/Mistral-7B-Instruct-v0.2
LLM_MAX_CONTEXT=8192
LLM_GPU_MEMORY_UTILIZATION=0.9

# Security
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# File Upload
MAX_FILE_SIZE=100MB
UPLOAD_DIR=./data/uploads
```

---

## Git Workflow

### Commit Message Convention

```bash
# Format: <type>(<scope>): <subject>

feat(chat): add streaming response support
fix(auth): resolve token refresh race condition
docs(api): update authentication endpoints
test(memory): add unit tests for memory service
refactor(llm): extract prompt engineering to separate module
perf(vector): optimize similarity search query
chore(deps): update dependencies
```

### Branch Strategy

```
main              # Production-ready code
├── develop       # Integration branch
│   ├── feature/add-voice-controls
│   ├── feature/improve-memory-search
│   ├── fix/chat-websocket-reconnect
│   └── docs/update-api-reference
```

---

## Documentation References

When implementing features, refer to:

- **System Architecture**: `/SYSTEM_DESIGN.md`
- **Server Setup**: `/docs/LOCAL_PC_SERVER.md`
- **Voice Client**: `/docs/RASPBERRY_PI_CLIENT.md`
- **Web Interface**: `/docs/WEB_INTERFACE.md`
- **API Spec**: `/docs/API_REFERENCE.md`
- **Deployment**: `/docs/DEPLOYMENT.md`
- **Development**: `/docs/DEVELOPMENT.md`

---

## Important Reminders

1. **Single-user system** - no authentication or user isolation needed
2. **Validate all inputs** with Zod schemas
3. **Log structured data** with context for debugging
4. **Use explicit types** - avoid `any`
5. **Handle errors gracefully** with proper user feedback
6. **Test critical paths** - chat, memory, voice
7. **Optimize for GPU** - batch requests when possible
8. **Keep models in VRAM** - avoid repeated loading
9. **Use connection pooling** for database
10. **Keep it simple** - focus on core AI assistant functionality
1. **Always filter by userId** for multi-tenant data isolation
2. **Validate all inputs** with Zod schemas
3. **Log structured data** with context for debugging
4. **Use explicit types** - avoid `any`
5. **Handle errors gracefully** with proper user feedback
6. **Test critical paths** - auth, chat, memory
7. **Optimize for GPU** - batch requests when possible
8. **Keep models in VRAM** - avoid repeated loading
9. **Use connection pooling** for database
10. **Implement rate limiting** on all endpoints

---

## When Suggesting Code

- Provide **complete, runnable examples**
- Include **proper error handling**
- Add **TypeScript types** for all functions
- Include **JSDoc comments** for complex logic
- Follow the **established patterns** in the codebase
- Consider **performance implications**
- Think about **edge cases and validation**
- Suggest **tests** for new functionality

---

**Last Updated**: January 4, 2026  
**Project Status**: 🚧 In Active Development
