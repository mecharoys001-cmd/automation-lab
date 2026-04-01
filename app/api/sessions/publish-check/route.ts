/**
 * GET /api/sessions/publish-check?program_id=xxx
 *
 * Pre-publish validation gate. Checks all draft sessions and reports
 * which ones cannot be published because their templates have no Event Type
 * (required_skills is null or empty).
 *
 * Response: {
 *   can_publish: boolean,
 *   total_drafts: number,
 *   publishable: number,
 *   issues: {
 *     sessions_missing_event_type: number,
 *     affected_template_names: string[],
 *   },
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireProgramAccess } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const programId = request.nextUrl.searchParams.get('program_id');
    if (!programId) {
      return NextResponse.json(
        { error: 'program_id query parameter is required' },
        { status: 400 },
      );
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

    const supabase = createServiceClient();

    // Fetch all draft sessions with their template info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: drafts, error: draftsError } = await (supabase.from('sessions') as any)
      .select('id, template_id, session_templates(id, name, required_skills)')
      .eq('program_id', programId)
      .eq('status', 'draft');

    if (draftsError) {
      return NextResponse.json({ error: draftsError.message }, { status: 500 });
    }

    const allDrafts = drafts ?? [];
    const totalDrafts = allDrafts.length;

    // Find sessions whose template has no required_skills
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missingEventType = allDrafts.filter((s: any) => {
      const tpl = s.session_templates;
      if (!tpl) return true; // no template linked — flag it
      return !tpl.required_skills || tpl.required_skills.length === 0;
    });

    const sessionsMissing = missingEventType.length;
    const publishable = totalDrafts - sessionsMissing;

    // Collect unique template names for the affected sessions
    const affectedNames = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of missingEventType) {
      const name = s.session_templates?.name;
      affectedNames.add(name || 'Unknown template');
    }

    return NextResponse.json({
      can_publish: sessionsMissing === 0,
      total_drafts: totalDrafts,
      publishable,
      issues: {
        sessions_missing_event_type: sessionsMissing,
        affected_template_names: Array.from(affectedNames),
      },
    });
  } catch (err) {
    console.error('Publish-check API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
