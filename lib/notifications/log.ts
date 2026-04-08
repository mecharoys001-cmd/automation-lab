/**
 * Symphonix Notifications — Logging
 *
 * Persists notification records to the notification_log table
 * via Supabase for auditing and delivery tracking.
 */

import { createServiceClient } from '@/lib/supabase-service';
import type { NotificationChannel, NotificationStatus, NotificationLogInsert } from '@/types/database';

// ============================================================
// Types
// ============================================================

export interface LogNotificationParams {
  sessionId?: string | null;
  instructorId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  messagePreview?: string | null;
  sentAt?: string | null;
}

// ============================================================
// Log helper
// ============================================================

/**
 * Inserts a row into the notification_log table.
 *
 * @param params - Notification details to persist
 * @returns The inserted log row id, or an error string
 */
export async function logNotification(
  params: LogNotificationParams,
): Promise<{ id: string | null; error: string | null }> {
  const row: NotificationLogInsert = {
    session_id: params.sessionId ?? null,
    instructor_id: params.instructorId,
    channel: params.channel,
    status: params.status,
    message_preview: params.messagePreview ?? null,
    sent_at: params.sentAt ?? null,
  };

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('notification_log') as any)
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[notifications/log] Failed to insert notification_log:', error.message);
    return { id: null, error: (error as { message: string }).message };
  }

  return { id: (data as { id: string }).id, error: null };
}
