/**
 * POST /api/intake/submit
 *
 * Accepts instructor intake form data and upserts into the
 * instructors table (match on email — update if exists, insert if new).
 *
 * Request body: { first_name, last_name, email, phone?, skills, availability_json }
 * Response: { success, instructor_id?, error? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database, AvailabilityJson } from '@/types/database';

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface IntakeSubmitBody {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  skills: string[];
  availability_json: AvailabilityJson;
}

export async function POST(request: NextRequest) {
  try {
    const body: IntakeSubmitBody = await request.json();
    const { first_name, last_name, email, phone, skills, availability_json } = body;

    // Validate required fields
    if (!first_name || typeof first_name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid first_name' },
        { status: 400 }
      );
    }

    if (!last_name || typeof last_name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid last_name' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid email' },
        { status: 400 }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (!Array.isArray(skills) || skills.length === 0) {
      return NextResponse.json(
        { success: false, error: 'skills must be a non-empty array of strings' },
        { status: 400 }
      );
    }

    if (!availability_json || typeof availability_json !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid availability_json' },
        { status: 400 }
      );
    }

    // Ensure availability_json has at least one time block
    const timeBlocks = Object.values(availability_json).flat();
    if (timeBlocks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'availability_json must contain at least one time block' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Upsert: match on email, update if exists, insert if new
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('instructors') as any)
      .upsert(
        {
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone?.trim() || null,
          skills,
          availability_json,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )
      .select('id')
      .single();

    if (error) {
      console.error('Intake upsert error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      instructor_id: data.id,
    });
  } catch (err) {
    console.error('Intake API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
