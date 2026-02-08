/**
 * Custom hook for voice assistant status and display text
 * Centralizes all status-related logic
 */
import { useMemo } from 'react';
import { useVoiceStore } from '../stores/voiceStore';

export function useVoiceStatus() {
  const {
    isListening,
    isRecording,
    isProcessing,
    isSpeaking,
    wakeWordDetected,
  } = useVoiceStore();

  const status = useMemo(() => {
    if (isSpeaking) return { icon: '🔊', text: 'Speaking...' };
    if (isProcessing) return { icon: '⏳', text: 'Transcribing...' };
    if (isRecording) return { icon: '🎤', text: 'Recording...' };
    if (wakeWordDetected) return { icon: '👂', text: 'Wake word detected' };
    if (isListening) return { icon: '👂', text: 'Listening for wake word...' };
    return { icon: '⏸️', text: 'Ready' };
  }, [isSpeaking, isProcessing, isRecording, wakeWordDetected, isListening]);

  const buttonText = useMemo(() => {
    return isListening ? 'Stop Listening' : 'Start Voice Assistant';
  }, [isListening]);

  const hint = useMemo(() => {
    if (isSpeaking) return 'AI speaking - click Interrupt to respond or Stop to end';
    if (isProcessing) return 'Processing your request...';
    if (isRecording) return 'Recording... speak now!';
    if (wakeWordDetected) return 'Speak your question...';
    if (isListening) return 'Say "Go" to activate';
    return 'Click Start Voice Assistant to begin';
  }, [isSpeaking, isProcessing, isRecording, wakeWordDetected, isListening]);

  const isActive = useMemo(() => {
    return wakeWordDetected || isRecording || isProcessing || isSpeaking;
  }, [wakeWordDetected, isRecording, isProcessing, isSpeaking]);

  return {
    status,
    buttonText,
    hint,
    isActive,
    isListening,
    isRecording,
    isProcessing,
    isSpeaking,
    wakeWordDetected,
  };
}
