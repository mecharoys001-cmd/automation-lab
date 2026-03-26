/**
 * POST /api/notifications/send
 *
 * Sends a single notification to an instructor via the
 * notifications library.
 *
 * Request body: NotificationPayload
 * Response: NotificationResult
 */

import { NextRequest, NextResponse } from 'next/server';
import { notify } from '@/lib/notifications';
import type { NotificationPayload } from '@/lib/notifications';
import { requireAdmin, requireMinRole } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const payload: NotificationPayload = await request.json();
    const { recipientId, channel, templateKey, data } = payload;

    // Validate required fields
    if (!recipientId || typeof recipientId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid recipientId' },
        { status: 400 }
      );
    }

    if (!channel || !['email', 'sms'].includes(channel)) {
      return NextResponse.json(
        { success: false, error: 'channel must be "email" or "sms"' },
        { status: 400 }
      );
    }

    if (!templateKey || typeof templateKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid templateKey' },
        { status: 400 }
      );
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid data object' },
        { status: 400 }
      );
    }

    const result = await notify(payload);

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    });
  } catch (err) {
    console.error('Notification send API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
