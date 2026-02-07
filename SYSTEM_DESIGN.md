# Second Brain System Design

## Overview
A locally-hosted AI assistant system with voice and text interfaces, featuring long-term memory, RAG capabilities, and multi-modal processing.

## System Architecture

```
┌─────────────────┐         ┌──────────────────────────────────┐
│  Raspberry Pi   │         │     Main Server (Local PC)       │
│  OpenVoiceOS    │◄───────►│                                  │
│                 │  HTTP/  │  ┌────────────────────────────┐  │
│  - Microphone   │  WebSocket │  API Layer (FastAPI)       │  │
│  - Speaker      │         │  │  - /chat                   │  │
│  - Wake Word    │         │  │  - /voice                  │  │
│  - STT/TTS      │         │  │  - /upload                 │  │
└─────────────────┘         │  │  - /search                 │  │
                            │  └────────────────────────────┘  │
┌─────────────────┐         │                                  │
│  Web Interface  │         │  ┌────────────────────────────┐  │
│                 │◄───────►│  │  LLM Engine                │  │
│  - Chat UI      │  HTTPS  │  │  GPT-style OSS Model       │  │
│  - Voice Ctrl   │         │  │  (GPU: RTX 4060 Ti 16GB)   │  │
│  - File Upload  │         │  └────────────────────────────┘  │
└─────────────────┘         │                                  │
                            │  ┌────────────────────────────┐  │
                            │  │  Memory System             │  │
                            │  │  - Vector DB (Qdrant)      │  │
                            │  │  - Conversation Store      │  │
                            │  │  - Document Embeddings     │  │
                            │  └────────────────────────────┘  │
                            │                                  │
                            │  ┌────────────────────────────┐  │
                            │  │  RAG Pipeline              │  │
                            │  │  - Document Parser         │  │
                            │  │  - Chunking                │  │
                            │  │  - Embedding Generator     │  │
                            │  └────────────────────────────┘  │
                            └──────────────────────────────────┘
```

## Component Details

### 1. Raspberry Pi Setup

#### Recommended OS
**DietPi** or **Raspberry Pi OS Lite (64-bit)**
- Lighter than full OpenVoiceOS if you only need voice interface
- Better resource management
- Easier to customize

#### Alternative: OpenVoiceOS
- Full voice assistant stack
- Pre-configured STT/TTS
- Wake word detection built-in
- More resource-intensive

#### Raspberry Pi Model Recommendation
- **Raspberry Pi 4 (4GB/8GB)** or **Raspberry Pi 5**
- Needed for local STT/TTS processing

#### Software Stack on Pi
```yaml
Services:
  - Wake Word Detection: Porcupine or Mycroft Precise
  - STT: Whisper.cpp (local, lightweight) or Vosk
  - TTS: Piper TTS (fast, local) or Coqui TTS
  - Audio: PulseAudio/PipeWire
  - Client: Python script to communicate with main server
```

---

### 2. Main Server (Your Local PC)

#### Hardware Specs
- **GPU**: RTX 4060 Ti (16GB VRAM) ✅
- **RAM**: 32GB+ recommended (you have at least 16GB system RAM)
- **Storage**: 500GB+ SSD for models and vector database

#### Operating System
- **Windows 11** (your current setup)
- **WSL2** for running Linux-based services (optional but recommended)

---

### 3. LLM Selection (GPT-style OSS)

Given your 16GB VRAM constraint:

#### Primary Options:
1. **Mistral 7B Instruct** (Recommended)
   - VRAM: ~8-10GB (4-bit quantization)
   - Fast inference
   - Strong instruction following
   
2. **Llama 3.1 8B Instruct**
   - VRAM: ~9-11GB (4-bit quantization)
   - Excellent reasoning
   - Good for RAG

3. **Phi-3 Medium (14B)**
   - VRAM: ~12-14GB (4-bit quantization)
   - Strong performance for size
   - Microsoft's model

#### Inference Engine
**vLLM** or **llama.cpp** with GPU acceleration
- Continuous batching for no gaps
- Fast token generation (60-100 tokens/sec on your GPU)
- Quantization support (GPTQ, AWQ, GGUF)

---

### 4. API Architecture

#### Technology Stack
```typescript
Runtime: Node.js 20+ (LTS)
Framework: Express.js with TypeScript (or Fastify for better performance)
WebSocket: Socket.io for real-time bidirectional communication
Authentication: JWT tokens with refresh token rotation
Validation: Zod for runtime type safety
ORM: Prisma (for conversation/user data storage)
CORS: Enabled with origin whitelist
```

**Architecture Pattern**: Hybrid approach
- **TypeScript API Layer**: All HTTP/WebSocket endpoints, business logic, orchestration
- **Python LLM Service**: Separate microservice for model inference (communicates via HTTP/gRPC)
- **Benefits**: Type safety + best-in-class LLM tooling

#### Core Endpoints

##### REST API
```typescript
// Authentication
POST   /api/auth/register        # Create new user
POST   /api/auth/login           # Login, get JWT
POST   /api/auth/refresh         # Refresh access token
POST   /api/auth/logout          # Invalidate tokens

// Chat & Interaction
POST   /api/chat                 # Text chat
POST   /api/voice                # Voice input (audio file)
GET    /api/stream/chat          # Server-sent events for streaming

// Memory & Knowledge
POST   /api/upload               # Upload documents for RAG
GET    /api/search               # Search memory/documents
POST   /api/memory/save          # Explicitly save important info
GET    /api/memory/recall        # Retrieve memories by query
DELETE /api/memory/:id           # Delete specific memory
PUT    /api/memory/:id           # Update memory

// Conversations
GET    /api/conversations        # List past conversations
GET    /api/conversation/:id     # Get specific conversation
DELETE /api/conversation/:id     # Delete conversation
POST   /api/conversation/:id/export # Export conversation

// Documents & RAG
GET    /api/documents            # List uploaded documents
GET    /api/document/:id         # Get document metadata
DELETE /api/document/:id         # Delete document
POST   /api/document/:id/reindex # Reindex document

// User & Settings
GET    /api/user/profile         # Get user profile
PUT    /api/user/profile         # Update user profile
GET    /api/user/preferences     # Get user preferences
PUT    /api/user/preferences     # Update preferences

// System & Monitoring
GET    /api/health               # Health check
GET    /api/stats                # System statistics
GET    /api/models               # Available models
POST   /api/models/switch        # Switch active model
```

##### WebSocket Events
```typescript
// Client -> Server
{
  "chat:message": { text: string, conversationId?: string }
  "voice:stream": { audio: ArrayBuffer, format: string }
  "typing:start": { conversationId: string }
  "typing:stop": { conversationId: string }
}

// Server -> Client
{
  "chat:response": { text: string, messageId: string, done: boolean }
  "chat:thinking": { status: string }
  "voice:response": { audio: ArrayBuffer, text: string }
  "memory:updated": { memoryId: string, type: string }
  "error": { code: string, message: string }
}
```

---

### 5. Memory & RAG System

#### Vector Database: Qdrant
- Runs locally
- Fast similarity search
- Supports metadata filtering
- Easy to backup

#### Memory Architecture
```
┌─────────────────────────────────────┐
│  Short-term Memory                  │
│  - Current conversation context     │
│  - Last N messages in prompt        │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Working Memory                     │
│  - Session state                    │
│  - Active tasks                     │
│  - Temporary context                │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Long-term Memory (Vector DB)       │
│  - Conversation summaries           │
│  - Important facts                  │
│  - User preferences                 │
│  - Document embeddings              │
└─────────────────────────────────────┘
```

#### Embedding Model
**all-MiniLM-L6-v2** or **BGE-small-en-v1.5**
- Fast embedding generation
- Low VRAM footprint (~500MB)
- Good quality for personal documents

#### Document Processing Pipeline
```python
1. Ingest → 2. Parse → 3. Chunk → 4. Embed → 5. Store
   ↓           ↓          ↓          ↓          ↓
  PDF        Text     512-1024   Vectors    Qdrant
  DOCX      Extract   tokens    (384-dim)
  TXT
  MD
  Images*
```

*Image processing: Use CLIP or similar for image embeddings

---

### 6. Speech Processing Strategy

#### Option A: Raspberry Pi handles STT/TTS (Recommended)
**Advantages:**
- Reduces main server load
- Lower latency for voice detection
- Pi can work as independent voice client

**Disadvantages:**
- Pi needs sufficient resources
- Slightly lower STT/TTS quality

#### Option B: Server handles STT/TTS
**Advantages:**
- Higher quality (can use Whisper Large)
- Centralized processing

**Disadvantages:**
- Network latency
- More server load
- Pi becomes just a microphone/speaker

#### Recommended: Hybrid Approach
```
Raspberry Pi:
  - Wake word detection (local, lightweight)
  - Audio streaming to server
  - TTS playback from server

Main Server:
  - STT: Faster-Whisper (GPU accelerated)
  - TTS: Coqui TTS or Bark (GPU accelerated)
  - Higher quality, acceptable latency
```

---

## Data Models & TypeScript Schemas

### Core Interfaces

```typescript
// User Management
interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  voiceEnabled: boolean;
  defaultModel: string;
  memoryRetention: 'high' | 'medium' | 'low';
  privacyMode: boolean;
  language: string;
}

// Conversation & Messages
interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  summary?: string;
  tags: string[];
}

interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata: MessageMetadata;
  parentId?: string; // For branching conversations
}

interface MessageMetadata {
  tokensUsed?: number;
  inferenceTime?: number;
  model?: string;
  temperature?: number;
  retrievedContext?: string[];
  voiceInput?: boolean;
  edited?: boolean;
}

// Memory System
interface Memory {
  id: string;
  userId: string;
  type: 'fact' | 'preference' | 'event' | 'document';
  content: string;
  embedding: number[];
  importance: number; // 0-1 scale
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  tags: string[];
  metadata: Record<string, any>;
  source?: string; // conversationId or documentId
}

// Document Management
interface Document {
  id: string;
  userId: string;
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
}

interface DocumentMetadata {
  title?: string;
  author?: string;
  pageCount?: number;
  language?: string;
  extractedText?: string;
  thumbnail?: string;
}

interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
  metadata: {
    page?: number;
    section?: string;
    startOffset: number;
    endOffset: number;
  };
}

// Vector Store Entry
interface VectorEntry {
  id: string;
  vector: number[];
  payload: {
    userId: string;
    type: 'memory' | 'document' | 'conversation';
    content: string;
    sourceId: string;
    timestamp: Date;
    metadata: Record<string, any>;
  };
}

// Task Automation
interface Task {
  id: string;
  userId: string;
  type: 'scheduled' | 'triggered' | 'webhook';
  name: string;
  description: string;
  enabled: boolean;
  trigger: TaskTrigger;
  action: TaskAction;
  createdAt: Date;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
}

interface TaskTrigger {
  type: 'cron' | 'event' | 'webhook';
  config: Record<string, any>;
}

interface TaskAction {
  type: 'api_call' | 'notification' | 'llm_query';
  config: Record<string, any>;
}
```

### Database Schema (Prisma)

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id            String         @id @default(uuid())
  email         String         @unique
  username      String         @unique
  passwordHash  String
  preferences   Json           @default("{}")
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  
  conversations Conversation[]
  documents     Document[]
  memories      Memory[]
  tasks         Task[]
  
  @@index([email])
}

model Conversation {
  id           String    @id @default(uuid())
  userId       String
  title        String
  summary      String?
  tags         String[]
  messageCount Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages     Message[]
  
  @@index([userId, createdAt])
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
  userId       String
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
  
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, status])
}

model Memory {
  id           String   @id @default(uuid())
  userId       String
  type         String
  content      String   @db.Text
  importance   Float    @default(0.5)
  accessCount  Int      @default(0)
  lastAccessed DateTime @default(now())
  createdAt    DateTime @default(now())
  tags         String[]
  metadata     Json     @default("{}")
  source       String?
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, type])
  @@index([userId, importance])
}

model Task {
  id          String    @id @default(uuid())
  userId      String
  type        String
  name        String
  description String?
  enabled     Boolean   @default(true)
  trigger     Json
  action      Json
  createdAt   DateTime  @default(now())
  lastRun     DateTime?
  nextRun     DateTime?
  runCount    Int       @default(0)
  
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, enabled])
}
```

---

## Authentication & Multi-User Support

### Authentication Strategy

```typescript
// JWT Token Structure
interface AccessToken {
  userId: string;
  email: string;
  iat: number;
  exp: number; // 15 minutes
}

interface RefreshToken {
  userId: string;
  tokenId: string;
  iat: number;
  exp: number; // 30 days
}
```

### Security Features

1. **Password Security**
   - Argon2id hashing (more secure than bcrypt)
   - Minimum password requirements (12 chars, complexity)
   - Password reset via email (optional)

2. **Token Management**
   - Short-lived access tokens (15 min)
   - Long-lived refresh tokens (30 days)
   - Refresh token rotation
   - Token blacklisting for logout

3. **Rate Limiting**
   ```typescript
   // Login endpoint: 5 attempts per 15 minutes
   // API endpoints: 100 requests per minute per user
   // Upload endpoint: 10 uploads per hour
   ```

4. **Multi-User Isolation**
   - All queries filtered by userId
   - Vector DB collections per user
   - Separate document storage directories
   - No cross-user data access

### Optional Features

- **Social OAuth**: Google, GitHub (if needed later)
- **2FA**: TOTP-based two-factor authentication
- **API Keys**: For programmatic access

---

## Backup & Data Persistence

### Backup Strategy

```typescript
interface BackupConfig {
  schedule: 'daily' | 'weekly' | 'manual';
  retention: number; // days
  includeVectors: boolean;
  includeDocuments: boolean;
  compression: boolean;
  encryption: boolean;
}
```

### Backup Components

1. **PostgreSQL Database**
   ```bash
   # Daily automated backup
   pg_dump -h localhost -U user -d secondbrain > backup_$(date +%Y%m%d).sql
   ```

2. **Vector Database (Qdrant)**
   ```bash
   # Snapshot API
   POST /collections/{collection_name}/snapshots
   ```

3. **Uploaded Documents**
   ```bash
   # Incremental backup to external drive
   robocopy /data/documents /backup/documents /MIR /R:3 /W:5
   ```

4. **LLM Models**
   - Store in separate directory
   - Not included in regular backups (too large)
   - Document model versions in config

### Export Formats

```typescript
// Conversation Export
interface ConversationExport {
  version: string;
  exportedAt: Date;
  conversation: Conversation;
  messages: Message[];
  format: 'json' | 'markdown' | 'pdf';
}

// Full User Data Export (GDPR compliance)
interface UserDataExport {
  version: string;
  exportedAt: Date;
  user: User;
  conversations: Conversation[];
  documents: Document[];
  memories: Memory[];
}
```

### Disaster Recovery

1. **Recovery Time Objective (RTO)**: < 1 hour
2. **Recovery Point Objective (RPO)**: < 24 hours
3. **Backup Testing**: Monthly automated restore tests

---

## Monitoring & Observability

### Logging Strategy

```typescript
// Structured Logging with Winston or Pino
interface LogEntry {
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  service: 'api' | 'llm' | 'vector' | 'worker';
  userId?: string;
  requestId: string;
  message: string;
  metadata?: Record<string, any>;
  error?: Error;
}

// Log Levels per Environment
const logConfig = {
  development: 'debug',
  production: 'info'
};
```

### Performance Metrics

```typescript
interface SystemMetrics {
  // API Performance
  api: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
  
  // LLM Performance
  llm: {
    inferenceTime: {
      p50: number;
      p95: number;
      p99: number;
    };
    tokensPerSecond: number;
    queueDepth: number;
    activeRequests: number;
  };
  
  // Vector DB Performance
  vectorDb: {
    searchLatency: number;
    indexSize: number;
    queryRate: number;
  };
  
  // System Resources
  system: {
    cpuUsage: number;
    memoryUsage: number;
    gpuUsage: number;
    gpuMemory: number;
    diskUsage: number;
  };
}
```

### Monitoring Dashboard

```typescript
// Expose metrics endpoint
GET /api/metrics  // Prometheus-compatible format

// Key Metrics to Track:
- Request rate and latency
- Error rates by endpoint
- LLM inference time
- GPU utilization
- Memory usage (VRAM and RAM)
- Active WebSocket connections
- Vector DB query performance
- Queue depth and wait times
```

### Error Tracking

```typescript
// Error Categories
enum ErrorType {
  AUTHENTICATION = 'AUTH_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  LLM_INFERENCE = 'LLM_ERROR',
  VECTOR_DB = 'VECTOR_ERROR',
  FILE_PROCESSING = 'FILE_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  INTERNAL = 'INTERNAL_ERROR'
}

// Error Response Format
interface ErrorResponse {
  error: {
    type: ErrorType;
    message: string;
    code: string;
    details?: Record<string, any>;
    requestId: string;
    timestamp: Date;
  };
}
```

### Health Checks

```typescript
GET /api/health

{
  status: 'healthy' | 'degraded' | 'down',
  timestamp: Date,
  services: {
    api: { status: 'up', latency: 5 },
    database: { status: 'up', latency: 12 },
    vectorDb: { status: 'up', latency: 8 },
    llmService: { status: 'up', latency: 150 },
    redis: { status: 'up', latency: 2 }
  },
  version: string
}
```

---

## Integration & Automation

### Plugin Architecture

```typescript
// Plugin Interface
interface Plugin {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  
  // Lifecycle hooks
  onInstall?(): Promise<void>;
  onEnable?(): Promise<void>;
  onDisable?(): Promise<void>;
  
  // Event handlers
  onMessage?(message: Message): Promise<void>;
  onMemoryCreated?(memory: Memory): Promise<void>;
  
  // Custom actions
  actions: PluginAction[];
}

interface PluginAction {
  id: string;
  name: string;
  description: string;
  parameters: ActionParameter[];
  execute(params: Record<string, any>): Promise<any>;
}
```

### Built-in Integrations

1. **Calendar Integration**
   ```typescript
   - Google Calendar / Outlook
   - Actions: Create event, list events, get schedule
   - Triggers: Upcoming event reminder
   ```

2. **Email Integration**
   ```typescript
   - IMAP/SMTP support
   - Actions: Send email, search emails, draft response
   - Triggers: New email received
   ```

3. **Smart Home Integration**
   ```typescript
   - Home Assistant API
   - Actions: Control lights, check sensors, run automations
   - Triggers: Sensor state change
   ```

4. **File System Integration**
   ```typescript
   - Actions: Read file, write file, list directory
   - Watch directories for changes
   - OCR for images
   ```

5. **Web Scraping**
   ```typescript
   - Actions: Fetch URL, extract content, monitor page
   - Parse and store in memory
   ```

### Webhook System

```typescript
// Webhook Configuration
interface Webhook {
  id: string;
  userId: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string; // For signature verification
  enabled: boolean;
}

enum WebhookEvent {
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_SENT = 'message.sent',
  DOCUMENT_UPLOADED = 'document.uploaded',
  MEMORY_CREATED = 'memory.created',
  TASK_COMPLETED = 'task.completed'
}

// Webhook Payload
interface WebhookPayload {
  event: WebhookEvent;
  timestamp: Date;
  data: any;
  signature: string; // HMAC-SHA256
}
```

---

## Mobile & Remote Access

### Progressive Web App (PWA)

```typescript
// Service Worker for offline support
// Cache strategies:
- API responses: Network-first, fallback to cache
- Static assets: Cache-first
- Documents: On-demand caching

// Features:
- Install to home screen
- Offline message queue
- Background sync
- Push notifications (optional)
```

### Responsive Design

```typescript
// Breakpoints
const breakpoints = {
  mobile: '320px - 767px',
  tablet: '768px - 1023px',
  desktop: '1024px+'
};

// Adaptive Features:
- Mobile: Touch-optimized, simplified UI
- Tablet: Split view, swipe gestures
- Desktop: Full features, keyboard shortcuts
```

### Remote Access Options

1. **VPN Access** (Recommended)
   - WireGuard or Tailscale
   - Secure tunnel to home network
   - No port forwarding needed

2. **Cloudflare Tunnel** (Alternative)
   - Zero-trust access
   - No public IP needed
   - Free tier available

3. **SSH Tunnel** (Advanced)
   - For technical users
   - Port forwarding via SSH

### Mobile-Specific Features

```typescript
// Push Notifications
- New message when app in background
- Task reminders
- System alerts

// Mobile Optimizations
- Reduced payload sizes
- Image compression
- Lazy loading
- Voice recording from mobile
```

---

## Scaling & Performance

### Caching Strategy

```typescript
// Redis Cache Layers
interface CacheConfig {
  // User session cache
  sessions: {
    ttl: 3600, // 1 hour
    type: 'memory'
  },
  
  // Conversation context cache
  context: {
    ttl: 1800, // 30 minutes
    type: 'redis'
  },
  
  // Vector search results cache
  vectorResults: {
    ttl: 300, // 5 minutes
    type: 'redis'
  },
  
  // Model output cache (for identical queries)
  modelCache: {
    ttl: 86400, // 24 hours
    type: 'redis'
  }
}
```

### Database Optimization

```typescript
// Connection Pooling
const dbConfig = {
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000
  }
};

// Query Optimization
- Indexed queries on userId, createdAt
- Pagination for large result sets
- Eager loading for related data
- Materialized views for analytics
```

### Vector Database Scaling

```typescript
// Qdrant Optimization
{
  // HNSW Index parameters
  hnsw_config: {
    m: 16,              // Number of edges per node
    ef_construct: 100,  // Construction time quality
    full_scan_threshold: 10000
  },
  
  // Quantization for reduced memory
  quantization_config: {
    type: 'scalar',     // or 'product' for larger datasets
    quantile: 0.99
  },
  
  // Sharding (for future)
  sharding: {
    number_of_shards: 1  // Increase when >1M vectors
  }
}
```

### Model Management

```typescript
// Model Switching Strategy
interface ModelConfig {
  models: {
    fast: 'mistral-7b-q4',      // Quick responses
    balanced: 'llama-3.1-8b-q4', // Default
    smart: 'llama-3.1-70b-q4',   // Complex reasoning (if future GPU upgrade)
  },
  
  autoSelect: boolean, // Choose model based on query complexity
  warmupOnStart: boolean,
  maxConcurrentInferences: 2
}

// Model Caching
- Keep active model in VRAM
- Lazy loading for alternate models
- Unload after 10 min idle
```

### Future Scaling Considerations

**When Vector DB > 10M entries:**
- Implement sharding
- Use approximate search
- Archive old conversations

**When concurrent users > 10:**
- Add Redis for session management
- Implement request queuing
- Load balancing (multiple API instances)

**When VRAM insufficient:**
- Model quantization (Q3 instead of Q4)
- Layer offloading to CPU
- Consider cloud GPU for burst capacity

---

## Development Workflow

### Project Structure
```
second-brain/
├── apps/
│   ├── api/                 # TypeScript API server
│   ├── web/                 # React/Vue web interface
│   ├── pi-client/           # Raspberry Pi client
│   └── llm-service/         # Python LLM inference service
├── packages/
│   ├── types/               # Shared TypeScript types
│   ├── utils/               # Shared utilities
│   └── config/              # Shared configuration
├── docs/                    # Documentation
├── scripts/                 # Build & deployment scripts
└── prisma/                  # Database schema & migrations
```

### Development Tools

```json
{
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "vitest": "^1.0.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.0",
    "prisma": "^5.8.0",
    "husky": "^8.0.0",
    "lint-staged": "^15.2.0"
  }
}
```

### Git Workflow

```bash
# Branch Strategy
main              # Production-ready code
develop           # Integration branch
feature/*         # New features
fix/*            # Bug fixes
docs/*           # Documentation updates

# Pre-commit Hooks
- ESLint check
- Prettier format
- TypeScript compilation
- Unit tests
```

### Testing Strategy

```typescript
// Test Coverage Targets
{
  statements: 80,
  branches: 75,
  functions: 80,
  lines: 80
}

// Test Types
- Unit tests: Vitest
- Integration tests: Supertest
- E2E tests: Playwright
- Load tests: k6
```

---

#### Technology Stack
```javascript
Frontend: React or Vue.js
UI Library: Tailwind CSS + shadcn/ui
State: Zustand or Redux Toolkit
Real-time: Socket.io-client (WebSocket)
Audio: Web Audio API for voice recording
```

#### Features
- Text chat interface
- Voice recording/playback
- Document upload with drag-drop
- Memory browser
- Conversation history
- Settings panel

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Set up development environment
- [ ] Install and configure LLM inference engine
- [ ] Create basic FastAPI server
- [ ] Implement text chat endpoint
- [ ] Test LLM performance and response times

### Phase 2: Memory System (Week 2-3)
- [ ] Set up Qdrant vector database
- [ ] Implement embedding pipeline
- [ ] Create memory storage/retrieval functions
- [ ] Build conversation persistence
- [ ] Test RAG with sample documents

### Phase 3: Web Interface (Week 3-4)
- [ ] Build React/Vue chat interface
- [ ] Implement WebSocket connection
- [ ] Add file upload functionality
- [ ] Create conversation history view
- [ ] Test end-to-end text interaction

### Phase 4: Voice Pipeline (Week 4-5)
- [ ] Set up STT (Faster-Whisper)
- [ ] Set up TTS (Coqui/Piper)
- [ ] Create voice endpoints
- [ ] Implement audio streaming
- [ ] Test voice latency

### Phase 5: Raspberry Pi Integration (Week 5-6)
- [ ] Install OS on Raspberry Pi
- [ ] Configure audio hardware
- [ ] Install wake word detection
- [ ] Create Pi client software
- [ ] Test Pi-to-server communication
- [ ] Deploy and test full voice loop

### Phase 6: Advanced Features (Week 6-8)
- [ ] Multi-modal support (images, PDFs)
- [ ] Task automation framework
- [ ] Enhanced memory consolidation
- [ ] Performance optimization
- [ ] Security hardening

---

## Technical Specifications

### Main Server Requirements

#### Software
```yaml
Python: 3.10+
CUDA: 12.1+ (for GPU acceleration)

Core Dependencies:
  - fastapi
  - uvicorn[standard]
  - vllm or llama-cpp-python
  - qdrant-client
  - sentence-transformers
  - faster-whisper
  - TTS (Coqui)
  - langchain (for RAG orchestration)
  - redis (optional, for caching)

Document Processing:
  - pypdf2 / pdfplumber
  - python-docx
  - Pillow
  - pytesseract (OCR)
```

#### Configuration
```ini
# LLM Settings
MODEL_NAME=mistralai/Mistral-7B-Instruct-v0.2
QUANTIZATION=awq_4bit
MAX_CONTEXT=8192
GPU_MEMORY=14GB

# Vector DB
QDRANT_PATH=./data/qdrant
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
VECTOR_DIM=384

# Memory
CONVERSATION_HISTORY=50
MEMORY_RETRIEVAL_K=5
```

### Raspberry Pi Requirements

#### Hardware
- Raspberry Pi 4 (4GB) minimum, 8GB recommended
- USB Microphone or ReSpeaker hat
- Speaker (3.5mm or USB)
- MicroSD card (32GB+)

#### Software
```yaml
OS: Raspberry Pi OS Lite (64-bit) or DietPi
Python: 3.9+

Dependencies:
  - pyaudio / sounddevice
  - porcupine (wake word)
  - vosk or whisper.cpp (local STT option)
  - piper-tts (local TTS option)
  - requests / websocket-client
```

---

## Network Architecture

### Local Network Setup
```
Router/Network
    ├── Main Server: 192.168.1.100:8000 (API)
    ├── Main Server: 192.168.1.100:3000 (Web UI)
    └── Raspberry Pi: 192.168.1.101 (Voice Client)
```

### Security Considerations
- Use HTTPS with self-signed cert (local)
- Optional: VPN for remote access
- Firewall rules to restrict external access
- No data leaves local network (100% privacy)

---

## Performance Targets

### Response Times
- **Text Query**: < 500ms (first token)
- **Voice-to-Voice**: < 2 seconds (total latency)
  - STT: 300-500ms
  - LLM: 500-800ms
  - TTS: 400-700ms
- **RAG Query**: < 1 second (with retrieval)

### Throughput
- Concurrent requests: 3-5 (limited by single GPU)
- Tokens/second: 60-100 (depending on model)

---

## Cost Estimate

### One-time Costs
- Raspberry Pi 4 (8GB): $75-95
- USB Microphone: $15-30
- Speaker: $20-50
- MicroSD Card: $10-15
- **Total**: ~$120-190

### No Recurring Costs
- All processing local
- No API fees
- No cloud storage

---

## Alternative Considerations

### If Response Time is Too Slow
1. Use smaller model (Phi-3 Mini 3.8B)
2. Implement model caching with vLLM
3. Use speculative decoding
4. Reduce context window

### If VRAM is Insufficient
1. Use GGUF Q4 quantization (llama.cpp)
2. Offload layers to CPU (slower but works)
3. Use smaller embedding model

### If Raspberry Pi is Underpowered
1. Use Pi 5 instead of Pi 4
2. Offload all processing to server
3. Use multiple Pis for different rooms

---

## Next Steps

1. **Review this design** - Does it meet your needs?
2. **Choose specific models** - Mistral 7B or Llama 3.1 8B?
3. **Start with Phase 1** - Set up basic LLM inference
4. **Iterate and expand** - Add features progressively

Would you like me to start creating the project structure and initial code?
