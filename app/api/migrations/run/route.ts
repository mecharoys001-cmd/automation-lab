import { NextResponse } from 'next/server';

const PROJECT_REF = 'uxjdencafxnugkoewvwq';

interface Migration {
  name: string;
  checkTable: string;
  checkColumn: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    name: 'add_venue_to_placements',
    checkTable: 'template_placements',
    checkColumn: 'venue_id',
    sql: `ALTER TABLE template_placements ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE SET NULL;`,
  },
  {
    name: 'add_scheduling_modes',
    checkTable: 'session_templates',
    checkColumn: 'scheduling_mode',
    sql: `ALTER TABLE session_templates
  ADD COLUMN IF NOT EXISTS scheduling_mode text DEFAULT 'ongoing'
    CHECK (scheduling_mode IN ('date_range', 'duration', 'session_count', 'ongoing')),
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date,
  ADD COLUMN IF NOT EXISTS duration_weeks integer,
  ADD COLUMN IF NOT EXISTS session_count integer,
  ADD COLUMN IF NOT EXISTS within_weeks integer;`,
  },
  {
    name: 'add_session_name',
    checkTable: 'sessions',
    checkColumn: 'name',
    sql: `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS name TEXT;`,
  },
];

async function checkColumnExists(
  supabaseUrl: string,
  serviceKey: string,
  table: string,
  column: string,
): Promise<boolean> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/${table}?select=${column}&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      signal: AbortSignal.timeout(10000),
    },
  );
  return res.ok;
}

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

    // Check which migrations need to run
    const pending: Migration[] = [];
    const skipped: string[] = [];

    for (const m of MIGRATIONS) {
      const exists = await checkColumnExists(supabaseUrl, serviceKey, m.checkTable, m.checkColumn);
      if (exists) {
        skipped.push(m.name);
      } else {
        pending.push(m);
      }
    }

    if (pending.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All migrations already applied',
        skipped,
      });
    }

    // Need access token for DDL via Management API
    const body = await request.json().catch(() => ({}));
    const accessToken = body.access_token || process.env.SUPABASE_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        pending: pending.map(m => m.name),
        skipped,
        error: 'Cannot run DDL via PostgREST. Provide a Supabase access token.',
        instructions: [
          'Option 1: Run this SQL in the Supabase Dashboard SQL Editor:',
          ...pending.map(m => m.sql),
          '',
          'Option 2: Provide a Supabase access token:',
          `curl -X POST ${supabaseUrl.replace('/rest/v1', '')}/api/migrations/run -H "Content-Type: application/json" -d '{"access_token":"sbp_xxx"}'`,
          '',
          'Get an access token at: https://supabase.com/dashboard/account/tokens',
        ],
      }, { status: 422 });
    }

    // Execute pending migrations via Management API
    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const m of pending) {
      const mgmtRes = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ query: m.sql }),
          signal: AbortSignal.timeout(15000),
        },
      );

      if (mgmtRes.ok) {
        results.push({ name: m.name, success: true });
      } else {
        const errText = await mgmtRes.text();
        results.push({ name: m.name, success: false, error: errText });
      }
    }

    return NextResponse.json({
      success: results.every(r => r.success),
      results,
      skipped,
      method: 'management_api',
    });
  } catch (err) {
    console.error('Migration error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
