'use client';

/**
 * Generate a SHA-256 hash of CSV content for deduplication.
 * Uses the first 10KB to keep hashing fast on large files.
 */
export async function hashCSVContent(csvText: string): Promise<string> {
  const sample = csvText.slice(0, 10240);
  const encoder = new TextEncoder();
  const data = encoder.encode(sample);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Start tracking a tool usage session. Returns a session object with
 * complete() and error() methods for lifecycle tracking.
 */
export function startToolSession(toolId: string) {
  const sessionId = generateSessionId();
  const startTime = Date.now();

  // Log the "tool opened" event
  fetch('/api/activity/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'tool_open',
      tool_id: toolId,
      metadata: { usage_session_id: sessionId },
    }),
  }).catch(() => {});

  return {
    sessionId,

    complete(options?: {
      contentHash?: string;
      metadata?: Record<string, unknown>;
    }): void {
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);

      fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: toolId,
          content_hash: options?.contentHash,
          status: 'completed',
          duration_seconds: durationSeconds,
          usage_session_id: sessionId,
          metadata: {
            ...options?.metadata,
            duration_seconds: durationSeconds,
          },
        }),
      }).catch((err) => {
        console.warn('[usage-tracking] Failed to track completion:', err);
      });
    },

    error(errorMessage: string, metadata?: Record<string, unknown>): void {
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);

      fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: toolId,
          status: 'error',
          duration_seconds: durationSeconds,
          error_message: errorMessage,
          usage_session_id: sessionId,
          metadata: {
            ...metadata,
            duration_seconds: durationSeconds,
            error: errorMessage,
          },
        }),
      }).catch((err) => {
        console.warn('[usage-tracking] Failed to track error:', err);
      });
    },
  };
}

/**
 * Simple fire-and-forget tracking (backward compatible).
 * Use startToolSession() for full lifecycle tracking.
 */
export function trackToolUsage(
  toolId: string,
  options?: {
    contentHash?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  fetch('/api/usage/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool_id: toolId,
      content_hash: options?.contentHash,
      status: 'completed',
      metadata: options?.metadata,
    }),
  }).catch((err) => {
    console.warn('[usage-tracking] Failed to track:', err);
  });
}
