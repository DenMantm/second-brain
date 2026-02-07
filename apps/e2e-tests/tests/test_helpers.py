"""Helper utilities for generating test data."""

import wave
import struct
import math
import io
from pathlib import Path
from typing import Optional


def generate_sine_wave(
    frequency: float = 440.0,
    duration: float = 1.0,
    sample_rate: int = 16000,
    amplitude: float = 0.3
) -> bytes:
    """
    Generate a sine wave audio signal.
    
    Args:
        frequency: Frequency in Hz
        duration: Duration in seconds
        sample_rate: Sample rate in Hz
        amplitude: Amplitude (0.0 to 1.0)
        
    Returns:
        WAV file bytes
    """
    num_samples = int(sample_rate * duration)
    
    # Generate sine wave samples
    samples = []
    for i in range(num_samples):
        value = amplitude * math.sin(2.0 * math.pi * frequency * i / sample_rate)
        # Convert to 16-bit PCM
        samples.append(int(value * 32767))
    
    # Create WAV file in memory
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        
        # Write samples
        for sample in samples:
            wav_file.writeframes(struct.pack('<h', sample))
    
    buffer.seek(0)
    return buffer.read()


def generate_speech_like_audio(
    duration: float = 2.0,
    sample_rate: int = 16000
) -> bytes:
    """
    Generate speech-like audio with varying frequencies.
    
    Args:
        duration: Duration in seconds
        sample_rate: Sample rate in Hz
        
    Returns:
        WAV file bytes
    """
    num_samples = int(sample_rate * duration)
    
    # Speech-like frequencies (varying between 100-300 Hz)
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        # Modulate frequency to simulate speech patterns
        freq = 150 + 50 * math.sin(2 * math.pi * 2 * t)
        value = 0.3 * math.sin(2.0 * math.pi * freq * t)
        
        # Add some harmonics for richness
        value += 0.1 * math.sin(2.0 * math.pi * freq * 2 * t)
        value += 0.05 * math.sin(2.0 * math.pi * freq * 3 * t)
        
        # Convert to 16-bit PCM
        samples.append(int(value * 32767 * 0.7))  # 0.7 to prevent clipping
    
    # Create WAV file in memory
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for sample in samples:
            wav_file.writeframes(struct.pack('<h', sample))
    
    buffer.seek(0)
    return buffer.read()


def save_test_audio(
    output_path: Path,
    audio_type: str = "sine",
    duration: float = 1.0
) -> Path:
    """
    Generate and save test audio file.
    
    Args:
        output_path: Path to save the audio file
        audio_type: Type of audio ("sine" or "speech")
        duration: Duration in seconds
        
    Returns:
        Path to the saved file
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    if audio_type == "sine":
        audio_bytes = generate_sine_wave(duration=duration)
    elif audio_type == "speech":
        audio_bytes = generate_speech_like_audio(duration=duration)
    else:
        raise ValueError(f"Unknown audio type: {audio_type}")
    
    with open(output_path, 'wb') as f:
        f.write(audio_bytes)
    
    return output_path


def create_silence(duration: float = 1.0, sample_rate: int = 16000) -> bytes:
    """
    Create silent audio.
    
    Args:
        duration: Duration in seconds
        sample_rate: Sample rate in Hz
        
    Returns:
        WAV file bytes
    """
    num_samples = int(sample_rate * duration)
    
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        # Write zeros (silence)
        for _ in range(num_samples):
            wav_file.writeframes(struct.pack('<h', 0))
    
    buffer.seek(0)
    return buffer.read()
