import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMasterAdmin } from '@/lib/api-auth';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const masterCheck = requireMasterAdmin(auth.user);
    if (masterCheck) return masterCheck;

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('activity_log') as any)
      .select('id, event_type, user_email, metadata, created_at')
      .in('event_type', ['role_create', 'role_update', 'role_delete'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
