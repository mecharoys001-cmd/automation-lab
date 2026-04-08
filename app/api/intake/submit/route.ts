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
  bio?: string | null;
  start_year?: number | null;
  on_call?: boolean;
  skills: string[];
  availability_json: AvailabilityJson;
  program_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: IntakeSubmitBody = await request.json();
    const { first_name, last_name, email, phone, bio, start_year, on_call, skills, availability_json, program_id } = body;

    if (!program_id) {
      return NextResponse.json(
        { success: false, error: 'Missing program_id' },
        { status: 400 }
      );
    }

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

    // Validate optional bio
    if (bio !== undefined && bio !== null && typeof bio !== 'string') {
      return NextResponse.json(
        { success: false, error: 'bio must be a string' },
        { status: 400 }
      );
    }
    if (typeof bio === 'string' && bio.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'bio must be 1000 characters or less' },
        { status: 400 }
      );
    }

    // Validate optional start_year
    if (start_year !== undefined && start_year !== null) {
      const currentYear = new Date().getFullYear();
      if (typeof start_year !== 'number' || !Number.isInteger(start_year) || start_year < 1900 || start_year > currentYear + 1) {
        return NextResponse.json(
          { success: false, error: `start_year must be an integer between 1900 and ${currentYear + 1}` },
          { status: 400 }
        );
      }
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

    // Validate that the program_id refers to a real program
    // (intake is unauthenticated, but we must not allow writes to arbitrary/non-existent programs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: program } = await (supabase.from('programs') as any)
      .select('id')
      .eq('id', program_id)
      .maybeSingle();

    if (!program) {
      return NextResponse.json(
        { success: false, error: 'Invalid program_id' },
        { status: 403 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if a staff record with this email already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('staff') as any)
      .select('id, program_id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      // Only allow updates within the same program — prevent cross-program data manipulation
      if (existing.program_id !== program_id) {
        return NextResponse.json(
          { success: false, error: 'This email is already registered with a different program' },
          { status: 403 }
        );
      }

      // Update existing record within the same program
      // Preserve existing bio/start_year if the intake submission sends blank/null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload: Record<string, any> = {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        phone: phone?.trim() || null,
        skills,
        availability_json,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      if (bio && bio.trim()) updatePayload.bio = bio.trim();
      if (start_year != null) updatePayload.start_year = start_year;
      if (on_call != null) updatePayload.on_call = !!on_call;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ data, error } = await (supabase.from('staff') as any)
        .update(updatePayload)
        .eq('id', existing.id)
        .select('id')
        .single());
    } else {
      // Insert new staff record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ data, error } = await (supabase.from('staff') as any)
        .insert({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: normalizedEmail,
          phone: phone?.trim() || null,
          bio: bio?.trim() || null,
          start_year: start_year ?? null,
          skills,
          availability_json,
          is_active: true,
          on_call: !!on_call,
          updated_at: new Date().toISOString(),
          program_id,
        })
        .select('id')
        .single());
    }

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
