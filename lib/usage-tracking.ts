'use client';

/**
 * Generate a SHA-256 hash of CSV content for deduplication.
 * Uses the first 10KB to keep hashing fast on large files.
 */
export async function hashCSVContent(csvText: string): Promise<string> {
  // Use first 10KB — enough to uniquely identify a file without hashing megabytes
  const sample = csvText.slice(0, 10240);
  const encoder = new TextEncoder();
  const data = encoder.encode(sample);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Track a tool usage event. Fire-and-forget — never blocks the UI.
 *
 * For CSV tools: pass contentHash to deduplicate re-uploads of the same file.
 * For Symphonix: pass metadata with session count, etc.
 */
export function trackToolUsage(
  toolId: string,
  options?: {
    contentHash?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const payload = {
    tool_id: toolId,
    content_hash: options?.contentHash,
    metadata: options?.metadata,
  };

  // Fire and forget — don't await, don't block UI
  fetch('/api/usage/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    // Silent fail — usage tracking should never break the tool
    console.warn('[usage-tracking] Failed to track:', err);
  });
}
