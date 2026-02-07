# Local PC Server Architecture

## Overview

The Local PC Server is the brain of the system, running on your Windows machine with RTX 4060 Ti (16GB VRAM). It hosts the TypeScript API, LLM inference service, vector database, and all core processing logic.

---

## System Components

### 1. Hardware Configuration

```yaml
GPU: NVIDIA RTX 4060 Ti (16GB VRAM)
CPU: Modern multi-core processor (e.g., Ryzen/Intel i5+)
RAM: 32GB recommended (minimum 16GB)
Storage: 
  - 500GB+ SSD for system and databases
  - Optional: Additional HDD for document backup
OS: Windows 11 Pro (WSL2 optional for containerization)
```

---

## Software Stack

### Core Services

```
┌─────────────────────────────────────────────────────────┐
│                    Local PC Server                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  TypeScript API Server (Node.js)               │    │
│  │  - Express.js/Fastify                          │    │
│  │  - Socket.io for WebSocket                     │    │
│  │  - Port: 8000 (API), 8001 (WebSocket)         │    │
│  └────────────────────────────────────────────────┘    │
│           ↓ HTTP/gRPC                                   │
│  ┌────────────────────────────────────────────────┐    │
│  │  Python LLM Service                            │    │
│  │  - vLLM or llama.cpp server                    │    │
│  │  - Model: Mistral 7B / Llama 3.1 8B           │    │
│  │  - Port: 8080                                  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  PostgreSQL Database                           │    │
│  │  - User data, conversations, documents         │    │
│  │  - Port: 5432                                  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Qdrant Vector Database                        │    │
│  │  - Embeddings, semantic search                 │    │
│  │  - Port: 6333                                  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Redis Cache (Optional)                        │    │
│  │  - Session management, caching                 │    │
│  │  - Port: 6379                                  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  STT/TTS Services                              │    │
│  │  - Faster-Whisper (STT)                        │    │
│  │  - Coqui TTS / Piper TTS                       │    │
│  │  - Port: 8082 (STT), 8083 (TTS)               │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Installation & Setup

### Prerequisites

```powershell
# Install Node.js 20 LTS
winget install OpenJS.NodeJS.LTS

# Install Python 3.11
winget install Python.Python.3.11

# Install PostgreSQL
winget install PostgreSQL.PostgreSQL

# Install Git
winget install Git.Git

# Install CUDA Toolkit 12.1+
# Download from: https://developer.nvidia.com/cuda-downloads

# Install Docker Desktop (optional, for Qdrant)
winget install Docker.DockerDesktop
```

### Environment Setup

```powershell
# Clone repository
git clone https://github.com/DenMantm/second-brain.git
cd second-brain

# Install Node dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Variables

```bash
# .env file

# API Configuration
NODE_ENV=development
API_PORT=8000
WS_PORT=8001
API_HOST=0.0.0.0

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/secondbrain"

# Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_api_key_here

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# LLM Service
LLM_SERVICE_URL=http://localhost:8080
LLM_MODEL=mistralai/Mistral-7B-Instruct-v0.2
LLM_QUANTIZATION=awq
LLM_MAX_CONTEXT=8192
LLM_GPU_MEMORY_UTILIZATION=0.9

# STT/TTS Services
STT_SERVICE_URL=http://localhost:8082
TTS_SERVICE_URL=http://localhost:8083
WHISPER_MODEL=base.en
TTS_MODEL=tts_models/en/ljspeech/tacotron2-DDC

# Embedding Model
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384

# File Upload
MAX_FILE_SIZE=100MB
UPLOAD_DIR=./data/uploads

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

---

## TypeScript API Server

### Project Structure

```
apps/api/
├── src/
│   ├── config/
│   │   ├── database.ts        # Prisma client setup
│   │   ├── redis.ts           # Redis connection (optional)
│   │   └── env.ts             # Environment validation (Zod)
│   ├── routes/
│   │   ├── chat.routes.ts     # Chat endpoints
│   │   ├── voice.routes.ts    # Voice endpoints
│   │   ├── memory.routes.ts   # Memory management
│   │   └── document.routes.ts # Document upload/management
│   ├── services/
│   │   ├── llm.service.ts     # LLM inference client
│   │   ├── vector.service.ts  # Vector DB operations
│   │   ├── memory.service.ts  # Memory consolidation
│   │   ├── rag.service.ts     # RAG pipeline
│   │   ├── stt.service.ts     # Speech-to-text
│   │   ├── tts.service.ts     # Text-to-speech
│   │   └── auth.service.ts    # Authentication logic
│   ├── controllers/
│   │   ├── chat.controller.ts
│   │   ├── memory.service.ts  # Memory consolidation
│   │   ├── rag.service.ts     # RAG pipeline
│   │   ├── stt.service.ts     # Speech-to-text
│   │   └── tts.service.ts     # Text-to-speech
│   ├── controllers/
│   │   ├── chat.controller.ts
│   │   ├── voice.controller.ts
│   │   ├── memory.controller.ts
│   │   └── document.controller.ts
│   ├── websocket/
│   │   └── index.ts           # TypeScript interfaces
│   ├── app.ts                 # Express app setup
│   └── server.ts              # Server entry point
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── package.json
└── tsconfig.json
```

### Core Implementation

#### Server Entry Point (`server.ts`)

```typescript
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { setupRoutes } from './routes';
import { setupWebSocket } from './websocket';
import { prisma } from './config/database';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: config.corsOrigins,
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
const io = new SocketIOServer(server, {
  cors: {
    origin: '*' // Simple CORS for local single-user setup
  }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: '*' })); // Simple CORS for local use

// WebSocket setup
setupWebSocket(io);

// Error handling
app.use(errorHandler);

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
server.listen(config.apiPort, () => {
  logger.info(`API Server running on port ${config.apiPort}`);
  logger.info(`WebSocket Server running on port ${config.wsPort}`);
});
```

#### LLM Service Client (`services/llm.service.ts`)

```typescript
import axios from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface LLMRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface LLMResponse {
  text: string;
  tokensUsed: number;
  inferenceTime: number;
}

class LLMService {
  private baseURL: string;
  
  constructor() {
    this.baseURL = config.llmServiceUrl;
  }
  
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const response = await axios.post(`${this.baseURL}/v1/completions`, {
        model: config.llmModel,
        prompt: request.prompt,
        max_tokens: request.maxTokens || 512,
        temperature: request.temperature || 0.7,
        stream: false
      });
      
      const inferenceTime = Date.now() - startTime;
      
      return {
        text: response.data.choices[0].text,
        tokensUsed: response.data.usage.total_tokens,
        inferenceTime
      };
    } catch (error) {
      logger.error('LLM inference failed', { error });
      throw new Error('LLM service unavailable');
    }
  }
  
  async *generateStream(request: LLMRequest): AsyncGenerator<string> {
    try {
      const response = await axios.post(
        `${this.baseURL}/v1/completions`,
        {
          model: config.llmModel,
          prompt: request.prompt,
          max_tokens: request.maxTokens || 512,
          temperature: request.temperature || 0.7,
          stream: true
        },
        { responseType: 'stream' }
      );
      
      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.choices[0].text) {
              yield data.choices[0].text;
            }
          }
        }
      }
    } catch (error) {
      logger.error('LLM streaming failed', { error });
      throw new Error('LLM streaming unavailable');
    }
  }
}

export const llmService = new LLMService();
```

#### Vector Service (`services/vector.service.ts`)

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface VectorSearchResult {
  id: string;
  score: number;
  payload: any;
}

class VectorService {
  private client: QdrantClient;
  private collectionName = 'memories';
  
  constructor() {
    this.client = new QdrantClient({
      url: config.qdrantUrl,
      apiKey: config.qdrantApiKey
    });
  }
  
  async initialize() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        c => c.name === this.collectionName
      );
      
      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: config.embeddingDimension,
            distance: 'Cosine'
          }
        });
        logger.info('Vector collection created');
      }
    } catch (error) {
      logger.error('Vector DB initialization failed', { error });
      throw error;
    }
  }
  
  async upsert(id: string, vector: number[], payload: any) {
    try {
      await this.client.upsert(this.collectionName, {
        points: [{
          id,
          vector,
          payload
        }]
      });
    } catch (error) {
      logger.error('Vector upsert failed', { error, id });
      throw error;
    }
  }
  
  async search(
    vector: number[],
    limit: number = 5,
    filter?: any
  ): Promise<VectorSearchResult[]> {
    try {
      const results = await this.client.search(this.collectionName, {
        vector,
        limit,
        filter
      });
      
      return results.map(r => ({
        id: r.id.toString(),
        score: r.score,
        payload: r.payload
      }));
    } catch (error) {
      logger.error('Vector search failed', { error });
      throw error;
    }
  }
  
  async delete(id: string) {
    try {
      await this.client.delete(this.collectionName, {
        points: [id]
      });
    } catch (error) {
      logger.error('Vector delete failed', { error, id });
      throw error;
    }
  }
}

export const vectorService = new VectorService();
```

#### RAG Service (`services/rag.service.ts`)

```typescript
import { pipeline } from '@xenova/transformers';
import { vectorService } from './vector.service';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

class RAGService {
  private embedder: any;
  
  async initialize() {
    this.embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
    logger.info('Embedding model loaded');
  }
  
  async embed(text: string): Promise<number[]> {
    const output = await this.embedder(text, {
      pooling: 'mean',
      normalize: true
    });
    return Array.from(output.data);
  }
  
  async retrieveContext(
    query: string,
    userId: string,
    limit: number = 5
  ): Promise<string[]> {
    const queryEmbedding = await this.embed(query);
    
    const results = await vectorService.search(
      queryEmbedding,
      limit,
      { must: [{ key: 'userId', match: { value: userId } }] }
    );
    
    return results.map(r => r.payload.content);
  }
  
  async indexDocument(
    documentId: string,
    userId: string,
    chunks: string[]
  ) {
    for (const [index, chunk] of chunks.entries()) {
      const embedding = await this.embed(chunk);
      const id = `${documentId}_chunk_${index}`;
      
      await vectorService.upsert(id, embedding, {
        userId,
        documentId,
        content: chunk,
        chunkIndex: index,
        type: 'document'
      });
    }
    
    logger.info('Document indexed', { documentId, chunks: chunks.length });
  }
  
  async saveMemory(
    content: string,
    userId: string,
    type: 'fact' | 'preference' | 'event',
    importance: number = 0.5
  ) {
    const embedding = await this.embed(content);
    
    const memory = await prisma.memory.create({
      data: {
        userId,
        content,
        type,
        importance
      }
    });
    
    await vectorService.upsert(memory.id, embedding, {
      userId,
      content,
      type,
      importance,
      createdAt: memory.createdAt
    });
    
    return memory;
  }
}

export const ragService = new RAGService();
```

---

## Python LLM Service

### Structure

```
apps/llm-service/
├── main.py                 # FastAPI server
├── model_loader.py         # Model initialization
├── inference.py            # Inference logic
├── requirements.txt
└── config.yaml            # Model configuration
```

### Implementation (`main.py`)

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, AsyncGenerator
import torch
from vllm import LLM, SamplingParams
from vllm.utils import random_uuid

app = FastAPI()

# Global model instance
llm: Optional[LLM] = None

class CompletionRequest(BaseModel):
    model: str
    prompt: str
    max_tokens: int = 512
    temperature: float = 0.7
    stream: bool = False

class CompletionResponse(BaseModel):
    id: str
    object: str = "text_completion"
    created: int
    model: str
    choices: list
    usage: dict

@app.on_event("startup")
async def load_model():
    global llm
    
    model_name = "mistralai/Mistral-7B-Instruct-v0.2"
    
    llm = LLM(
        model=model_name,
        quantization="awq",
        gpu_memory_utilization=0.9,
        max_model_len=8192,
        trust_remote_code=True
    )
    
    print(f"Model {model_name} loaded successfully")

@app.post("/v1/completions")
async def create_completion(request: CompletionRequest):
    if llm is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    sampling_params = SamplingParams(
        temperature=request.temperature,
        max_tokens=request.max_tokens,
        top_p=0.95
    )
    
    outputs = llm.generate([request.prompt], sampling_params)
    
    response = CompletionResponse(
        id=random_uuid(),
        created=int(time.time()),
        model=request.model,
        choices=[{
            "text": output.outputs[0].text,
            "index": 0,
            "finish_reason": "stop"
        } for output in outputs],
        usage={
            "prompt_tokens": len(outputs[0].prompt_token_ids),
            "completion_tokens": len(outputs[0].outputs[0].token_ids),
            "total_tokens": len(outputs[0].prompt_token_ids) + len(outputs[0].outputs[0].token_ids)
        }
    )
    
    return response

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": llm is not None,
        "gpu_available": torch.cuda.is_available()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
```

---

## Database Setup

### PostgreSQL Initialization

```powershell
# Create database
psql -U postgres
CREATE DATABASE secondbrain;
CREATE USER sbuser WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE secondbrain TO sbuser;
\q

# Run Prisma migrations
npx prisma migrate dev
npx prisma generate
```

### Qdrant Setup

```powershell
# Using Docker
docker run -d -p 6333:6333 -p 6334:6334 `
  -v ${PWD}/qdrant_storage:/qdrant/storage:z `
  qdrant/qdrant

# Or download Windows binary
# https://github.com/qdrant/qdrant/releases
```

---

## Performance Optimization

### GPU Configuration

```python
# Optimal vLLM settings for RTX 4060 Ti (16GB)
{
  "gpu_memory_utilization": 0.9,  # Use 90% of VRAM
  "max_num_batched_tokens": 8192,
  "max_num_seqs": 256,
  "quantization": "awq",          # 4-bit quantization
  "tensor_parallel_size": 1       # Single GPU
}
```

### Memory Management

```typescript
// Node.js heap size
// package.json
{
  "scripts": {
    "start": "node --max-old-space-size=4096 dist/server.js"
  }
}
```

---

## Deployment

### Running Services

```powershell
# Start PostgreSQL (if not running as service)
pg_ctl start

# Start Qdrant
docker start qdrant

# Start Redis (optional)
redis-server

# Start Python LLM Service
cd apps/llm-service
python main.py

# Start TypeScript API Server
cd apps/api
npm run dev

# Start Web Interface
cd apps/web
npm run dev
```

### Production Deployment

```powershell
# Build TypeScript
npm run build

# Run with PM2 (process manager)
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'api-server',
      script: './dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'llm-service',
      script: 'python',
      args: 'main.py',
      cwd: './apps/llm-service',
      interpreter: 'python'
    }
  ]
};
```

---

## Monitoring

### Windows Performance Monitor

```powershell
# Monitor GPU usage
nvidia-smi -l 1

# Monitor process resources
Get-Process -Name node,python | Select-Object CPU,PM,NPM,WS
```

### Application Logs

```typescript
// Winston logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

---

## Troubleshooting

### Common Issues

**CUDA Out of Memory**
```bash
Solution: Reduce gpu_memory_utilization to 0.8
or use smaller quantization (Q3 instead of Q4)
```

**Slow Inference**
```bash
Check: GPU utilization (should be 90%+)
Solution: Enable vLLM continuous batching
or reduce max_model_len
```

**Database Connection Errors**
```bash
Check: PostgreSQL service running
Verify: DATABASE_URL in .env
Solution: Restart PostgreSQL service
```

**Vector Search Slow**
```bash
Check: Collection size and index parameters
Solution: Adjust HNSW ef_construct parameter
or enable quantization
```

---

## Next Steps

1. Complete initial setup and verify all services start
2. Run test suite to validate functionality
3. Benchmark LLM performance on your hardware
4. Configure monitoring and alerts
5. Set up automated backups

See [RASPBERRY_PI_CLIENT.md](./RASPBERRY_PI_CLIENT.md) for the voice client setup.
