/**
 * Symphonix Notifications — Public API
 *
 * Entry point for sending instructor notifications.
 * Supports email (via Resend) and SMS (via Twilio), with
 * actual delivery gated behind a config flag.
 */

import { createServiceClient } from '@/lib/supabase-service';
import type { Instructor, NotificationChannel } from '@/types/database';
import type { TemplateKey } from './templates';
import { renderTemplate } from './templates';
import { logNotification } from './log';

// ============================================================
// Configuration
// ============================================================

/**
 * Set to `true` to enable real delivery via Resend / Twilio.
 * While `false`, notifications are logged but not actually sent.
 */
const SEND_ENABLED = false;

// ============================================================
// Types
// ============================================================

export interface NotificationPayload {
  recipientId: string;
  channel: NotificationChannel;
  templateKey: TemplateKey;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

export interface NotificationResult {
  success: boolean;
  logId: string | null;
  error?: string;
}

// ============================================================
// Main entry point
// ============================================================

/**
 * Sends (or stages) a notification to an instructor.
 *
 * 1. Looks up the instructor by recipientId
 * 2. Renders the template
 * 3. Delivers via the chosen channel (when SEND_ENABLED)
 * 4. Logs to notification_log
 *
 * @param payload - Who to notify, how, and with what data
 * @returns success/error result
 */
export async function notify(payload: NotificationPayload): Promise<NotificationResult> {
  const { recipientId, channel, templateKey, data: templateData } = payload;

  // ----------------------------------------------------------
  // 1. Look up instructor
  // ----------------------------------------------------------
  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: instructorData, error: lookupError } = await (supabase.from('staff') as any)
    .select('*')
    .eq('id', recipientId)
    .single();

  const instructor = instructorData as Instructor | null;

  if (lookupError || !instructor) {
    const msg = `Instructor not found: ${recipientId}`;
    console.error(`[notifications] ${msg}`);
    return { success: false, logId: null, error: msg };
  }

  // Validate contact info for the chosen channel
  if (channel === 'email' && !instructor.email) {
    const msg = `Instructor ${instructor.first_name} ${instructor.last_name} has no email on file`;
    console.error(`[notifications] ${msg}`);
    return { success: false, logId: null, error: msg };
  }

  if (channel === 'sms' && !instructor.phone) {
    const msg = `Instructor ${instructor.first_name} ${instructor.last_name} has no phone on file`;
    console.error(`[notifications] ${msg}`);
    return { success: false, logId: null, error: msg };
  }

  // ----------------------------------------------------------
  // 2. Render template
  // ----------------------------------------------------------
  const { subject } = renderTemplate(templateKey, templateData);
  const preview = subject.slice(0, 200);

  // ----------------------------------------------------------
  // 3. Send (when enabled)
  // ----------------------------------------------------------
  const sendError: string | null = null;

  if (SEND_ENABLED) {
    if (channel === 'email') {
      // TODO: Uncomment when Resend is configured
      // try {
      //   const resend = new Resend(process.env.RESEND_API_KEY);
      //   await resend.emails.send({
      //     from: 'Symphonix <notifications@symphonix.app>',
      //     to: instructor.email!,
      //     subject,
      //     html,
      //   });
      // } catch (err) {
      //   sendError = err instanceof Error ? err.message : 'Email send failed';
      // }
    } else {
      // TODO: Uncomment when Twilio is configured
      // try {
      //   const twilio = require('twilio')(
      //     process.env.TWILIO_ACCOUNT_SID,
      //     process.env.TWILIO_AUTH_TOKEN,
      //   );
      //   await twilio.messages.create({
      //     from: process.env.TWILIO_PHONE_NUMBER,
      //     to: instructor.phone!,
      //     body: subject,
      //   });
      // } catch (err) {
      //   sendError = err instanceof Error ? err.message : 'SMS send failed';
      // }
    }
  } else {
    console.info(`[notifications] SEND_ENABLED=false — skipping ${channel} to ${instructor.email ?? instructor.phone}`);
  }

  // ----------------------------------------------------------
  // 4. Log to notification_log
  // ----------------------------------------------------------
  const status = sendError ? 'failed' : SEND_ENABLED ? 'sent' : 'queued';

  const { id: logId, error: logError } = await logNotification({
    instructorId: instructor.id,
    channel,
    status,
    messagePreview: preview,
    sentAt: status === 'sent' ? new Date().toISOString() : null,
  });

  if (logError) {
    console.error(`[notifications] Failed to log notification: ${logError}`);
  }

  // ----------------------------------------------------------
  // 5. Return result
  // ----------------------------------------------------------
  if (sendError) {
    return { success: false, logId, error: sendError };
  }

  return { success: true, logId };
}

// Re-export utilities for convenience
export type { TemplateKey } from './templates';
export type { LogNotificationParams } from './log';
export { renderTemplate } from './templates';
export { logNotification } from './log';
