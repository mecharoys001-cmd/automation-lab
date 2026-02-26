/**
 * Symphonix Notifications — Email Templates
 *
 * HTML email templates for outbound instructor communications.
 * All templates use inline styles for maximum email client compatibility.
 * Dark theme throughout for consistent branding.
 */

// ============================================================
// Template key union
// ============================================================

export type TemplateKey =
  | 'schedule_published'
  | 'session_canceled'
  | 'sub_request'
  | 'makeup_created';

// ============================================================
// Per-template data shapes
// ============================================================

export interface SchedulePublishedData {
  instructorName: string;
  programName: string;
  sessionCount: number;
  scheduleUrl?: string;
}

export interface SessionCanceledData {
  instructorName: string;
  sessionDate: string;
  sessionTime: string;
  gradeGroups: string[];
  reason?: string;
}

export interface SubRequestData {
  instructorName: string;
  sessionDate: string;
  sessionTime: string;
  gradeGroups: string[];
  venueInfo?: string;
}

export interface MakeupCreatedData {
  instructorName: string;
  originalDate: string;
  makeupDate: string;
  makeupTime: string;
  gradeGroups: string[];
}

// ============================================================
// Shared layout helpers (dark theme)
// ============================================================

const BRAND_COLOR = '#6366F1';
const BG_COLOR = '#111827';
const CARD_COLOR = '#1F2937';
const TEXT_COLOR = '#F3F4F6';
const MUTED_COLOR = '#9CA3AF';
const BORDER_COLOR = '#374151';

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:${CARD_COLOR};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.4);">
        <!-- Header -->
        <tr><td style="background-color:${BRAND_COLOR};padding:24px 32px;">
          <h1 style="margin:0;color:#FFFFFF;font-size:20px;font-weight:600;">Symphonix</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;color:${TEXT_COLOR};font-size:15px;line-height:1.6;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid ${BORDER_COLOR};color:${MUTED_COLOR};font-size:12px;text-align:center;">
          Symphonix Scheduling Platform &mdash; This is an automated message.<br>
          Questions? Contact your program coordinator.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-weight:600;color:${TEXT_COLOR};white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:8px 12px;color:${TEXT_COLOR};">${value}</td>
  </tr>`;
}

function detailTable(rows: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid ${BORDER_COLOR};border-radius:6px;margin:16px 0;border-collapse:collapse;">
    ${rows}
  </table>`;
}

function button(label: string, url: string): string {
  return `<p style="margin:24px 0 0;text-align:center;">
    <a href="${url}" style="display:inline-block;padding:10px 24px;background-color:${BRAND_COLOR};color:#FFFFFF;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">${label}</a>
  </p>`;
}

// ============================================================
// Template renderers
// ============================================================

function renderSchedulePublished(data: SchedulePublishedData): { subject: string; html: string } {
  const rows = [
    detailRow('Program', data.programName),
    detailRow('Sessions', String(data.sessionCount)),
  ].join('');

  const body = `
    <p style="margin:0 0 16px;">Hi ${data.instructorName},</p>
    <p style="margin:0 0 16px;">Your schedule for <strong>${data.programName}</strong> has been published. Here's a summary:</p>
    ${detailTable(rows)}
    <p style="margin:16px 0 0;color:${MUTED_COLOR};font-size:13px;">Please review your sessions and reach out if you have any conflicts.</p>
    ${data.scheduleUrl ? button('View My Schedule', data.scheduleUrl) : ''}
  `;

  return {
    subject: `Your ${data.programName} schedule is live`,
    html: layout('Schedule Published', body),
  };
}

function renderSessionCanceled(data: SessionCanceledData): { subject: string; html: string } {
  const rows = [
    detailRow('Date', data.sessionDate),
    detailRow('Time', data.sessionTime),
    detailRow('Grades', data.gradeGroups.join(', ')),
    ...(data.reason ? [detailRow('Reason', data.reason)] : []),
  ].join('');

  const body = `
    <p style="margin:0 0 16px;">Hi ${data.instructorName},</p>
    <p style="margin:0 0 16px;">A session you were assigned to has been <strong>canceled</strong>.</p>
    ${detailTable(rows)}
    <p style="margin:16px 0 0;color:${MUTED_COLOR};font-size:13px;">No action is required on your part. A makeup session may be scheduled separately.</p>
  `;

  return {
    subject: `Session canceled on ${data.sessionDate}`,
    html: layout('Session Canceled', body),
  };
}

function renderSubRequest(data: SubRequestData): { subject: string; html: string } {
  const rows = [
    detailRow('Date', data.sessionDate),
    detailRow('Time', data.sessionTime),
    detailRow('Grades', data.gradeGroups.join(', ')),
    ...(data.venueInfo ? [detailRow('Venue', data.venueInfo)] : []),
  ].join('');

  const body = `
    <p style="margin:0 0 16px;">Hi ${data.instructorName},</p>
    <p style="margin:0 0 16px;">You've been requested as a <strong>substitute instructor</strong> for the following session:</p>
    ${detailTable(rows)}
    <p style="margin:16px 0 0;color:${MUTED_COLOR};font-size:13px;">Please respond at your earliest convenience.</p>
  `;

  return {
    subject: `Sub request for ${data.sessionDate}`,
    html: layout('Substitute Request', body),
  };
}

function renderMakeupCreated(data: MakeupCreatedData): { subject: string; html: string } {
  const rows = [
    detailRow('Original date', data.originalDate),
    detailRow('Makeup date', data.makeupDate),
    detailRow('Time', data.makeupTime),
    detailRow('Grades', data.gradeGroups.join(', ')),
  ].join('');

  const body = `
    <p style="margin:0 0 16px;">Hi ${data.instructorName},</p>
    <p style="margin:0 0 16px;">A <strong>makeup session</strong> has been created for you:</p>
    ${detailTable(rows)}
    <p style="margin:16px 0 0;color:${MUTED_COLOR};font-size:13px;">Please update your calendar accordingly. Reach out if this time doesn't work.</p>
  `;

  return {
    subject: `Makeup session scheduled for ${data.makeupDate}`,
    html: layout('Makeup Session Created', body),
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * Renders an email template by key.
 *
 * @param templateKey - Which template to render
 * @param data - Template-specific data (caller is responsible for shape)
 * @returns subject line and rendered HTML string
 * @throws Error if templateKey is unknown
 */
export function renderTemplate(
  templateKey: TemplateKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
): { subject: string; html: string } {
  switch (templateKey) {
    case 'schedule_published':
      return renderSchedulePublished(data as SchedulePublishedData);
    case 'session_canceled':
      return renderSessionCanceled(data as SessionCanceledData);
    case 'sub_request':
      return renderSubRequest(data as SubRequestData);
    case 'makeup_created':
      return renderMakeupCreated(data as MakeupCreatedData);
    default: {
      const _exhaustive: never = templateKey;
      throw new Error(`Unknown template key: ${_exhaustive}`);
    }
  }
}
