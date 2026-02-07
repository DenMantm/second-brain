# WSL Setup for Second Brain Services

## Overview

This guide sets up Windows Subsystem for Linux (WSL2) to run all Second Brain services with GPU acceleration support for AI models.

## Prerequisites

- Windows 10/11 (version 21H2 or higher)
- NVIDIA RTX 4060 Ti with latest drivers (536.x+)
- WSL2 enabled
- 16GB+ RAM
- 50GB+ free disk space

## WSL Installation

### 1. Enable WSL2 with GPU Support

```powershell
# Run in PowerShell as Administrator
wsl --install -d Ubuntu-22.04

# Update to WSL2 (if needed)
wsl --set-default-version 2
wsl --set-version Ubuntu-22.04 2

# Verify GPU access
wsl -d Ubuntu-22.04 nvidia-smi
```

### 2. Install NVIDIA CUDA Toolkit in WSL

```bash
# Inside WSL Ubuntu
# Remove old GPG key if exists
sudo apt-key del 7fa2af80

# Add NVIDIA package repositories
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt-get update

# Install CUDA 12.1
sudo apt-get install -y cuda-toolkit-12-1

# Add to PATH
echo 'export PATH=/usr/local/cuda-12.1/bin:$PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/usr/local/cuda-12.1/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc

# Verify CUDA
nvcc --version
nvidia-smi
```

## Node.js Environment Setup

### 3. Install Node.js 20 LTS

```bash
# Install NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show v10.x.x

# Install pnpm (faster package manager)
npm install -g pnpm
```

### 4. Install Python for ML Models

```bash
# Install Python 3.11 (needed for ML model bindings)
sudo apt-get update
sudo apt-get install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3.11-dev python3-pip

# Set Python 3.11 as default
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
sudo update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1

# Verify
python --version  # Should show Python 3.11.x
```

## Database Setup

### 5. Install PostgreSQL

```bash
# Install PostgreSQL 15
sudo apt-get install -y postgresql-15 postgresql-contrib-15

# Start PostgreSQL
sudo service postgresql start

# Create database and user
sudo -u postgres psql << EOF
CREATE USER secondbrain WITH PASSWORD 'your_secure_password';
CREATE DATABASE secondbrain OWNER secondbrain;
GRANT ALL PRIVILEGES ON DATABASE secondbrain TO secondbrain;
\q
EOF

# Auto-start PostgreSQL on WSL boot
echo 'sudo service postgresql start' >> ~/.bashrc
```

### 6. Install Redis

```bash
# Install Redis
sudo apt-get install -y redis-server

# Configure Redis
sudo sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf

# Start Redis
sudo service redis-server start

# Auto-start Redis on WSL boot
echo 'sudo service redis-server start' >> ~/.bashrc

# Test connection
redis-cli ping  # Should return PONG
```

### 7. Install Qdrant (Vector Database)

```bash
# Install Docker (required for Qdrant)
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Start Docker
sudo service docker start
echo 'sudo service docker start' >> ~/.bashrc

# Run Qdrant
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant

# Verify Qdrant
curl http://localhost:6333/health
```

## Project Setup

### 8. Clone and Mount Project

```bash
# Option 1: Work directly in WSL (recommended for performance)
cd ~
mkdir -p projects
cd projects
git clone <your-repo-url> second-brain
cd second-brain

# Option 2: Mount Windows drive (easier file access)
# Windows path: C:\Interesting\repos\second-brain
# WSL path: /mnt/c/Interesting/repos/second-brain
cd /mnt/c/Interesting/repos/second-brain

# NOTE: Working directly in WSL filesystem is 5-10x faster
# than accessing /mnt/c for file I/O operations
```

### 9. Install Project Dependencies

```bash
# Install root dependencies
pnpm install

# Install service-specific dependencies
cd apps/stt-service
pnpm install

cd ../tts-service
pnpm install

cd ../api
pnpm install

cd ../web
pnpm install
```

### 10. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

**.env Configuration:**
```bash
# Node Environment
NODE_ENV=development
PORT=3000

# Database URLs
DATABASE_URL="postgresql://secondbrain:your_secure_password@localhost:5432/secondbrain"
REDIS_URL="redis://localhost:6379"
QDRANT_URL="http://localhost:6333"

# GPU Configuration
CUDA_VISIBLE_DEVICES=0
GPU_MEMORY_FRACTION=0.8

# Service Ports
STT_SERVICE_PORT=3001
TTS_SERVICE_PORT=3002
API_PORT=3000
WEB_PORT=5173

# Model Paths (will be in WSL filesystem)
MODEL_CACHE_DIR="/home/$USER/.cache/models"
```

### 11. Database Migration

```bash
# Run Prisma migrations
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
```

## Performance Optimization

### WSL Configuration

Create `/etc/wsl.conf`:
```ini
[wsl2]
memory=12GB
processors=8
swap=4GB
localhostForwarding=true

[boot]
systemd=true

[interop]
enabled=true
appendWindowsPath=false
```

Restart WSL:
```powershell
# In PowerShell
wsl --shutdown
wsl -d Ubuntu-22.04
```

## Development Workflow

### Starting Services

```bash
# Terminal 1: Start databases (if not auto-started)
sudo service postgresql start
sudo service redis-server start
docker start qdrant

# Terminal 2: Start STT Service
cd ~/projects/second-brain/apps/stt-service
pnpm dev

# Terminal 3: Start TTS Service
cd ~/projects/second-brain/apps/tts-service
pnpm dev

# Terminal 4: Start API
cd ~/projects/second-brain/apps/api
pnpm dev

# Terminal 5: Start Web UI
cd ~/projects/second-brain/apps/web
pnpm dev
```

### Or use Turbo monorepo command:
```bash
# Start all services
cd ~/projects/second-brain
pnpm dev
```

## Accessing from Windows

- **API**: http://localhost:3000
- **Web UI**: http://localhost:5173
- **STT Service**: http://localhost:3001
- **TTS Service**: http://localhost:3002
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Qdrant**: http://localhost:6333

WSL2 automatically forwards localhost ports to Windows!

## Troubleshooting

### GPU Not Detected
```bash
# Check NVIDIA driver
nvidia-smi

# Reinstall CUDA toolkit if needed
sudo apt-get install --reinstall cuda-toolkit-12-1
```

### Port Already in Use
```bash
# Find process using port
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

### Slow File I/O
```bash
# Move project to WSL filesystem (not /mnt/c)
cp -r /mnt/c/Interesting/repos/second-brain ~/projects/
cd ~/projects/second-brain
```

### Docker Issues
```bash
# Restart Docker
sudo service docker restart

# Check Docker status
sudo service docker status
```

## VSCode Integration

### Install Extensions
1. WSL extension (`ms-vscode-remote.remote-wsl`)
2. Docker extension
3. PostgreSQL extension

### Connect to WSL
```bash
# In WSL terminal
code .
```

This opens VSCode in WSL mode with full IntelliSense and debugging support!

## Backup & Snapshots

### Export WSL Image
```powershell
# In PowerShell
wsl --export Ubuntu-22.04 D:\Backups\second-brain-wsl.tar
```

### Import WSL Image
```powershell
wsl --import Ubuntu-SecondBrain D:\WSL D:\Backups\second-brain-wsl.tar
```

## Next Steps

1. ✅ WSL environment ready
2. ⏭️ Implement STT service with TypeScript
3. ⏭️ Implement TTS service with TypeScript
4. ⏭️ Set up API service
5. ⏭️ Create web interface

---

**Status**: 🚧 Setup Complete  
**Last Updated**: February 7, 2026
