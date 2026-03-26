import { NextResponse } from 'next/server';
import { requireAdmin, requireMasterAdmin } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const masterErr = requireMasterAdmin(auth.user);
  if (masterErr) return masterErr;

  const sql = `ALTER TABLE template_placements ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE SET NULL;`;

  return NextResponse.json({
    message: 'Run this SQL in your Supabase SQL Editor:',
    sql,
    instructions: [
      '1. Go to https://supabase.com/dashboard',
      '2. Select your project',
      '3. Click SQL Editor in the left sidebar',
      '4. Paste the SQL above',
      '5. Click Run',
    ],
  });
}
