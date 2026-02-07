# Development Guide

## Overview

This guide provides instructions for setting up the development environment, coding standards, testing guidelines, and contribution workflow for the Second Brain project.

---

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Architecture](#project-architecture)
3. [Code Style Guide](#code-style-guide)
4. [Testing Guidelines](#testing-guidelines)
5. [Git Workflow](#git-workflow)
6. [Pull Request Process](#pull-request-process)
7. [Debugging](#debugging)
8. [Common Development Tasks](#common-development-tasks)

---

## Development Environment Setup

### Prerequisites

```yaml
Required Software:
  - Node.js: 20.x LTS
  - Python: 3.11.x
  - Git: Latest
  - VS Code: Latest (recommended)
  - Docker Desktop: Latest (for services)
  - PostgreSQL: 15.x
  - CUDA Toolkit: 12.1+ (for GPU development)

Recommended VS Code Extensions:
  - ESLint
  - Prettier
  - TypeScript Vue Plugin (Volar)
  - Python
  - Pylance
  - Docker
  - GitLens
  - Thunder Client (API testing)
  - Tailwind CSS IntelliSense
```

### Initial Setup

```powershell
# 1. Clone repository
git clone https://github.com/DenMantm/second-brain.git
cd second-brain

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Development dependencies

# 4. Set up environment variables
cp .env.example .env
# Edit .env with development values

# 5. Start Docker services (PostgreSQL, Qdrant, Redis)
docker-compose -f docker-compose.dev.yml up -d

# 6. Initialize database
cd apps/api
npx prisma migrate dev
npx prisma generate
npx prisma db seed  # Optional: seed with test data

# 7. Download development LLM model (smaller for faster iteration)
# Use a smaller model like Phi-3 Mini for development
python scripts/download_model.py --model microsoft/Phi-3-mini-4k-instruct

# 8. Verify setup
npm run verify-setup
```

### Development Environment File

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: secondbrain-dev-postgres
    environment:
      POSTGRES_DB: secondbrain_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpassword
    ports:
      - "5432:5432"
    volumes:
      - postgres-dev-data:/var/lib/postgresql/data

  qdrant:
    image: qdrant/qdrant:latest
    container_name: secondbrain-dev-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant-dev-data:/qdrant/storage

  redis:
    image: redis:7-alpine
    container_name: secondbrain-dev-redis
    ports:
      - "6379:6379"
    command: redis-server --requirepass devpassword

volumes:
  postgres-dev-data:
  qdrant-dev-data:
```

### Development `.env`

```bash
# Development environment
NODE_ENV=development

# Server URLs
API_PORT=8000
WS_PORT=8001
API_HOST=localhost

PUBLIC_API_URL=http://localhost:8000/api
PUBLIC_WS_URL=ws://localhost:8001

# Database
DATABASE_URL="postgresql://dev:devpassword@localhost:5432/secondbrain_dev"

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=dev-key

# Redis
REDIS_URL=redis://:devpassword@localhost:6379

# LLM Service
LLM_SERVICE_URL=http://localhost:8080
LLM_MODEL=microsoft/Phi-3-mini-4k-instruct
LLM_QUANTIZATION=awq
LLM_MAX_CONTEXT=4096
LLM_GPU_MEMORY_UTILIZATION=0.8

# JWT
JWT_SECRET=dev-secret-key-not-for-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/dev.log

# Hot Reload
VITE_HMR_PORT=5173
```

---

## Project Architecture

### Monorepo Structure

```
second-brain/
├── apps/
│   ├── api/              # TypeScript API server
│   ├── web/              # React web interface
│   ├── pi-client/        # Raspberry Pi client
│   └── llm-service/      # Python LLM service
├── packages/
│   ├── types/            # Shared TypeScript types
│   ├── utils/            # Shared utilities
│   ├── config/           # Shared configuration
│   └── eslint-config/    # Shared ESLint config
├── docs/                 # Documentation
├── scripts/              # Automation scripts
├── tests/                # Integration tests
├── .github/              # GitHub Actions
├── package.json          # Root package.json (workspaces)
└── tsconfig.json         # Root TypeScript config
```

### Workspace Configuration

Root `package.json`:

```json
{
  "name": "second-brain",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:api\" \"npm run dev:web\" \"npm run dev:llm\"",
    "dev:api": "npm run dev --workspace=apps/api",
    "dev:web": "npm run dev --workspace=apps/web",
    "dev:llm": "cd apps/llm-service && python main.py",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "lint": "npm run lint --workspaces",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md}\"",
    "typecheck": "tsc --build",
    "prepare": "husky install"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "concurrently": "^8.2.0",
    "eslint": "^8.56.0",
    "husky": "^8.0.3",
    "lint-staged": "^15.2.0",
    "prettier": "^3.1.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

---

## Code Style Guide

### TypeScript Style Guide

#### Naming Conventions

```typescript
// Interfaces and Types: PascalCase
interface User {
  id: string;
  name: string;
}

type UserRole = 'admin' | 'user';

// Variables and Functions: camelCase
const userName = 'John';
function getUserById(id: string): User | null {
  // ...
}

// Classes: PascalCase
class UserService {
  private readonly repository: UserRepository;
  
  constructor(repository: UserRepository) {
    this.repository = repository;
  }
}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const API_BASE_URL = 'http://localhost:8000';

// Private properties: prefix with underscore (optional)
class Example {
  private _internalState: number;
}

// Enum: PascalCase for enum, UPPER_SNAKE_CASE for values
enum HttpStatus {
  OK = 200,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500
}
```

#### File Naming

```
kebab-case for files: user-service.ts
PascalCase for React components: UserProfile.tsx
.test.ts for test files: user-service.test.ts
.types.ts for type definitions: user.types.ts
.config.ts for configuration: database.config.ts
```

#### Code Organization

```typescript
// 1. Imports (grouped and sorted)
// External dependencies
import { Injectable } from '@nestjs/common';
import express from 'express';

// Internal dependencies
import { UserService } from '@/services/user.service';
import { logger } from '@/utils/logger';

// Types
import type { User, UserCreateInput } from '@/types/user.types';

// 2. Constants
const DEFAULT_PAGE_SIZE = 20;

// 3. Types and Interfaces
interface ServiceConfig {
  timeout: number;
}

// 4. Main implementation
export class UserController {
  // Properties
  private readonly userService: UserService;
  
  // Constructor
  constructor(userService: UserService) {
    this.userService = userService;
  }
  
  // Public methods
  async getUsers(): Promise<User[]> {
    return this.userService.findAll();
  }
  
  // Private methods
  private validateUser(user: User): boolean {
    return !!user.email;
  }
}
```

#### TypeScript Best Practices

```typescript
// ✅ Do: Use explicit types
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Don't: Rely on implicit any
function calculateTotal(items) {  // items: any
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ Do: Use const assertions for literals
const CONFIG = {
  apiUrl: 'http://localhost:8000',
  timeout: 5000
} as const;

// ✅ Do: Use optional chaining
const userName = user?.profile?.name;

// ✅ Do: Use nullish coalescing
const displayName = user.name ?? 'Anonymous';

// ✅ Do: Use discriminated unions
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ✅ Do: Prefer interfaces over types for object shapes
interface User {
  id: string;
  name: string;
}

// ✅ Do: Use type guards
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  );
}

// ✅ Do: Use readonly for immutability
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
}

// ✅ Do: Use generics for reusable types
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}
```

### React/Vue Style Guide

```typescript
// React Component Structure
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/stores/userStore';
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
  const { user, fetchUser } = useUserStore();
  
  // 2. Effects
  useEffect(() => {
    fetchUser(userId);
  }, [userId, fetchUser]);
  
  // 3. Event handlers
  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      // Update logic
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

### Python Style Guide

```python
# Follow PEP 8

# Imports (grouped)
import os
import sys
from typing import List, Dict, Optional

import numpy as np
import torch
from fastapi import FastAPI

from .models import User
from .utils import logger

# Constants
MAX_TOKENS = 512
DEFAULT_TEMPERATURE = 0.7

# Class definition
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
        self._tokenizer = None
    
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
    
    def _load_model(self) -> None:
        """Load the model (private method)."""
        # Implementation
        pass

# Type hints
def process_messages(messages: List[Dict[str, str]]) -> Optional[str]:
    """Process chat messages."""
    if not messages:
        return None
    
    return messages[-1].get("content")
```

---

## Testing Guidelines

### Unit Tests (Vitest for TypeScript)

```typescript
// services/user.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from './user.service';
import { UserRepository } from '@/repositories/user.repository';
import type { User } from '@/types/user.types';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: UserRepository;
  
  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    } as any;
    
    userService = new UserService(userRepository);
  });
  
  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        username: 'testuser'
      };
      
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
    
    it('should throw error when repository fails', async () => {
      vi.mocked(userRepository.findById).mockRejectedValue(
        new Error('Database error')
      );
      
      await expect(userService.getUserById('123')).rejects.toThrow('Database error');
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/api/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/config/database';

describe('Authentication API', () => {
  beforeAll(async () => {
    // Setup test database
    await prisma.$connect();
  });
  
  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });
  
  describe('POST /api/auth/register', () => {
    it('should register new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'SecureP@ssw0rd123'
        })
        .expect(201);
      
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user.email).toBe('newuser@example.com');
    });
    
    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          username: 'testuser',
          password: 'SecureP@ssw0rd123'
        })
        .expect(400);
      
      expect(response.body.error.type).toBe('VALIDATION_ERROR');
    });
    
    it('should return 409 for duplicate email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          username: 'user1',
          password: 'SecureP@ssw0rd123'
        });
      
      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          username: 'user2',
          password: 'SecureP@ssw0rd123'
        })
        .expect(409);
      
      expect(response.body.error.message).toContain('already exists');
    });
  });
});
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000');
  });
  
  test('should send message and receive response', async ({ page }) => {
    // Type message
    await page.fill('[data-testid="chat-input"]', 'Hello, AI!');
    await page.click('[data-testid="send-button"]');
    
    // Wait for user message to appear
    await expect(page.locator('[data-role="user"]').last()).toContainText('Hello, AI!');
    
    // Wait for AI response
    await expect(page.locator('[data-role="assistant"]').last()).toBeVisible({
      timeout: 10000
    });
    
    // Verify response is not empty
    const responseText = await page.locator('[data-role="assistant"]').last().textContent();
    expect(responseText).toBeTruthy();
    expect(responseText!.length).toBeGreaterThan(0);
  });
  
  test('should handle voice input', async ({ page }) => {
    // Grant microphone permission
    await page.context().grantPermissions(['microphone']);
    
    // Click voice button
    await page.click('[data-testid="voice-button"]');
    
    // Verify recording indicator
    await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
    
    // Stop recording
    await page.click('[data-testid="voice-button"]');
    
    // Wait for transcription and response
    await expect(page.locator('[data-role="assistant"]').last()).toBeVisible({
      timeout: 15000
    });
  });
});
```

### Test Coverage

```json
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.ts'
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      }
    }
  }
});
```

---

## Git Workflow

### Branch Strategy

```
main              # Production-ready code
├── develop       # Integration branch
│   ├── feature/add-voice-controls
│   ├── feature/improve-memory-search
│   ├── fix/chat-websocket-reconnect
│   └── docs/update-api-reference
```

### Commit Message Convention

```bash
# Format: <type>(<scope>): <subject>

# Types:
feat     # New feature
fix      # Bug fix
docs     # Documentation changes
style    # Code style changes (formatting, etc.)
refactor # Code refactoring
perf     # Performance improvements
test     # Adding or updating tests
chore    # Maintenance tasks
ci       # CI/CD changes

# Examples:
git commit -m "feat(chat): add streaming response support"
git commit -m "fix(auth): resolve token refresh race condition"
git commit -m "docs(api): update authentication endpoints"
git commit -m "test(memory): add unit tests for memory service"
git commit -m "refactor(llm): extract prompt engineering to separate module"
```

### Pre-commit Hooks

```javascript
// .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{js,json,md}": [
      "prettier --write"
    ],
    "*.py": [
      "black",
      "flake8"
    ]
  }
}
```

---

## Pull Request Process

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Changes Made
- Added voice streaming support
- Improved WebSocket reconnection logic
- Updated API documentation

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
- [ ] Dependent changes merged

## Screenshots (if applicable)
[Add screenshots here]

## Additional Notes
[Any additional information]
```

### Review Checklist

**Reviewers should verify:**
- [ ] Code quality and style adherence
- [ ] Test coverage adequate
- [ ] No security vulnerabilities
- [ ] Performance considerations
- [ ] Documentation updated
- [ ] Breaking changes noted
- [ ] Migration path provided (if needed)

---

## Debugging

### VS Code Launch Configuration

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API Server",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/apps/api",
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Python LLM Service",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/apps/llm-service/main.py",
      "console": "integratedTerminal",
      "justMyCode": true
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test", "--", "--run"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    }
  ]
}
```

### Debugging Tips

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Use debugger statement
function complexFunction() {
  debugger; // Execution will pause here
  // ...
}

// Log with context
logger.debug('Processing request', {
  userId,
  conversationId,
  messageLength: message.length
});

// Conditional breakpoints in VS Code
// Right-click on breakpoint > Edit Breakpoint > Expression
// Example: userId === '123'
```

---

## Common Development Tasks

### Adding a New API Endpoint

```typescript
// 1. Define route
// apps/api/src/routes/example.routes.ts
import { Router } from 'express';
import { exampleController } from '@/controllers/example.controller';
import { auth } from '@/middleware/auth';

const router = Router();

router.post('/example', auth, exampleController.create);
router.get('/example/:id', auth, exampleController.getById);

export default router;

// 2. Create controller
// apps/api/src/controllers/example.controller.ts
import { Request, Response } from 'express';
import { exampleService } from '@/services/example.service';

export const exampleController = {
  async create(req: Request, res: Response) {
    const result = await exampleService.create(req.body);
    res.status(201).json(result);
  },
  
  async getById(req: Request, res: Response) {
    const result = await exampleService.findById(req.params.id);
    res.json(result);
  }
};

// 3. Implement service
// apps/api/src/services/example.service.ts
export const exampleService = {
  async create(data: any) {
    // Implementation
  },
  
  async findById(id: string) {
    // Implementation
  }
};

// 4. Add tests
// apps/api/src/controllers/example.controller.test.ts
describe('Example Controller', () => {
  it('should create example', async () => {
    // Test implementation
  });
});

// 5. Update API documentation
// docs/API_REFERENCE.md
```

### Adding a New Database Model

```prisma
// 1. Update Prisma schema
// prisma/schema.prisma
model Example {
  id        String   @id @default(uuid())
  name      String
  userId    String
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
}

// 2. Create migration
npx prisma migrate dev --name add-example-model

// 3. Generate Prisma client
npx prisma generate

// 4. Create TypeScript types
// packages/types/src/example.types.ts
export interface Example {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
}
```

### Adding a New React Component

```typescript
// 1. Create component file
// apps/web/src/components/example/ExampleComponent.tsx
import React from 'react';

interface ExampleComponentProps {
  title: string;
  onAction: () => void;
}

export const ExampleComponent: React.FC<ExampleComponentProps> = ({
  title,
  onAction
}) => {
  return (
    <div>
      <h2>{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  );
};

// 2. Create tests
// apps/web/src/components/example/ExampleComponent.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExampleComponent } from './ExampleComponent';

describe('ExampleComponent', () => {
  it('should render title', () => {
    render(<ExampleComponent title="Test" onAction={() => {}} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
  
  it('should call onAction when button clicked', () => {
    const onAction = vi.fn();
    render(<ExampleComponent title="Test" onAction={onAction} />);
    
    fireEvent.click(screen.getByText('Action'));
    expect(onAction).toHaveBeenCalled();
  });
});

// 3. Export from index
// apps/web/src/components/example/index.ts
export { ExampleComponent } from './ExampleComponent';
```

---

## Useful Commands

```powershell
# Development
npm run dev                    # Start all services
npm run dev:api               # Start API only
npm run dev:web               # Start web only

# Building
npm run build                  # Build all
npm run build --workspace=apps/api  # Build specific app

# Testing
npm test                       # Run all tests
npm run test:watch            # Watch mode
npm run test:coverage         # With coverage
npm run test:e2e              # E2E tests only

# Linting & Formatting
npm run lint                   # Lint all
npm run lint:fix              # Fix linting issues
npm run format                # Format code

# Database
npx prisma studio             # Open Prisma Studio
npx prisma migrate dev        # Create migration
npx prisma migrate reset      # Reset database
npx prisma db seed            # Seed database

# Docker
docker-compose -f docker-compose.dev.yml up -d     # Start services
docker-compose -f docker-compose.dev.yml logs -f   # View logs
docker-compose -f docker-compose.dev.yml down      # Stop services

# Utilities
npm run verify-setup          # Verify development environment
npm run clean                 # Clean build artifacts
npm run typecheck             # TypeScript type checking
```

---

## Resources

### Documentation
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vitest Documentation](https://vitest.dev/)

### Internal Docs
- [System Design](../SYSTEM_DESIGN.md)
- [API Reference](./API_REFERENCE.md)
- [Deployment Guide](./DEPLOYMENT.md)

---

**Last Updated:** January 4, 2026
