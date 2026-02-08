/**
 * Central export for all custom hooks
 */

// Voice & Audio Hooks
export { useMicrophonePermission } from './useMicrophonePermission';
export { useVoiceControls } from './useVoiceControls';
export { useVoiceStatus } from './useVoiceStatus';
export { useWakeWord, type UseWakeWordOptions, type UseWakeWordResult } from './useWakeWord';
export { useRecording, type UseRecordingOptions, type UseRecordingResult } from './useRecording';
export { useLLMStream, type UseLLMStreamOptions, type UseLLMStreamResult } from './useLLMStream';

// Conversation Hooks
export { useConversationFormatting } from './useConversationFormatting';
export { useConversationManager } from './useConversationManager';

// Modal Hooks
export { useYouTubeModal } from './useYouTubeModal';
export { useConversationsModal } from './useConversationsModal';
