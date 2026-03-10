/**
 * GET /api/reports/sessions-by-template?program_id=XXX
 *
 * Returns session counts grouped by template.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json(
        { error: 'program_id query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // Fetch all sessions with their template data
    const { data: sessions, error: sessionsError } = await sb
      .from('sessions')
      .select(`
        id,
        template_id,
        status,
        template:session_templates!inner(
          id,
          day_of_week,
          grade_groups,
          required_skills
        )
      `)
      .eq('program_id', programId);

    if (sessionsError) {
      return NextResponse.json(
        { error: `Failed to fetch sessions: ${sessionsError.message}` },
        { status: 500 }
      );
    }

    // Group by template and count statuses
    const templateMap = new Map<string, {
      template_id: string;
      template_name: string;
      grade_groups: string[];
      subjects: string[];
      day_of_week: number;
      session_count: number;
      published_count: number;
      draft_count: number;
      completed_count: number;
      canceled_count: number;
    }>();

    for (const session of sessions ?? []) {
      if (!session.template_id || !session.template) continue;

      const templateId = session.template_id;
      const template = session.template;

      if (!templateMap.has(templateId)) {
        // Build template name from subjects and grades
        const subjects: string[] = template.required_skills ?? [];
        const grades: string[] = template.grade_groups ?? [];
        const subjectPart = subjects.length > 0 ? subjects[0] : 'Session';
        const gradePart = grades.length > 0 ? ` - Grade ${grades.join(', ')}` : '';
        const templateName = `${subjectPart}${gradePart}`;

        templateMap.set(templateId, {
          template_id: templateId,
          template_name: templateName,
          grade_groups: grades,
          subjects: subjects,
          day_of_week: template.day_of_week ?? 1,
          session_count: 0,
          published_count: 0,
          draft_count: 0,
          completed_count: 0,
          canceled_count: 0,
        });
      }

      const entry = templateMap.get(templateId)!;
      entry.session_count++;

      if (session.status === 'published') entry.published_count++;
      else if (session.status === 'draft') entry.draft_count++;
      else if (session.status === 'completed') entry.completed_count++;
      else if (session.status === 'canceled') entry.canceled_count++;
    }

    const data = Array.from(templateMap.values());

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Sessions by template API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
