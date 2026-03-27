/**
 * GET /api/selected-program — Read the selected program ID from httpOnly cookie
 * PUT /api/selected-program — Set the selected program ID in an httpOnly cookie
 *
 * Replaces localStorage-based storage so the program ID is not readable
 * by third-party scripts (analytics, etc.) on the page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'symphonix-selected-program';
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function GET() {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value ?? null;
  return NextResponse.json({ selectedProgramId: value });
}

export async function PUT(request: NextRequest) {
  const { programId } = await request.json();

  if (typeof programId !== 'string' || programId.length === 0) {
    return NextResponse.json({ error: 'programId is required' }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, programId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}
