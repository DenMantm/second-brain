/**
 * Session Context
 * Manages the current session context for tool execution
 * Allows tools to access session-specific data without passing sessionId explicitly
 */

let currentSessionId: string | null = null;

/**
 * Set the current session context
 * Call this before invoking LLM with tools
 */
export function setCurrentSession(sessionId: string): void {
  currentSessionId = sessionId;
}

/**
 * Get the current session context
 * Tools call this to get the sessionId for accessing session-specific data
 */
export function getCurrentSession(): string | null {
  return currentSessionId;
}

/**
 * Clear the current session context
 * Call this after LLM invocation completes
 */
export function clearCurrentSession(): void {
  currentSessionId = null;
}

/**
 * Execute a function with a specific session context
 * Automatically sets and clears the session context
 */
export async function withSessionContext<T>(
  sessionId: string,
  fn: () => Promise<T>
): Promise<T> {
  const previousSession = currentSessionId;
  try {
    setCurrentSession(sessionId);
    return await fn();
  } finally {
    currentSessionId = previousSession;
  }
}
