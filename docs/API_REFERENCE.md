# API Reference Documentation

## Overview

The Second Brain API provides RESTful endpoints and WebSocket connections for interacting with the AI assistant. All API requests require authentication via JWT tokens, except for the auth endpoints.

**Base URL:** `http://localhost:8000/api`  
**WebSocket URL:** `ws://localhost:8001`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Chat & Conversation](#chat--conversation)
3. [Voice Interaction](#voice-interaction)
4. [Memory Management](#memory-management)
5. [Document Management](#document-management)
6. [User & Settings](#user--settings)
7. [System & Health](#system--health)
8. [WebSocket Events](#websocket-events)
9. [Error Codes](#error-codes)
10. [Rate Limiting](#rate-limiting)

---

## Authentication

### Register User

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecureP@ssw0rd123"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "username": "johndoe",
    "createdAt": "2026-01-04T10:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Validation Rules:**
- `email`: Valid email format, unique
- `username`: 3-20 characters, alphanumeric + underscore, unique
- `password`: Minimum 12 characters, must include uppercase, lowercase, number, special character

**Error Responses:**
- `400 Bad Request`: Validation failed
- `409 Conflict`: Email or username already exists

---

### Login

Authenticate and receive access tokens.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd123"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "username": "johndoe"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Rate limit exceeded (5 attempts per 15 minutes)

---

### Refresh Token

Get a new access token using refresh token.

**Endpoint:** `POST /api/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or expired refresh token

---

### Logout

Invalidate current tokens.

**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

---

## Chat & Conversation

### Send Message

Send a text message to the AI assistant.

**Endpoint:** `POST /api/chat`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "What is the weather like today?",
  "conversationId": "uuid-string",  // Optional, omit to start new conversation
  "temperature": 0.7,                // Optional, default 0.7
  "maxTokens": 512                   // Optional, default 512
}
```

**Response:** `200 OK`
```json
{
  "messageId": "msg-uuid",
  "conversationId": "conv-uuid",
  "text": "I don't have access to real-time weather data, but I can help you find that information...",
  "metadata": {
    "tokensUsed": 245,
    "inferenceTime": 1250,
    "model": "mistral-7b-instruct",
    "retrievedContext": [
      "ctx-uuid-1",
      "ctx-uuid-2"
    ]
  },
  "timestamp": "2026-01-04T10:05:30.000Z"
}
```

**Rate Limit:** 100 requests per minute per user

**Error Responses:**
- `400 Bad Request`: Invalid request body
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: Conversation not found
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: LLM service unavailable

---

### Get Conversations

Retrieve list of user's conversations.

**Endpoint:** `GET /api/conversations`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
```
?page=1&limit=20&sortBy=updatedAt&order=desc
```

**Response:** `200 OK`
```json
{
  "conversations": [
    {
      "id": "conv-uuid-1",
      "title": "Weather and Travel Discussion",
      "summary": "User asked about weather and travel recommendations...",
      "messageCount": 15,
      "tags": ["weather", "travel"],
      "createdAt": "2026-01-03T14:20:00.000Z",
      "updatedAt": "2026-01-04T10:05:30.000Z"
    },
    {
      "id": "conv-uuid-2",
      "title": "Python Programming Help",
      "summary": "Discussion about Python async/await patterns...",
      "messageCount": 8,
      "tags": ["programming", "python"],
      "createdAt": "2026-01-02T09:15:00.000Z",
      "updatedAt": "2026-01-02T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### Get Conversation Details

Retrieve specific conversation with all messages.

**Endpoint:** `GET /api/conversation/:id`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "conversation": {
    "id": "conv-uuid-1",
    "title": "Weather and Travel Discussion",
    "summary": "User asked about weather...",
    "tags": ["weather", "travel"],
    "createdAt": "2026-01-03T14:20:00.000Z",
    "updatedAt": "2026-01-04T10:05:30.000Z"
  },
  "messages": [
    {
      "id": "msg-uuid-1",
      "role": "user",
      "content": "What is the weather like today?",
      "timestamp": "2026-01-03T14:20:00.000Z",
      "metadata": {
        "voiceInput": false
      }
    },
    {
      "id": "msg-uuid-2",
      "role": "assistant",
      "content": "I don't have access to real-time weather data...",
      "timestamp": "2026-01-03T14:20:05.000Z",
      "metadata": {
        "tokensUsed": 245,
        "inferenceTime": 1250,
        "model": "mistral-7b-instruct"
      }
    }
  ]
}
```

**Error Responses:**
- `404 Not Found`: Conversation does not exist or user doesn't have access

---

### Delete Conversation

Delete a conversation and all its messages.

**Endpoint:** `DELETE /api/conversation/:id`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "message": "Conversation deleted successfully",
  "deletedId": "conv-uuid-1"
}
```

---

### Export Conversation

Export conversation in various formats.

**Endpoint:** `POST /api/conversation/:id/export`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "format": "markdown"  // Options: "json", "markdown", "pdf"
}
```

**Response:** `200 OK`
```json
{
  "downloadUrl": "/downloads/conv-uuid-1.md",
  "expiresAt": "2026-01-04T11:00:00.000Z"
}
```

---

## Voice Interaction

### Send Voice Message

Send audio for speech-to-text processing and get AI response.

**Endpoint:** `POST /api/voice`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
audio: <File> (WAV, MP3, or OGG format, max 10MB)
conversationId: <string> (optional)
```

**Response:** `200 OK`
```json
{
  "messageId": "msg-uuid",
  "conversationId": "conv-uuid",
  "transcript": "What is the capital of France?",
  "responseText": "The capital of France is Paris...",
  "responseAudio": "base64-encoded-audio-data",
  "metadata": {
    "sttTime": 450,
    "llmTime": 1200,
    "ttsTime": 680,
    "totalTime": 2330,
    "tokensUsed": 180
  },
  "timestamp": "2026-01-04T10:10:00.000Z"
}
```

**Audio Format for Response:**
- Format: WAV
- Sample Rate: 22050 Hz
- Channels: Mono
- Bit Depth: 16-bit

**Rate Limit:** 10 requests per minute per user

**Error Responses:**
- `400 Bad Request`: Invalid audio format or file too large
- `413 Payload Too Large`: Audio file exceeds 10MB
- `503 Service Unavailable`: STT or TTS service unavailable

---

## Memory Management

### Save Memory

Explicitly save information to long-term memory.

**Endpoint:** `POST /api/memory/save`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "User prefers dark mode and minimal UI",
  "type": "preference",  // Options: "fact", "preference", "event"
  "importance": 0.8,     // 0.0 to 1.0
  "tags": ["ui", "settings"],
  "source": "conv-uuid-1"  // Optional conversation reference
}
```

**Response:** `201 Created`
```json
{
  "memory": {
    "id": "mem-uuid",
    "content": "User prefers dark mode and minimal UI",
    "type": "preference",
    "importance": 0.8,
    "tags": ["ui", "settings"],
    "createdAt": "2026-01-04T10:15:00.000Z",
    "accessCount": 0
  }
}
```

---

### Recall Memories

Search and retrieve relevant memories.

**Endpoint:** `GET /api/memory/recall`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
```
?query=user interface preferences&limit=5&type=preference
```

**Response:** `200 OK`
```json
{
  "memories": [
    {
      "id": "mem-uuid-1",
      "content": "User prefers dark mode and minimal UI",
      "type": "preference",
      "importance": 0.8,
      "relevanceScore": 0.95,
      "tags": ["ui", "settings"],
      "createdAt": "2026-01-04T10:15:00.000Z",
      "lastAccessed": "2026-01-04T10:20:00.000Z",
      "accessCount": 3
    },
    {
      "id": "mem-uuid-2",
      "content": "User works as a software engineer",
      "type": "fact",
      "importance": 0.9,
      "relevanceScore": 0.72,
      "tags": ["occupation"],
      "createdAt": "2026-01-02T08:00:00.000Z",
      "lastAccessed": "2026-01-04T10:20:00.000Z",
      "accessCount": 15
    }
  ],
  "totalFound": 2
}
```

---

### Search Memories

Full-text search across all memories.

**Endpoint:** `GET /api/search`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
```
?q=programming&type=fact&tags=python,javascript&page=1&limit=10
```

**Response:** `200 OK`
```json
{
  "results": [
    {
      "id": "mem-uuid-3",
      "content": "User is learning Python async programming",
      "type": "fact",
      "importance": 0.7,
      "tags": ["programming", "python"],
      "matchScore": 0.88,
      "highlightedContent": "User is learning <mark>Python</mark> async <mark>programming</mark>",
      "createdAt": "2026-01-03T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### Update Memory

Modify existing memory entry.

**Endpoint:** `PUT /api/memory/:id`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "User strongly prefers dark mode and minimal UI",
  "importance": 0.9,
  "tags": ["ui", "settings", "critical"]
}
```

**Response:** `200 OK`
```json
{
  "memory": {
    "id": "mem-uuid",
    "content": "User strongly prefers dark mode and minimal UI",
    "type": "preference",
    "importance": 0.9,
    "tags": ["ui", "settings", "critical"],
    "updatedAt": "2026-01-04T10:25:00.000Z"
  }
}
```

---

### Delete Memory

Remove a memory from the system.

**Endpoint:** `DELETE /api/memory/:id`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "message": "Memory deleted successfully",
  "deletedId": "mem-uuid"
}
```

---

## Document Management

### Upload Document

Upload a document for RAG processing.

**Endpoint:** `POST /api/upload`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
file: <File> (PDF, DOCX, TXT, MD, max 100MB)
metadata: <JSON string> (optional)
```

**Metadata Structure:**
```json
{
  "title": "Project Requirements",
  "author": "John Doe",
  "tags": ["project", "requirements"]
}
```

**Response:** `202 Accepted`
```json
{
  "document": {
    "id": "doc-uuid",
    "filename": "project_requirements_20260104.pdf",
    "originalName": "Project Requirements.pdf",
    "mimeType": "application/pdf",
    "size": 2457600,
    "status": "processing",
    "uploadedAt": "2026-01-04T10:30:00.000Z",
    "metadata": {
      "title": "Project Requirements",
      "author": "John Doe",
      "tags": ["project", "requirements"]
    }
  },
  "message": "Document uploaded successfully. Processing in background."
}
```

**Processing Status:**
- `processing`: Being parsed and chunked
- `ready`: Available for queries
- `failed`: Processing failed

**Rate Limit:** 10 uploads per hour per user

**Error Responses:**
- `400 Bad Request`: Invalid file format
- `413 Payload Too Large`: File exceeds 100MB
- `415 Unsupported Media Type`: File type not supported

---

### Get Documents

List all uploaded documents.

**Endpoint:** `GET /api/documents`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
```
?status=ready&page=1&limit=20&sortBy=uploadedAt&order=desc
```

**Response:** `200 OK`
```json
{
  "documents": [
    {
      "id": "doc-uuid-1",
      "filename": "project_requirements_20260104.pdf",
      "originalName": "Project Requirements.pdf",
      "mimeType": "application/pdf",
      "size": 2457600,
      "status": "ready",
      "uploadedAt": "2026-01-04T10:30:00.000Z",
      "processedAt": "2026-01-04T10:31:45.000Z",
      "chunkCount": 48,
      "metadata": {
        "title": "Project Requirements",
        "author": "John Doe",
        "pageCount": 15,
        "tags": ["project", "requirements"]
      }
    }
  ],
  "pagination": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### Get Document Details

Retrieve specific document metadata.

**Endpoint:** `GET /api/document/:id`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "document": {
    "id": "doc-uuid-1",
    "filename": "project_requirements_20260104.pdf",
    "originalName": "Project Requirements.pdf",
    "mimeType": "application/pdf",
    "size": 2457600,
    "status": "ready",
    "uploadedAt": "2026-01-04T10:30:00.000Z",
    "processedAt": "2026-01-04T10:31:45.000Z",
    "chunkCount": 48,
    "metadata": {
      "title": "Project Requirements",
      "author": "John Doe",
      "pageCount": 15,
      "language": "en",
      "tags": ["project", "requirements"]
    }
  },
  "chunks": [
    {
      "id": "chunk-uuid-1",
      "content": "1. Introduction\n\nThis document outlines...",
      "chunkIndex": 0,
      "metadata": {
        "page": 1,
        "section": "Introduction"
      }
    }
  ]
}
```

---

### Delete Document

Remove document and all associated chunks from vector DB.

**Endpoint:** `DELETE /api/document/:id`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "message": "Document deleted successfully",
  "deletedId": "doc-uuid-1",
  "chunksDeleted": 48
}
```

---

### Reindex Document

Re-process document (useful after embedding model update).

**Endpoint:** `POST /api/document/:id/reindex`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `202 Accepted`
```json
{
  "message": "Document reindexing started",
  "documentId": "doc-uuid-1",
  "status": "processing"
}
```

---

## User & Settings

### Get User Profile

Retrieve current user profile.

**Endpoint:** `GET /api/user/profile`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "stats": {
      "totalConversations": 45,
      "totalMessages": 1234,
      "totalDocuments": 12,
      "totalMemories": 156,
      "tokensUsed": 245680
    }
  }
}
```

---

### Update User Profile

Update user information.

**Endpoint:** `PUT /api/user/profile`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "john_doe_updated",
  "email": "newemail@example.com",
  "currentPassword": "OldP@ssw0rd123",  // Required if changing email
  "newPassword": "NewP@ssw0rd456"       // Optional
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "user-uuid",
    "email": "newemail@example.com",
    "username": "john_doe_updated",
    "updatedAt": "2026-01-04T10:40:00.000Z"
  },
  "message": "Profile updated successfully"
}
```

---

### Get User Preferences

Retrieve user preferences and settings.

**Endpoint:** `GET /api/user/preferences`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "preferences": {
    "theme": "dark",
    "voiceEnabled": true,
    "defaultModel": "mistral-7b-instruct",
    "memoryRetention": "high",
    "privacyMode": false,
    "language": "en",
    "notifications": {
      "email": false,
      "push": false
    },
    "chat": {
      "temperature": 0.7,
      "maxTokens": 512,
      "streamResponses": true
    }
  }
}
```

---

### Update User Preferences

Modify user preferences.

**Endpoint:** `PUT /api/user/preferences`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "theme": "light",
  "voiceEnabled": false,
  "chat": {
    "temperature": 0.8,
    "streamResponses": false
  }
}
```

**Response:** `200 OK`
```json
{
  "preferences": {
    "theme": "light",
    "voiceEnabled": false,
    "defaultModel": "mistral-7b-instruct",
    "memoryRetention": "high",
    "privacyMode": false,
    "language": "en",
    "chat": {
      "temperature": 0.8,
      "maxTokens": 512,
      "streamResponses": false
    }
  },
  "message": "Preferences updated successfully"
}
```

---

## System & Health

### Health Check

Check API server health and service status.

**Endpoint:** `GET /api/health`

**No authentication required**

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2026-01-04T10:45:00.000Z",
  "services": {
    "api": {
      "status": "up",
      "latency": 5
    },
    "database": {
      "status": "up",
      "latency": 12
    },
    "vectorDb": {
      "status": "up",
      "latency": 8
    },
    "llmService": {
      "status": "up",
      "latency": 150
    },
    "redis": {
      "status": "up",
      "latency": 2
    }
  },
  "version": "1.0.0",
  "uptime": 86400
}
```

**Possible Status Values:**
- `healthy`: All services operational
- `degraded`: Some services experiencing issues
- `down`: Critical services unavailable

---

### Get System Statistics

Retrieve system usage statistics (admin only).

**Endpoint:** `GET /api/stats`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "system": {
    "cpuUsage": 45.2,
    "memoryUsage": 68.5,
    "gpuUsage": 92.1,
    "gpuMemory": 13824,
    "diskUsage": 34.7
  },
  "api": {
    "requestsPerMinute": 45,
    "averageResponseTime": 234,
    "errorRate": 0.02,
    "activeConnections": 12
  },
  "llm": {
    "tokensPerSecond": 85,
    "averageInferenceTime": 1200,
    "queueDepth": 2,
    "activeRequests": 1
  },
  "database": {
    "totalUsers": 156,
    "totalConversations": 3421,
    "totalMessages": 45678,
    "totalDocuments": 892,
    "totalMemories": 12456
  }
}
```

---

### Get Available Models

List available LLM models.

**Endpoint:** `GET /api/models`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:** `200 OK`
```json
{
  "models": [
    {
      "id": "mistral-7b-instruct",
      "name": "Mistral 7B Instruct",
      "provider": "Mistral AI",
      "parameters": "7B",
      "quantization": "AWQ 4-bit",
      "contextLength": 8192,
      "vramRequired": 8000,
      "status": "active"
    },
    {
      "id": "llama-3.1-8b-instruct",
      "name": "Llama 3.1 8B Instruct",
      "provider": "Meta",
      "parameters": "8B",
      "quantization": "AWQ 4-bit",
      "contextLength": 8192,
      "vramRequired": 9000,
      "status": "available"
    }
  ],
  "activeModel": "mistral-7b-instruct"
}
```

---

### Switch Active Model

Change the active LLM model.

**Endpoint:** `POST /api/models/switch`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "modelId": "llama-3.1-8b-instruct"
}
```

**Response:** `200 OK`
```json
{
  "message": "Model switched successfully",
  "activeModel": "llama-3.1-8b-instruct",
  "loadTime": 15420
}
```

**Note:** Model switching may take 10-30 seconds depending on model size.

---

## WebSocket Events

### Connection

**URL:** `ws://localhost:8001`

**Authentication:**
```javascript
const socket = io('ws://localhost:8001', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Client → Server Events

#### `chat:message`

Send a message via WebSocket for streaming response.

**Payload:**
```json
{
  "text": "Tell me about quantum computing",
  "conversationId": "conv-uuid"  // Optional
}
```

**Response:** Multiple `chat:response` events with streaming tokens

---

#### `voice:stream`

Stream audio data for voice interaction.

**Payload:**
```json
{
  "audio": "<ArrayBuffer>",
  "format": "wav"
}
```

**Response:** `voice:response` event with audio and text

---

#### `typing:start`

Indicate user is typing (shows indicator to other users if multi-user).

**Payload:**
```json
{
  "conversationId": "conv-uuid"
}
```

---

#### `typing:stop`

Indicate user stopped typing.

**Payload:**
```json
{
  "conversationId": "conv-uuid"
}
```

---

### Server → Client Events

#### `chat:response`

Streaming or complete chat response.

**Payload:**
```json
{
  "text": "Quantum computing is...",
  "messageId": "msg-uuid",
  "conversationId": "conv-uuid",
  "done": true,  // false for streaming chunks, true for final chunk
  "metadata": {
    "tokensUsed": 234,
    "inferenceTime": 1450
  }
}
```

---

#### `chat:thinking`

AI is processing the request.

**Payload:**
```json
{
  "status": "thinking",
  "conversationId": "conv-uuid"
}
```

---

#### `voice:response`

Voice interaction complete with audio response.

**Payload:**
```json
{
  "audio": "<ArrayBuffer>",
  "text": "Here is my response...",
  "messageId": "msg-uuid",
  "conversationId": "conv-uuid"
}
```

---

#### `memory:updated`

A new memory was created or updated.

**Payload:**
```json
{
  "memoryId": "mem-uuid",
  "type": "auto-saved",
  "content": "User mentioned they work at XYZ Corp"
}
```

---

#### `error`

An error occurred during processing.

**Payload:**
```json
{
  "code": "LLM_ERROR",
  "message": "LLM service temporarily unavailable",
  "details": {
    "retryAfter": 5000
  }
}
```

---

## Error Codes

### Standard HTTP Error Codes

| Code | Name | Description |
|------|------|-------------|
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource already exists |
| 413 | Payload Too Large | Request body exceeds size limit |
| 415 | Unsupported Media Type | Invalid content type |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | External service (LLM, DB) unavailable |

### Custom Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTH_ERROR` | Authentication failed | 401 |
| `VALIDATION_ERROR` | Request validation failed | 400 |
| `LLM_ERROR` | LLM inference failed | 503 |
| `VECTOR_ERROR` | Vector database error | 500 |
| `FILE_ERROR` | File processing failed | 400 |
| `RATE_LIMIT_ERROR` | Rate limit exceeded | 429 |
| `INTERNAL_ERROR` | Internal server error | 500 |

### Error Response Format

```json
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "code": "VAL_001",
    "details": {
      "field": "email",
      "value": "invalid-email"
    },
    "requestId": "req-uuid",
    "timestamp": "2026-01-04T10:50:00.000Z"
  }
}
```

---

## Rate Limiting

### Limits by Endpoint Category

| Category | Limit | Window |
|----------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| Chat API | 100 requests | 1 minute |
| Voice API | 10 requests | 1 minute |
| Document Upload | 10 uploads | 1 hour |
| Memory Operations | 100 requests | 1 minute |
| General API | 1000 requests | 1 hour |

### Rate Limit Headers

All API responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704361800
```

### Rate Limit Exceeded Response

**Status:** `429 Too Many Requests`

```json
{
  "error": {
    "type": "RATE_LIMIT_ERROR",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "code": "RATE_001",
    "details": {
      "limit": 100,
      "window": "1 minute",
      "retryAfter": 45
    },
    "requestId": "req-uuid",
    "timestamp": "2026-01-04T10:55:00.000Z"
  }
}
```

---

## Pagination

All list endpoints support pagination with consistent query parameters:

```
?page=1&limit=20&sortBy=createdAt&order=desc
```

**Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Versioning

API version is included in the URL:

- Current: `/api/v1/...` (default, can omit `/v1`)
- Future: `/api/v2/...`

**Version Header:**
```
X-API-Version: 1.0.0
```

---

## CORS Configuration

**Allowed Origins:**
- `http://localhost:3000` (development)
- `http://192.168.1.100:3000` (local network)

**Allowed Methods:**
- GET, POST, PUT, DELETE, OPTIONS

**Allowed Headers:**
- Authorization, Content-Type, X-Requested-With

---

## Best Practices

1. **Always include Authorization header** (except public endpoints)
2. **Handle rate limits gracefully** with exponential backoff
3. **Use WebSocket for real-time features** (chat streaming, notifications)
4. **Implement request timeouts** (30 seconds recommended)
5. **Store refresh tokens securely** (HttpOnly cookies or secure storage)
6. **Validate request bodies** before sending to reduce errors
7. **Monitor error responses** and implement retry logic for 5xx errors

---

## Example Client Implementation

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 30000
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
      localStorage.setItem('accessToken', data.accessToken);
      error.config.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(error.config);
    }
    return Promise.reject(error);
  }
);

// Usage
const sendMessage = async (text: string) => {
  const response = await apiClient.post('/chat', { message: text });
  return response.data;
};
```

---

## Support & Feedback

For API issues or questions:
- GitHub Issues: https://github.com/DenMantm/second-brain/issues
- Documentation: https://github.com/DenMantm/second-brain/docs

---

**Last Updated:** January 4, 2026  
**API Version:** 1.0.0
