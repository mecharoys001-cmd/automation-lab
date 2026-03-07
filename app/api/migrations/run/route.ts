import { NextResponse } from 'next/server';

const MIGRATION_SQL = `ALTER TABLE template_placements ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE SET NULL;`;
const PROJECT_REF = 'uxjdencafxnugkoewvwq';

export async function POST(request: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'Missing SUPABASE env vars' },
        { status: 500 },
      );
    }

    // Check if column already exists
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/template_placements?select=venue_id&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (checkRes.ok) {
      return NextResponse.json({
        success: true,
        message: 'Column venue_id already exists on template_placements',
        skipped: true,
      });
    }

    // Try Supabase Management API (requires access token)
    const body = await request.json().catch(() => ({}));
    const accessToken = body.access_token || process.env.SUPABASE_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Column venue_id does not exist yet. Cannot run DDL via PostgREST.',
        instructions: [
          'Option 1: Run this SQL in the Supabase Dashboard SQL Editor:',
          MIGRATION_SQL,
          '',
          'Option 2: Provide a Supabase access token:',
          'curl -X POST http://localhost:3000/api/migrations/run -H "Content-Type: application/json" -d \'{"access_token":"sbp_xxx"}\'',
          '',
          'Option 3: Set SUPABASE_ACCESS_TOKEN in .env.local and restart the dev server',
          '',
          'Get an access token at: https://supabase.com/dashboard/account/tokens',
        ],
      }, { status: 422 });
    }

    // Execute via Management API
    const mgmtRes = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query: MIGRATION_SQL }),
        signal: AbortSignal.timeout(15000),
      },
    );

    if (mgmtRes.ok) {
      const data = await mgmtRes.json();
      return NextResponse.json({
        success: true,
        executed: MIGRATION_SQL,
        method: 'management_api',
        result: data,
      });
    }

    const errText = await mgmtRes.text();
    return NextResponse.json({
      success: false,
      error: `Management API returned ${mgmtRes.status}`,
      detail: errText,
      fallback: `Run this SQL manually in the Supabase Dashboard: ${MIGRATION_SQL}`,
    }, { status: 500 });
  } catch (err) {
    console.error('Migration error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
