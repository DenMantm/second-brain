/**
 * Status display component
 * Shows current state and hints
 */
import { useVoiceStatus } from '../hooks/useVoiceStatus';
import { VoiceVisualization } from './VoiceVisualization';
import './VoiceAssistant.css';

export function StatusDisplay() {
  const { status, hint, isActive, isListening } = useVoiceStatus();

  return (
    <div className="status-display">
      <VoiceVisualization isListening={isListening} isActive={isActive} />
      
      <div className="status-text">
        <div className="status-icon">{status.icon}</div>
        <div className="status-message">{status.text}</div>
      </div>
      
      <div className="hint-text">{hint}</div>
    </div>
  );
}
