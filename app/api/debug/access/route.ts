import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAccessibleToolIds } from '@/lib/tool-access';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Not logged in' });
  }

  const adminInfo = await getSiteAdmin(user.email);
  const isAdmin = isSiteAdmin(adminInfo);
  const accessibleToolIds = await getUserAccessibleToolIds(user.email);

  return NextResponse.json({
    email: user.email,
    isAdmin,
    accessibleToolIds,
    count: accessibleToolIds.length,
  });
}
