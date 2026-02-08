/**
 * Custom hook for managing microphone permissions
 * Handles permission state and changes
 */
import { useState, useEffect } from 'react';

type PermissionState = 'prompt' | 'granted' | 'denied';

export function useMicrophonePermission() {
  const [permission, setPermission] = useState<PermissionState>('prompt');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const result = await navigator.permissions?.query({ 
          name: 'microphone' as PermissionName 
        });
        
        if (result) {
          setPermission(result.state as PermissionState);
          
          result.onchange = () => {
            setPermission(result.state as PermissionState);
          };
        }
      } catch (error) {
        console.warn('Permission API not available:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, []);

  return {
    permission,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    isPrompt: permission === 'prompt',
    isLoading,
  };
}
