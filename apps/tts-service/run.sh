#!/bin/bash
# Run TTS service in WSL

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run the service
python -m uvicorn src.main:app --host 0.0.0.0 --port 3002 --reload
