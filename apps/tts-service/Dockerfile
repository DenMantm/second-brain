# TTS Service Dockerfile with GPU Support
# Using NVIDIA PyTorch image which has CUDA 12.4, cuDNN 9, Python 3.10 pre-configured
# This provides a stable, tested environment for GPU acceleration
FROM nvcr.io/nvidia/pytorch:24.01-py3

# Prevent interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# Set working directory
WORKDIR /app

# Install cuDNN 9 from NVIDIA repos (required by onnxruntime-gpu 1.23.2 with CUDA 12.x)
RUN apt-get update && \
    apt-get install -y wget && \
    wget https://developer.download.nvidia.com/compute/cudnn/redist/cudnn/linux-x86_64/cudnn-linux-x86_64-9.5.1.17_cuda12-archive.tar.xz && \
    tar -xf cudnn-linux-x86_64-9.5.1.17_cuda12-archive.tar.xz && \
    cp -P cudnn-linux-x86_64-9.5.1.17_cuda12-archive/lib/* /usr/local/cuda/lib64/ && \
    cp cudnn-linux-x86_64-9.5.1.17_cuda12-archive/include/* /usr/local/cuda/include/ && \
    rm -rf cudnn-linux-x86_64-9.5.1.17_cuda12-archive* && \
    ldconfig && \
    rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Install onnxruntime-gpu (compatible with CUDA 12.x)
RUN pip install --no-cache-dir onnxruntime-gpu

# Copy requirements file
COPY requirements.txt .

# Install piper-tts WITHOUT dependencies (base image already has onnxruntime-gpu)
RUN pip install --no-cache-dir --no-deps piper-tts==1.2.0

# Install piper-phonemize (piper-tts dependency)
RUN pip install --no-cache-dir piper-phonemize==1.1.0

# Install other dependencies (excluding onnxruntime since it's in base image)
RUN pip install --no-cache-dir \
    fastapi==0.109.0 \
    uvicorn[standard]==0.27.0 \
    pydantic==2.5.0 \
    pydantic-settings==2.1.0 \
    soundfile==0.12.1 \
    pydub==0.25.1 \
    websockets==12.0 \
    python-multipart==0.0.6 \
    redis==5.0.1 \
    python-dotenv==1.0.0 \
    requests

# Verify ONNX Runtime GPU is available
RUN python -c "import onnxruntime as ort; print('ONNX Runtime version:', ort.__version__); print('Available providers:', ort.get_available_providers())"

# Copy application code
COPY src/ ./src/
COPY .env .env

# Create directory for models (will be mounted as volume)
RUN mkdir -p /models

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV CUDA_VISIBLE_DEVICES=0

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:3002/ping')" || exit 1

# Run the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3002"]
