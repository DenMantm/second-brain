/**
 * Voice assistant control buttons
 * Separated into modular component for clarity
 */
import { useVoiceControls } from '../hooks/useVoiceControls';
import { useVoiceStatus } from '../hooks/useVoiceStatus';

interface VoiceControlsProps {
  isPermissionDenied: boolean;
}

export function VoiceControls({ isPermissionDenied }: VoiceControlsProps) {
  const {
    isListening,
    isProcessing,
    isSpeaking,
    handleToggle,
    interrupt,
    stopConversation,
    startNewConversation,
    manualTrigger,
  } = useVoiceControls();

  const { buttonText, isActive, wakeWordDetected, isRecording } = useVoiceStatus();

  const showManualTrigger = isListening && !wakeWordDetected && !isRecording;
  const showNewConversation = isListening;
  const showInterrupt = isSpeaking;
  const showStop = isActive;

  return (
    <div className="controls">
      {isPermissionDenied && (
        <div className="permission-error">
          ⚠️ Microphone access denied. Please enable it in your browser settings.
        </div>
      )}

      <button
        onClick={handleToggle}
        disabled={isPermissionDenied || isProcessing}
        className={`primary-button ${isListening ? 'listening' : ''}`}
      >
        {buttonText}
      </button>

      {showManualTrigger && (
        <button
          onClick={manualTrigger}
          className="manual-trigger-button"
          disabled={isProcessing || isSpeaking}
          title="Manual voice trigger"
        >
          🎤 Manual Trigger
        </button>
      )}

      {showNewConversation && (
        <button
          onClick={startNewConversation}
          className="new-conversation-button"
          disabled={isProcessing || isSpeaking}
          title="New conversation"
        >
          ➕ New Conversation
        </button>
      )}

      {showInterrupt && (
        <button
          onClick={interrupt}
          className="interrupt-button"
          title="Interrupt"
        >
          ⏸️ Interrupt
        </button>
      )}

      {showStop && (
        <button
          onClick={stopConversation}
          className="stop-button"
        >
          🛑 Stop Conversation
        </button>
      )}
    </div>
  );
}
