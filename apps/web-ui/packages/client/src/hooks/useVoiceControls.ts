/**
 * Custom hook for voice assistant control logic
 * Manages initialization, start/stop, and state transitions
 */
import { useCallback } from 'react';
import { useVoiceStore } from '../stores/voiceStore';

export function useVoiceControls() {
  const {
    isListening,
    isProcessing,
    isSpeaking,
    initialize,
    startListening,
    stopListening,
    interrupt,
    stopConversation,
    startNewConversation,
    manualTrigger,
  } = useVoiceStore();

  const handleInitialize = useCallback(async () => {
    try {
      await initialize();
      await startListening();
    } catch (error) {
      console.error('Failed to initialize voice assistant:', error);
      throw error;
    }
  }, [initialize, startListening]);

  const handleStop = useCallback(async () => {
    await stopListening();
  }, [stopListening]);

  const handleToggle = useCallback(async () => {
    if (isListening) {
      await handleStop();
    } else {
      await handleInitialize();
    }
  }, [isListening, handleStop, handleInitialize]);

  return {
    isListening,
    isProcessing,
    isSpeaking,
    handleInitialize,
    handleStop,
    handleToggle,
    interrupt,
    stopConversation,
    startNewConversation,
    manualTrigger,
  };
}
