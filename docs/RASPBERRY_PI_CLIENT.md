# Raspberry Pi Voice Client Architecture

## Overview

The Raspberry Pi acts as a voice interface to your second brain system, handling wake word detection, audio capture, and audio playback. It communicates with the Local PC Server for speech processing and LLM inference.

---

## Hardware Requirements

### Recommended Configuration

```yaml
Model: Raspberry Pi 4 Model B (8GB) or Raspberry Pi 5
RAM: 4GB minimum, 8GB recommended
Storage: 32GB microSD card (Class 10, A2 rating)
Power: Official 5.1V 3A USB-C power supply
Cooling: Heatsink case or active cooling fan
```

### Audio Hardware

**Option 1: USB Microphone + Speaker (Simplest)**
```yaml
Microphone: Any USB microphone (e.g., Blue Snowball, Samson Go Mic)
Speaker: USB speaker or 3.5mm audio jack speaker
Cost: $30-60 total
```

**Option 2: ReSpeaker HAT (Best Quality)**
```yaml
Model: ReSpeaker 4-Mic Array for Raspberry Pi
Features:
  - 4 microphones with noise cancellation
  - Built-in LEDs for visual feedback
  - 3.5mm audio jack for speaker
  - I2S audio interface
Cost: ~$25
Link: https://www.seeedstudio.com/ReSpeaker-4-Mic-Array-for-Raspberry-Pi.html
```

**Option 3: USB Audio Adapter (Balanced)**
```yaml
Device: USB sound card with mic input
Microphone: 3.5mm lavalier or desk microphone
Speaker: Powered speakers via 3.5mm
Cost: $20-40
```

---

## Operating System Options

### Option 1: Raspberry Pi OS Lite (Recommended)

**Pros:**
- Lightweight and fast
- Full control over configuration
- Official Raspberry Pi support
- Easy customization

**Cons:**
- Requires manual setup
- No GUI (headless)

**Use Case:** Best for dedicated voice client

```bash
# Download
https://www.raspberrypi.com/software/operating-systems/
# Choose: Raspberry Pi OS Lite (64-bit)
```

### Option 2: DietPi

**Pros:**
- Even lighter than Pi OS
- Optimized for minimal resource usage
- Pre-configured software stacks
- Automated optimization

**Cons:**
- Less community support
- Slightly more complex initial setup

**Use Case:** Maximum performance on limited hardware

```bash
# Download
https://dietpi.com/
```

### Option 3: OpenVoiceOS (Alternative)

**Pros:**
- Full voice assistant stack
- Pre-configured STT/TTS
- Wake word detection built-in
- Plug-and-play experience

**Cons:**
- Resource-intensive
- Less flexible
- Harder to integrate with custom backend

**Use Case:** If you want a complete voice OS

```bash
# Download
https://github.com/OpenVoiceOS/ovos-raspbian-image
```

**Recommendation:** Start with **Raspberry Pi OS Lite** for maximum control and performance.

---

## Software Architecture

```
┌─────────────────────────────────────────────────────┐
│              Raspberry Pi Voice Client               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────┐   │
│  │  Wake Word Detection                       │   │
│  │  - Porcupine (Picovoice)                   │   │
│  │  - Always listening for trigger word        │   │
│  │  - Low CPU usage (<5%)                     │   │
│  └────────────────────────────────────────────┘   │
│              ↓ Wake word detected                   │
│  ┌────────────────────────────────────────────┐   │
│  │  Audio Capture                             │   │
│  │  - PyAudio / sounddevice                   │   │
│  │  - 16kHz, 16-bit mono WAV                  │   │
│  │  - VAD (Voice Activity Detection)          │   │
│  └────────────────────────────────────────────┘   │
│              ↓ Audio file created                   │
│  ┌────────────────────────────────────────────┐   │
│  │  WebSocket Client                          │   │
│  │  - Connect to Local PC Server              │   │
│  │  - Send audio data                         │   │
│  │  - Receive text and audio response         │   │
│  └────────────────────────────────────────────┘   │
│              ↓ Audio response received              │
│  ┌────────────────────────────────────────────┐   │
│  │  Audio Playback                            │   │
│  │  - Play TTS response through speaker       │   │
│  │  - LED feedback (optional)                 │   │
│  └────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Installation Guide

### 1. Prepare SD Card

```bash
# On Windows PC, use Raspberry Pi Imager
# Download: https://www.raspberrypi.com/software/

# Steps:
1. Insert microSD card
2. Open Raspberry Pi Imager
3. Choose OS: Raspberry Pi OS Lite (64-bit)
4. Choose Storage: Your SD card
5. Click Settings (gear icon):
   - Enable SSH
   - Set username: pi
   - Set password: your_password
   - Configure WiFi (SSID and password)
   - Set hostname: secondbrain-voice
6. Write

# Eject SD card and insert into Raspberry Pi
```

### 2. Initial Setup (SSH from PC)

```bash
# Find Pi IP address
# Method 1: Check router's connected devices
# Method 2: Use network scanner
# Method 3: Try default hostname
ssh pi@secondbrain-voice.local

# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
  python3-pip \
  python3-dev \
  python3-pyaudio \
  portaudio19-dev \
  git \
  vim \
  htop \
  alsa-utils

# Set timezone
sudo timedatectl set-timezone America/New_York
```

### 3. Configure Audio

```bash
# Test audio devices
aplay -l    # List playback devices
arecord -l  # List recording devices

# Test microphone
arecord -d 5 test.wav
aplay test.wav

# Adjust volume
alsamixer
# Press F6 to select sound card
# Adjust volumes with arrow keys
# Press Esc to exit

# Set default audio device
sudo nano /etc/asound.conf
```

**`/etc/asound.conf`**
```
pcm.!default {
  type asym
  playback.pcm {
    type plug
    slave.pcm "hw:0,0"
  }
  capture.pcm {
    type plug
    slave.pcm "hw:1,0"
  }
}
```

### 4. Install Python Dependencies

```bash
# Create project directory
mkdir ~/second-brain-client
cd ~/second-brain-client

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip

# Core dependencies
pip install \
  pyaudio \
  pvporcupine \
  websocket-client \
  python-socketio \
  requests \
  numpy \
  python-dotenv

# Optional: For ReSpeaker HAT
pip install spidev gpiozero
```

### 5. Wake Word Setup (Porcupine)

```bash
# Porcupine is free for personal use
# Sign up at https://picovoice.ai/
# Get your AccessKey

# Available wake words (free):
# - Porcupine
# - Jarvis
# - Alexa (if you dare!)
# - Computer
# - Hey Google (custom)

# Test wake word
python3 -c "
import pvporcupine
porcupine = pvporcupine.create(
    access_key='YOUR_ACCESS_KEY',
    keywords=['porcupine']
)
print(f'Porcupine version: {porcupine.version}')
porcupine.delete()
"
```

---

## Client Implementation

### Project Structure

```
~/second-brain-client/
├── config/
│   ├── config.yaml         # Configuration
│   └── .env                # Secrets
├── src/
│   ├── main.py             # Entry point
│   ├── wake_word.py        # Wake word detection
│   ├── audio_capture.py    # Audio recording
│   ├── audio_playback.py   # Audio playback
│   ├── websocket_client.py # Server communication
│   └── led_controller.py   # LED feedback (optional)
├── logs/
│   └── client.log
├── requirements.txt
└── run.sh                  # Startup script
```

### Configuration Files

**`config.yaml`**
```yaml
server:
  url: "ws://192.168.1.100:8001"  # Your PC's local IP
  timeout: 30

audio:
  sample_rate: 16000
  channels: 1
  chunk_size: 1024
  format: "int16"
  device_index: null  # null = default device

wake_word:
  keyword: "porcupine"
  sensitivity: 0.5  # 0.0 to 1.0

voice_activity:
  enabled: true
  silence_duration: 2.0  # seconds of silence to stop recording
  energy_threshold: 300

playback:
  volume: 80  # 0-100

led:
  enabled: false
  gpio_pin: 18

logging:
  level: "INFO"
  file: "logs/client.log"
```

**`.env`**
```bash
PORCUPINE_ACCESS_KEY=your_picovoice_access_key_here
SERVER_URL=ws://192.168.1.100:8001
```

### Main Application (`src/main.py`)

```python
#!/usr/bin/env python3

import asyncio
import logging
from pathlib import Path
from wake_word import WakeWordDetector
from audio_capture import AudioCapturer
from audio_playback import AudioPlayer
from websocket_client import WebSocketClient
from led_controller import LEDController
import yaml
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Load configuration
with open('config/config.yaml', 'r') as f:
    config = yaml.safe_load(f)

# Setup logging
logging.basicConfig(
    level=getattr(logging, config['logging']['level']),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(config['logging']['file']),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class VoiceClient:
    def __init__(self):
        self.config = config
        self.running = False
        
        # Initialize components
        self.wake_word = WakeWordDetector(
            access_key=os.getenv('PORCUPINE_ACCESS_KEY'),
            keyword=config['wake_word']['keyword'],
            sensitivity=config['wake_word']['sensitivity']
        )
        
        self.audio_capturer = AudioCapturer(config['audio'])
        self.audio_player = AudioPlayer(config['playback'])
        self.ws_client = WebSocketClient(os.getenv('SERVER_URL'))
        
        if config['led']['enabled']:
            self.led = LEDController(config['led']['gpio_pin'])
        else:
            self.led = None
    
    async def start(self):
        """Start the voice client"""
        logger.info("Starting Second Brain Voice Client...")
        self.running = True
        
        # Connect to server
        await self.ws_client.connect()
        
        # LED: Blue (listening for wake word)
        if self.led:
            self.led.set_color('blue')
        
        logger.info("Ready. Say wake word to activate.")
        
        try:
            while self.running:
                # Wait for wake word
                if self.wake_word.detect():
                    logger.info("Wake word detected!")
                    await self.handle_voice_interaction()
                
                await asyncio.sleep(0.1)
        
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            await self.cleanup()
    
    async def handle_voice_interaction(self):
        """Handle a complete voice interaction"""
        try:
            # LED: Green (recording)
            if self.led:
                self.led.set_color('green')
            
            # Record audio
            logger.info("Recording...")
            audio_data = self.audio_capturer.record()
            
            # LED: Yellow (processing)
            if self.led:
                self.led.set_color('yellow')
            
            # Send to server and wait for response
            logger.info("Sending audio to server...")
            response = await self.ws_client.send_voice(audio_data)
            
            # Play response
            if response and 'audio' in response:
                logger.info(f"Response: {response.get('text', '')}")
                self.audio_player.play(response['audio'])
            
            # LED: Blue (ready again)
            if self.led:
                self.led.set_color('blue')
        
        except Exception as e:
            logger.error(f"Error in voice interaction: {e}")
            # LED: Red (error)
            if self.led:
                self.led.set_color('red')
                await asyncio.sleep(2)
                self.led.set_color('blue')
    
    async def cleanup(self):
        """Cleanup resources"""
        logger.info("Cleaning up...")
        self.wake_word.cleanup()
        await self.ws_client.disconnect()
        if self.led:
            self.led.cleanup()

async def main():
    client = VoiceClient()
    await client.start()

if __name__ == '__main__':
    asyncio.run(main())
```

### Wake Word Detection (`src/wake_word.py`)

```python
import pvporcupine
import pyaudio
import struct
import logging

logger = logging.getLogger(__name__)

class WakeWordDetector:
    def __init__(self, access_key: str, keyword: str, sensitivity: float = 0.5):
        self.access_key = access_key
        self.keyword = keyword
        self.sensitivity = sensitivity
        
        # Initialize Porcupine
        self.porcupine = pvporcupine.create(
            access_key=access_key,
            keywords=[keyword],
            sensitivities=[sensitivity]
        )
        
        # Audio stream
        self.pa = pyaudio.PyAudio()
        self.audio_stream = self.pa.open(
            rate=self.porcupine.sample_rate,
            channels=1,
            format=pyaudio.paInt16,
            input=True,
            frames_per_buffer=self.porcupine.frame_length
        )
        
        logger.info(f"Wake word detector initialized: '{keyword}'")
    
    def detect(self) -> bool:
        """Listen for wake word (non-blocking)"""
        pcm = self.audio_stream.read(
            self.porcupine.frame_length,
            exception_on_overflow=False
        )
        pcm = struct.unpack_from("h" * self.porcupine.frame_length, pcm)
        
        keyword_index = self.porcupine.process(pcm)
        return keyword_index >= 0
    
    def cleanup(self):
        """Release resources"""
        if self.audio_stream:
            self.audio_stream.close()
        if self.pa:
            self.pa.terminate()
        if self.porcupine:
            self.porcupine.delete()
        logger.info("Wake word detector cleaned up")
```

### Audio Capture (`src/audio_capture.py`)

```python
import pyaudio
import wave
import numpy as np
import logging
from io import BytesIO

logger = logging.getLogger(__name__)

class AudioCapturer:
    def __init__(self, config: dict):
        self.config = config
        self.pa = pyaudio.PyAudio()
        
        self.sample_rate = config['sample_rate']
        self.channels = config['channels']
        self.chunk_size = config['chunk_size']
        self.format = pyaudio.paInt16
    
    def record(self, max_duration: float = 10.0) -> bytes:
        """
        Record audio until silence detected or max duration reached
        Returns WAV file as bytes
        """
        logger.info("Recording started")
        
        stream = self.pa.open(
            format=self.format,
            channels=self.channels,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=self.chunk_size
        )
        
        frames = []
        silence_chunks = 0
        max_silence_chunks = int(2.0 * self.sample_rate / self.chunk_size)  # 2 seconds
        
        max_chunks = int(max_duration * self.sample_rate / self.chunk_size)
        
        for i in range(max_chunks):
            data = stream.read(self.chunk_size, exception_on_overflow=False)
            frames.append(data)
            
            # Voice Activity Detection (simple energy-based)
            audio_data = np.frombuffer(data, dtype=np.int16)
            energy = np.abs(audio_data).mean()
            
            if energy < 300:  # Silence threshold
                silence_chunks += 1
                if silence_chunks > max_silence_chunks:
                    logger.info("Silence detected, stopping recording")
                    break
            else:
                silence_chunks = 0
        
        stream.stop_stream()
        stream.close()
        
        # Convert to WAV format
        wav_buffer = BytesIO()
        with wave.open(wav_buffer, 'wb') as wf:
            wf.setnchannels(self.channels)
            wf.setsampwidth(self.pa.get_sample_size(self.format))
            wf.setframerate(self.sample_rate)
            wf.writeframes(b''.join(frames))
        
        wav_data = wav_buffer.getvalue()
        logger.info(f"Recording finished: {len(wav_data)} bytes")
        
        return wav_data
    
    def cleanup(self):
        if self.pa:
            self.pa.terminate()
```

### WebSocket Client (`src/websocket_client.py`)

```python
import socketio
import logging
import asyncio

logger = logging.getLogger(__name__)

class WebSocketClient:
    def __init__(self, server_url: str):
        self.server_url = server_url
        self.sio = socketio.AsyncClient()
        self.connected = False
        
        # Event handlers
        @self.sio.event
        async def connect():
            logger.info("Connected to server")
            self.connected = True
        
        @self.sio.event
        async def disconnect():
            logger.info("Disconnected from server")
            self.connected = False
        
        @self.sio.event
        async def error(data):
            logger.error(f"Server error: {data}")
    
    async def connect(self):
        """Connect to the server"""
        try:
            await self.sio.connect(self.server_url)
            logger.info(f"Connecting to {self.server_url}")
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from the server"""
        await self.sio.disconnect()
    
    async def send_voice(self, audio_data: bytes) -> dict:
        """
        Send voice data to server and wait for response
        Returns: { 'text': str, 'audio': bytes }
        """
        if not self.connected:
            raise Exception("Not connected to server")
        
        try:
            # Send audio data
            response = await self.sio.call(
                'voice:stream',
                {'audio': audio_data, 'format': 'wav'},
                timeout=30
            )
            
            return response
        
        except asyncio.TimeoutError:
            logger.error("Server response timeout")
            return None
        except Exception as e:
            logger.error(f"Failed to send voice: {e}")
            return None
```

### Audio Playback (`src/audio_playback.py`)

```python
import pyaudio
import wave
import logging
from io import BytesIO

logger = logging.getLogger(__name__)

class AudioPlayer:
    def __init__(self, config: dict):
        self.config = config
        self.pa = pyaudio.PyAudio()
        self.volume = config.get('volume', 80) / 100.0
    
    def play(self, audio_data: bytes):
        """Play audio from bytes (WAV format)"""
        try:
            wav_buffer = BytesIO(audio_data)
            with wave.open(wav_buffer, 'rb') as wf:
                stream = self.pa.open(
                    format=self.pa.get_format_from_width(wf.getsampwidth()),
                    channels=wf.getnchannels(),
                    rate=wf.getframerate(),
                    output=True
                )
                
                logger.info("Playing audio response")
                
                chunk_size = 1024
                data = wf.readframes(chunk_size)
                
                while data:
                    stream.write(data)
                    data = wf.readframes(chunk_size)
                
                stream.stop_stream()
                stream.close()
                
                logger.info("Audio playback finished")
        
        except Exception as e:
            logger.error(f"Audio playback failed: {e}")
    
    def cleanup(self):
        if self.pa:
            self.pa.terminate()
```

---

## LED Controller (Optional)

For visual feedback with ReSpeaker HAT or GPIO LEDs.

**`src/led_controller.py`**
```python
try:
    import RPi.GPIO as GPIO
    HAS_GPIO = True
except ImportError:
    HAS_GPIO = False
    
import logging

logger = logging.getLogger(__name__)

class LEDController:
    COLORS = {
        'blue': 18,    # Listening for wake word
        'green': 23,   # Recording
        'yellow': 24,  # Processing
        'red': 25      # Error
    }
    
    def __init__(self, gpio_pin: int = None):
        if not HAS_GPIO:
            logger.warning("RPi.GPIO not available, LED disabled")
            self.enabled = False
            return
        
        self.enabled = True
        GPIO.setmode(GPIO.BCM)
        
        for pin in self.COLORS.values():
            GPIO.setup(pin, GPIO.OUT)
            GPIO.output(pin, GPIO.LOW)
    
    def set_color(self, color: str):
        if not self.enabled:
            return
        
        # Turn off all LEDs
        for pin in self.COLORS.values():
            GPIO.output(pin, GPIO.LOW)
        
        # Turn on requested color
        if color in self.COLORS:
            GPIO.output(self.COLORS[color], GPIO.HIGH)
    
    def cleanup(self):
        if self.enabled:
            GPIO.cleanup()
```

---

## Autostart Configuration

### Systemd Service

**`/etc/systemd/system/second-brain-client.service`**
```ini
[Unit]
Description=Second Brain Voice Client
After=network.target sound.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/second-brain-client
ExecStart=/home/pi/second-brain-client/venv/bin/python src/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable second-brain-client.service
sudo systemctl start second-brain-client.service

# Check status
sudo systemctl status second-brain-client.service

# View logs
sudo journalctl -u second-brain-client.service -f
```

---

## Performance Optimization

### CPU Governor

```bash
# Set to performance mode
echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Make permanent
sudo nano /etc/rc.local
# Add before "exit 0":
echo "performance" | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

### Reduce Logging (Production)

```yaml
# config.yaml
logging:
  level: "WARNING"  # Instead of INFO
```

### Memory Management

```bash
# Increase swap if needed (for Pi with 4GB RAM)
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Set: CONF_SWAPSIZE=1024
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

---

## Troubleshooting

### Audio Issues

**No audio device found:**
```bash
# List audio devices
aplay -l
arecord -l

# Test microphone
arecord -D plughw:1,0 -d 5 test.wav
aplay test.wav
```

**Poor audio quality:**
```bash
# Increase sample rate in config.yaml
audio:
  sample_rate: 44100  # Instead of 16000
```

### Wake Word Not Detecting

**Too sensitive:**
```yaml
# Decrease sensitivity
wake_word:
  sensitivity: 0.3
```

**Not sensitive enough:**
```yaml
# Increase sensitivity
wake_word:
  sensitivity: 0.7
```

### Connection Issues

**Cannot connect to server:**
```bash
# Test connectivity
ping 192.168.1.100

# Check server is running
curl http://192.168.1.100:8000/health

# Test WebSocket
wscat -c ws://192.168.1.100:8001
```

### High CPU Usage

```bash
# Monitor processes
htop

# Reduce wake word sensitivity
# Or use lighter wake word engine
```

---

## Multiple Raspberry Pi Setup

To deploy voice clients in multiple rooms:

### 1. Clone SD Card

```bash
# After setting up first Pi, clone SD card
# Use Win32DiskImager or Balena Etcher
```

### 2. Update Hostnames

```bash
# On each Pi, set unique hostname
sudo hostnamectl set-hostname secondbrain-kitchen
sudo hostnamectl set-hostname secondbrain-bedroom
# etc.
```

### 3. Server Configuration

All Pis connect to the same server, identified by userId in session.

---

## Next Steps

1. Flash Raspberry Pi OS to SD card
2. Complete initial setup and audio configuration
3. Install client software and dependencies
4. Test wake word detection
5. Test end-to-end voice interaction with server
6. Configure autostart
7. Deploy to final location

See [LOCAL_PC_SERVER.md](./LOCAL_PC_SERVER.md) for server setup instructions.
