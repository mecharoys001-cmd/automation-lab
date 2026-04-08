import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { id } = await params;

    const accessErr = await requireProgramAccess(auth.user, id);
    if (accessErr) return accessErr;

    const supabase = createServiceClient();

    // Fetch program
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: program, error: programErr } = await (supabase.from('programs') as any)
      .select('*')
      .eq('id', id)
      .single();

    if (programErr) {
      return NextResponse.json({ error: programErr.message }, { status: 404 });
    }

    // Fetch all related data in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const [
      staffRes,
      venuesRes,
      tagsRes,
      templatesRes,
      sessionsRes,
      calendarRes,
      versionsRes,
      settingsRes,
      rulesRes,
    ] = await Promise.all([
      sb.from('staff').select('*, staff_tags(tag_id)').eq('program_id', id),
      sb.from('venues').select('*, venue_tags(tag_id)').eq('program_id', id),
      sb.from('tags').select('*').eq('program_id', id),
      sb.from('session_templates').select('*, template_placements(*)').eq('program_id', id),
      sb.from('sessions').select('*, session_tags(tag_id)').eq('program_id', id),
      sb.from('school_calendar').select('*').eq('program_id', id),
      // schedule_versions doesn't have program_id — skip it
      Promise.resolve({ data: [], error: null }),
      sb.from('settings').select('*').eq('program_id', id),
      sb.from('program_rules').select('*').eq('program_id', id),
    ]);

    // Check for errors
    for (const res of [staffRes, venuesRes, tagsRes, templatesRes, sessionsRes, calendarRes, versionsRes, settingsRes, rulesRes]) {
      if (res.error) {
        return NextResponse.json({ error: res.error.message }, { status: 500 });
      }
    }

    // Flatten junction tables for staff
    const staff = (staffRes.data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      tags: ((s.staff_tags as Array<{ tag_id: string }>) ?? []).map((st) => st.tag_id),
      staff_tags: undefined,
    }));

    // Flatten junction tables for venues
    const venues = (venuesRes.data ?? []).map((v: Record<string, unknown>) => ({
      ...v,
      tags: ((v.venue_tags as Array<{ tag_id: string }>) ?? []).map((vt) => vt.tag_id),
      venue_tags: undefined,
    }));

    // Flatten junction tables for templates
    const sessionTemplates = (templatesRes.data ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      placements: t.template_placements ?? [],
      template_placements: undefined,
    }));

    // Flatten junction tables for sessions
    const sessions = (sessionsRes.data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      tags: ((s.session_tags as Array<{ tag_id: string }>) ?? []).map((st) => st.tag_id),
      session_tags: undefined,
    }));

    const exportData = {
      export_version: '1.0',
      exported_at: new Date().toISOString(),
      program,
      staff,
      venues,
      tags: tagsRes.data ?? [],
      session_templates: sessionTemplates,
      sessions,
      school_calendar: calendarRes.data ?? [],
      schedule_versions: versionsRes.data ?? [],
      settings: settingsRes.data ?? [],
      program_rules: rulesRes.data ?? [],
    };

    const programName = (program.name ?? 'program').replace(/[^a-zA-Z0-9_-]/g, '_');
    const date = new Date().toISOString().split('T')[0];
    const filename = `${programName}_${date}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
