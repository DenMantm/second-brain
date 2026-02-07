# Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Second Brain system to a production environment with Docker, nginx reverse proxy, SSL certificates, and automated backups.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Setup](#docker-setup)
3. [Nginx Reverse Proxy](#nginx-reverse-proxy)
4. [SSL Certificates](#ssl-certificates)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [Deployment Steps](#deployment-steps)
8. [Backup Automation](#backup-automation)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Hardware Requirements (Production)

```yaml
Server Specifications:
  GPU: NVIDIA RTX 4060 Ti 16GB (or equivalent)
  CPU: 8+ cores recommended
  RAM: 64GB recommended (32GB minimum)
  Storage:
    - 500GB+ NVMe SSD (system and databases)
    - 1TB+ HDD (backups and archives)
  Network: Static local IP address

Raspberry Pi (optional, for voice):
  Model: Raspberry Pi 4/5 (8GB)
  Storage: 32GB microSD
  Network: WiFi or Ethernet
```

### Software Requirements

```yaml
Operating System: Windows 11 Pro or Windows Server 2022
Runtime:
  - Node.js: 20.x LTS
  - Python: 3.11.x
  - Docker Desktop: Latest
Required Tools:
  - Git
  - NVIDIA CUDA Toolkit: 12.1+
  - NVIDIA cuDNN: 8.x
  - PostgreSQL: 15.x
```

---

## Docker Setup

### 1. Install Docker Desktop

```powershell
# Install Docker Desktop for Windows
winget install Docker.DockerDesktop

# Verify installation
docker --version
docker-compose --version

# Enable WSL2 backend (recommended)
wsl --install
wsl --set-default-version 2
```

### 2. NVIDIA Container Runtime

```powershell
# Install NVIDIA Container Toolkit
# Download from: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

# Test GPU access in Docker
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
```

### 3. Docker Compose Configuration

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: secondbrain-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DATABASE_NAME}
      POSTGRES_USER: ${DATABASE_USER}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backups/postgres:/backups
    ports:
      - "5432:5432"
    networks:
      - secondbrain-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DATABASE_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Qdrant Vector Database
  qdrant:
    image: qdrant/qdrant:latest
    container_name: secondbrain-qdrant
    restart: unless-stopped
    environment:
      QDRANT__SERVICE__API_KEY: ${QDRANT_API_KEY}
    volumes:
      - qdrant-data:/qdrant/storage
      - ./backups/qdrant:/backups
    ports:
      - "6333:6333"
      - "6334:6334"
    networks:
      - secondbrain-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache (optional)
  redis:
    image: redis:7-alpine
    container_name: secondbrain-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    networks:
      - secondbrain-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Python LLM Service
  llm-service:
    build:
      context: ./apps/llm-service
      dockerfile: Dockerfile
    container_name: secondbrain-llm
    restart: unless-stopped
    environment:
      MODEL_NAME: ${LLM_MODEL}
      GPU_MEMORY_UTILIZATION: ${LLM_GPU_MEMORY_UTILIZATION}
      MAX_MODEL_LEN: ${LLM_MAX_CONTEXT}
    volumes:
      - ./models:/models
      - ./logs/llm:/logs
    ports:
      - "8080:8080"
    networks:
      - secondbrain-network
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # TypeScript API Server
  api:
    build:
      context: .
      dockerfile: ./apps/api/Dockerfile
    container_name: secondbrain-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@postgres:5432/${DATABASE_NAME}
      QDRANT_URL: http://qdrant:6333
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      LLM_SERVICE_URL: http://llm-service:8080
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - ./data/uploads:/app/data/uploads
      - ./logs/api:/app/logs
    ports:
      - "8000:8000"
      - "8001:8001"
    networks:
      - secondbrain-network
    depends_on:
      postgres:
        condition: service_healthy
      qdrant:
        condition: service_healthy
      redis:
        condition: service_healthy
      llm-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Web Interface
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    container_name: secondbrain-web
    restart: unless-stopped
    environment:
      VITE_API_URL: ${PUBLIC_API_URL}
      VITE_WS_URL: ${PUBLIC_WS_URL}
    ports:
      - "3000:80"
    networks:
      - secondbrain-network
    depends_on:
      - api
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: secondbrain-nginx
    restart: unless-stopped
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    ports:
      - "80:80"
      - "443:443"
    networks:
      - secondbrain-network
    depends_on:
      - api
      - web
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  secondbrain-network:
    driver: bridge

volumes:
  postgres-data:
  qdrant-data:
  redis-data:
```

---

## Nginx Reverse Proxy

### 1. Create Nginx Configuration

Create `nginx/nginx.conf`:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

    # Upstream servers
    upstream api_backend {
        server api:8000 max_fails=3 fail_timeout=30s;
    }

    upstream ws_backend {
        server api:8001 max_fails=3 fail_timeout=30s;
    }

    upstream web_backend {
        server web:80 max_fails=3 fail_timeout=30s;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name secondbrain.local;

        # Allow Let's Encrypt challenges
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name secondbrain.local;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # API endpoints
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;

            proxy_pass http://api_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Auth endpoints (stricter rate limit)
        location /api/auth/ {
            limit_req zone=auth_limit burst=2 nodelay;

            proxy_pass http://api_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket endpoint
        location /ws/ {
            proxy_pass http://ws_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket timeouts
            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;
        }

        # Web interface
        location / {
            proxy_pass http://web_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

---

## SSL Certificates

### Option 1: Self-Signed Certificate (Local Network)

```powershell
# Create SSL directory
mkdir nginx\ssl

# Generate self-signed certificate (valid for 1 year)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout nginx\ssl\key.pem `
  -out nginx\ssl\cert.pem `
  -subj "/C=US/ST=State/L=City/O=Organization/CN=secondbrain.local"

# Set permissions
icacls nginx\ssl\*.pem /inheritance:r /grant:r "${env:USERNAME}:(R)"
```

### Option 2: Let's Encrypt (If Exposing to Internet)

```yaml
# Add Certbot to docker-compose.yml
  certbot:
    image: certbot/certbot
    container_name: secondbrain-certbot
    volumes:
      - ./nginx/ssl:/etc/letsencrypt
      - ./nginx/certbot:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

```powershell
# Initial certificate
docker-compose run --rm certbot certonly --webroot `
  -w /var/www/certbot `
  -d your-domain.com `
  --email your-email@example.com `
  --agree-tos
```

---

## Environment Configuration

### Production `.env` File

Create `.env` in project root:

```bash
# Environment
NODE_ENV=production

# Server URLs
PUBLIC_API_URL=https://secondbrain.local/api
PUBLIC_WS_URL=wss://secondbrain.local/ws

# Database
DATABASE_NAME=secondbrain_prod
DATABASE_USER=sbuser
DATABASE_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE

# Qdrant
QDRANT_API_KEY=CHANGE_ME_QDRANT_API_KEY

# Redis
REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD

# JWT
JWT_SECRET=CHANGE_ME_SUPER_SECRET_JWT_KEY_MIN_32_CHARS
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# LLM Configuration
LLM_MODEL=mistralai/Mistral-7B-Instruct-v0.2
LLM_GPU_MEMORY_UTILIZATION=0.9
LLM_MAX_CONTEXT=8192

# File Upload
MAX_FILE_SIZE=100MB
UPLOAD_DIR=./data/uploads

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *  # 2 AM daily
BACKUP_RETENTION_DAYS=30
BACKUP_DIR=./backups
```

### Secure Environment Variables

```powershell
# Generate secure secrets
$JwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$QdrantKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$RedisPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

Write-Host "JWT_SECRET=$JwtSecret"
Write-Host "QDRANT_API_KEY=$QdrantKey"
Write-Host "REDIS_PASSWORD=$RedisPassword"
```

---

## Database Setup

### 1. Initialize PostgreSQL

```powershell
# Start PostgreSQL container
docker-compose up -d postgres

# Wait for database to be ready
Start-Sleep -Seconds 10

# Run Prisma migrations
docker-compose exec api npx prisma migrate deploy

# Seed database (optional)
docker-compose exec api npm run seed
```

### 2. Initialize Qdrant

```powershell
# Start Qdrant container
docker-compose up -d qdrant

# Verify Qdrant is running
curl http://localhost:6333/health
```

---

## Deployment Steps

### 1. Clone Repository

```powershell
git clone https://github.com/DenMantm/second-brain.git
cd second-brain
```

### 2. Configure Environment

```powershell
# Copy example env file
cp .env.example .env

# Edit .env with secure values
notepad .env
```

### 3. Build Docker Images

```powershell
# Build all services
docker-compose build

# Or build individually
docker-compose build api
docker-compose build web
docker-compose build llm-service
```

### 4. Download LLM Models

```powershell
# Create models directory
mkdir models

# Download model (example using Hugging Face CLI)
pip install huggingface-hub

# Download Mistral 7B AWQ
python -c "
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id='TheBloke/Mistral-7B-Instruct-v0.2-AWQ',
    local_dir='./models/mistral-7b-instruct-awq'
)
"
```

### 5. Start Services

```powershell
# Start all services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f api
```

### 6. Verify Deployment

```powershell
# Health check
curl https://secondbrain.local/api/health

# Test API
curl -X POST https://secondbrain.local/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","username":"testuser","password":"SecureP@ssw0rd123"}'
```

---

## Backup Automation

### 1. Backup Script

Create `scripts/backup.ps1`:

```powershell
# backup.ps1
param(
    [string]$BackupDir = ".\backups",
    [int]$RetentionDays = 30
)

$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupPath = Join-Path $BackupDir $Date

# Create backup directory
New-Item -ItemType Directory -Force -Path $BackupPath | Out-Null

Write-Host "Starting backup: $Date"

# 1. Backup PostgreSQL
Write-Host "Backing up PostgreSQL..."
docker-compose exec -T postgres pg_dump -U sbuser secondbrain_prod `
    | Out-File -FilePath "$BackupPath\postgres_backup.sql"

# 2. Backup Qdrant snapshots
Write-Host "Backing up Qdrant..."
$QdrantCollections = @("memories", "documents")
foreach ($collection in $QdrantCollections) {
    Invoke-RestMethod -Method POST `
        -Uri "http://localhost:6333/collections/$collection/snapshots" `
        -Headers @{"api-key" = $env:QDRANT_API_KEY}
}
Copy-Item -Path ".\qdrant_storage\snapshots\*" -Destination $BackupPath -Recurse

# 3. Backup uploads
Write-Host "Backing up uploaded files..."
Copy-Item -Path ".\data\uploads\*" -Destination "$BackupPath\uploads" -Recurse

# 4. Backup configuration
Write-Host "Backing up configuration..."
Copy-Item -Path ".\.env" -Destination "$BackupPath\.env.backup"

# 5. Create archive
Write-Host "Creating compressed archive..."
Compress-Archive -Path "$BackupPath\*" -DestinationPath "$BackupPath.zip"
Remove-Item -Path $BackupPath -Recurse -Force

# 6. Delete old backups
Write-Host "Cleaning up old backups..."
$CutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "*.zip" | 
    Where-Object { $_.LastWriteTime -lt $CutoffDate } |
    Remove-Item -Force

Write-Host "Backup completed: $BackupPath.zip"
```

### 2. Schedule Backup Task

```powershell
# Create scheduled task for daily backups
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-File C:\path\to\second-brain\scripts\backup.ps1"

$Trigger = New-ScheduledTaskTrigger -Daily -At 2am

$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName "SecondBrain-Backup" `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -User "SYSTEM" `
    -RunLevel Highest
```

### 3. Restore from Backup

Create `scripts/restore.ps1`:

```powershell
# restore.ps1
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

Write-Host "Restoring from: $BackupFile"

# Extract backup
$TempDir = Join-Path $env:TEMP "secondbrain_restore"
Expand-Archive -Path $BackupFile -DestinationPath $TempDir -Force

# Stop services
Write-Host "Stopping services..."
docker-compose down

# Restore PostgreSQL
Write-Host "Restoring PostgreSQL..."
docker-compose up -d postgres
Start-Sleep -Seconds 10
Get-Content "$TempDir\postgres_backup.sql" | 
    docker-compose exec -T postgres psql -U sbuser -d secondbrain_prod

# Restore Qdrant
Write-Host "Restoring Qdrant..."
Copy-Item -Path "$TempDir\qdrant_snapshots\*" `
    -Destination ".\qdrant_storage\snapshots\" -Recurse -Force

# Restore uploads
Write-Host "Restoring uploaded files..."
Copy-Item -Path "$TempDir\uploads\*" -Destination ".\data\uploads\" -Recurse -Force

# Start services
Write-Host "Starting services..."
docker-compose up -d

# Cleanup
Remove-Item -Path $TempDir -Recurse -Force

Write-Host "Restore completed successfully"
```

---

## Monitoring & Maintenance

### 1. Health Check Script

Create `scripts/healthcheck.ps1`:

```powershell
# healthcheck.ps1

$Services = @(
    @{ Name = "API"; URL = "http://localhost:8000/api/health" },
    @{ Name = "Web"; URL = "http://localhost:3000" },
    @{ Name = "LLM"; URL = "http://localhost:8080/health" },
    @{ Name = "Qdrant"; URL = "http://localhost:6333/health" }
)

$AllHealthy = $true

foreach ($service in $Services) {
    try {
        $response = Invoke-WebRequest -Uri $service.URL -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ $($service.Name): Healthy" -ForegroundColor Green
        } else {
            Write-Host "✗ $($service.Name): Unhealthy (Status: $($response.StatusCode))" -ForegroundColor Red
            $AllHealthy = $false
        }
    } catch {
        Write-Host "✗ $($service.Name): Unreachable" -ForegroundColor Red
        $AllHealthy = $false
    }
}

if ($AllHealthy) {
    Write-Host "`nAll services healthy!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nSome services are down!" -ForegroundColor Red
    exit 1
}
```

### 2. Log Monitoring

```powershell
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f llm-service

# View last 100 lines
docker-compose logs --tail=100 api

# Export logs
docker-compose logs --no-color > logs_export.txt
```

### 3. Resource Monitoring

```powershell
# Monitor Docker container resources
docker stats

# GPU monitoring
nvidia-smi -l 1

# Disk usage
docker system df
```

### 4. Updates & Maintenance

```powershell
# Update images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build

# Clean up unused resources
docker system prune -a --volumes

# View system information
docker info
```

---

## Troubleshooting

### Common Issues

**1. Service fails to start**
```powershell
# Check logs
docker-compose logs service-name

# Check container status
docker-compose ps

# Restart specific service
docker-compose restart service-name
```

**2. Database connection errors**
```powershell
# Verify PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U sbuser -d secondbrain_prod -c "SELECT 1;"

# Check database logs
docker-compose logs postgres
```

**3. GPU not detected in LLM service**
```powershell
# Verify NVIDIA runtime
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi

# Check Docker GPU support
docker info | Select-String -Pattern "Runtimes"
```

**4. High memory usage**
```powershell
# Check container memory
docker stats --no-stream

# Limit container memory (in docker-compose.yml)
# deploy:
#   resources:
#     limits:
#       memory: 16G
```

**5. Slow LLM inference**
```powershell
# Monitor GPU usage
nvidia-smi -l 1

# Check model quantization
# Ensure AWQ/GPTQ 4-bit models are used

# Adjust GPU memory utilization
# Edit .env: LLM_GPU_MEMORY_UTILIZATION=0.85
```

---

## Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Generate strong JWT secret (64+ characters)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure firewall rules (block external access to ports)
- [ ] Set up automated backups
- [ ] Enable Docker security scanning
- [ ] Implement rate limiting in nginx
- [ ] Use least-privilege user accounts
- [ ] Regularly update Docker images
- [ ] Monitor logs for suspicious activity

---

## Performance Tuning

### Database Optimization

```sql
-- PostgreSQL tuning (adjust based on RAM)
-- Edit postgresql.conf or use docker environment variables

shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
work_mem = 16MB
```

### Nginx Optimization

```nginx
# Increase worker connections
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
}
```

### Docker Resource Limits

```yaml
# In docker-compose.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G
```

---

## Next Steps

1. Complete deployment and verify all services
2. Set up automated backups
3. Configure monitoring and alerting
4. Perform load testing
5. Document custom configurations
6. Train users on the system

See [DEVELOPMENT.md](./DEVELOPMENT.md) for development workflow and [API_REFERENCE.md](./API_REFERENCE.md) for API details.

---

**Last Updated:** January 4, 2026
