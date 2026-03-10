/**
 * Canonical session status labels and colors used across the entire app.
 * DB values → user-facing labels.
 */

export type SessionStatus = 'draft' | 'published' | 'scheduled' | 'canceled' | 'completed';

export interface StatusConfig {
  label: string;
  color: 'blue' | 'green' | 'amber' | 'red' | 'slate';
  dot?: boolean;
}

export const SESSION_STATUS: Record<string, StatusConfig> = {
  draft:     { label: 'Draft',     color: 'amber' },
  published: { label: 'Active',    color: 'green' },
  scheduled: { label: 'Active',    color: 'green' },
  canceled:  { label: 'Cancelled', color: 'red' },
  cancelled: { label: 'Cancelled', color: 'red' },  // handle both spellings
  completed: { label: 'Completed', color: 'slate' },
};

export function getStatusConfig(status: string): StatusConfig {
  return SESSION_STATUS[status] ?? { label: status, color: 'slate' };
}
