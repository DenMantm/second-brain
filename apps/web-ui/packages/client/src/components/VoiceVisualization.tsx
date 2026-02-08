/**
 * Visual feedback component for voice assistant
 * Shows animated bars when listening/active
 */
import './VoiceAssistant.css';

interface VoiceVisualizationProps {
  isListening: boolean;
  isActive: boolean;
}

export function VoiceVisualization({ isListening, isActive }: VoiceVisualizationProps) {
  if (!isListening) return null;

  return (
    <div className="visualization">
      <div className="audio-bars">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`bar ${isActive ? 'active' : ''}`}
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
}
