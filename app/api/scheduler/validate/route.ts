/**
 * GET /api/scheduler/validate?program_id=xxx
 *
 * Returns a readiness report for auto-schedule generation.
 * Checks that templates, staff, and venues are properly
 * configured before the user runs the scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireProgramAccess } from '@/lib/api-auth';

export interface ValidationCheck {
  label: string;
  status: 'ready' | 'warning' | 'error';
  count: number;
  total: number;
  details: string[];
  /** Short actionable summary for inline display */
  summary: string;
}

export interface ValidationResult {
  ready: boolean;
  checks: {
    templates: ValidationCheck;
    instructors: ValidationCheck;
    venues: ValidationCheck;
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const programId = request.nextUrl.searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json(
        { error: 'program_id query parameter is required' },
        { status: 400 }
      );
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

    const supabase = createServiceClient();

    // Fetch all data in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [programRes, templatesRes, staffRes, venuesRes] = await Promise.all([
      (supabase.from('programs') as any).select('*').eq('id', programId).single(),
      (supabase.from('session_templates') as any)
        .select('*')
        .eq('program_id', programId)
        .eq('is_active', true),
      (supabase.from('staff') as any).select('*').eq('program_id', programId).eq('is_active', true),
      (supabase.from('venues') as any).select('*').eq('program_id', programId),
    ]);

    if (programRes.error) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // --- Templates check ---
    const templates = templatesRes.data ?? [];
    const templateDetails: string[] = [];
    let templateStatus: 'ready' | 'warning' | 'error' = 'ready';
    let templateSummary = '';

    if (templates.length === 0) {
      templateStatus = 'error';
      templateDetails.push('No active templates found');
      templateSummary = '0 templates found';
    } else {
      // Check for templates missing critical fields
      // Templates without start/end times are valid if they have duration_minutes
      // (the engine will auto-assign times based on availability)
      const missingTime = templates.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (t: any) => (!t.start_time || !t.end_time) && !t.duration_minutes
      );
      const missingGrades = templates.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (t: any) => !t.grade_groups || t.grade_groups.length === 0
      );
      const missingEventType = templates.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (t: any) => !t.required_skills || t.required_skills.length === 0
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const templateName = (t: any) => t.name || 'Unnamed';

      if (missingTime.length > 0) {
        templateStatus = 'warning';
        const names = missingTime.map(templateName).join(', ');
        templateDetails.push(`${missingTime.length} ${missingTime.length === 1 ? 'template is' : 'templates are'} missing start/end time and duration: ${names}`);
      }
      if (missingGrades.length > 0) {
        const names = missingGrades.map(templateName).join(', ');
        templateDetails.push(`${missingGrades.length} ${missingGrades.length === 1 ? 'template has' : 'templates have'} no grade groups assigned: ${names}`);
        if (templateStatus === 'ready') templateStatus = 'warning';
      }
      if (missingEventType.length > 0) {
        const names = missingEventType.map(templateName).join(', ');
        templateDetails.push(`${missingEventType.length} ${missingEventType.length === 1 ? 'template is' : 'templates are'} missing Event Types: ${names}`);
        if (templateStatus === 'ready') templateStatus = 'warning';
      }
      if (templateDetails.length === 0) {
        templateSummary = `${templates.length} active, all configured`;
      } else {
        // Count unique templates that have at least one issue
        const problemTemplateIds = new Set([
          ...missingTime.map((t: any) => t.id),
          ...missingGrades.map((t: any) => t.id),
          ...missingEventType.map((t: any) => t.id),
        ]);
        templateSummary = `${problemTemplateIds.size} of ${templates.length} need attention`;
      }
    }

    // --- Staff check ---
    const staffMembers = staffRes.data ?? [];
    const staffDetails: string[] = [];
    let staffStatus: 'ready' | 'warning' | 'error' = 'ready';
    let staffSummary = '';

    if (staffMembers.length === 0) {
      staffStatus = 'error';
      staffDetails.push('No active staff found');
      staffSummary = '0 staff found';
    } else {
      const withSkills = staffMembers.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (i: any) => i.skills && i.skills.length > 0
      );
      const withAvailability = staffMembers.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (i: any) => i.availability_json && Object.keys(i.availability_json).length > 0
      );
      const missingSkillsList = staffMembers.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (i: any) => !i.skills || i.skills.length === 0
      );
      const missingAvailList = staffMembers.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (i: any) => !i.availability_json || Object.keys(i.availability_json).length === 0
      );
      const missingSkills = missingSkillsList.length;
      const missingAvail = missingAvailList.length;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const staffName = (i: any) => `${i.first_name ?? ''} ${i.last_name ?? ''}`.trim() || 'Unnamed';

      if (withSkills.length === 0) {
        staffStatus = 'warning';
        staffDetails.push('None have event types configured');
      } else if (missingSkills > 0) {
        const names = missingSkillsList.map(staffName).join(', ');
        staffDetails.push(`${missingSkills} ${missingSkills === 1 ? 'staff member is' : 'staff members are'} missing event types: ${names}`);
      }

      if (withAvailability.length === 0) {
        staffStatus = 'warning';
        staffDetails.push('None have availability set');
      } else if (missingAvail > 0) {
        const names = missingAvailList.map(staffName).join(', ');
        staffDetails.push(`${missingAvail} ${missingAvail === 1 ? 'staff member is' : 'staff members are'} missing availability: ${names}`);
      }

      if (missingSkills > 0 || missingAvail > 0) {
        if (staffStatus === 'ready') staffStatus = 'warning';
        const problemStaffIds = new Set([
          ...missingSkillsList.map((i: any) => i.id),
          ...missingAvailList.map((i: any) => i.id),
        ]);
        staffSummary = `${problemStaffIds.size} of ${staffMembers.length} need attention`;
      } else {
        staffSummary = `${staffMembers.length} active, all configured`;
      }
    }

    // --- Venues check ---
    const venues = venuesRes.data ?? [];
    const venueDetails: string[] = [];
    let venueStatus: 'ready' | 'warning' | 'error' = 'ready';
    let venueSummary = '';

    if (venues.length === 0) {
      venueStatus = 'error';
      venueDetails.push('No venues configured');
      venueSummary = '0 venues found';
    } else {
      const withCapacity = venues.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (v: any) => v.max_capacity && v.max_capacity > 0
      );
      const withAvailability = venues.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (v: any) => v.availability_json && Object.keys(v.availability_json).length > 0
      );
      const missingCap = venues.length - withCapacity.length;
      const missingAvail = venues.length - withAvailability.length;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const venueName = (v: any) => v.name || 'Unnamed';
      const missingCapVenuesList = venues.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (v: any) => !v.max_capacity || v.max_capacity <= 0
      );
      const missingAvailVenuesList = venues.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (v: any) => !v.availability_json || Object.keys(v.availability_json).length === 0
      );

      if (missingCap > 0) {
        const names = missingCapVenuesList.map(venueName).join(', ');
        venueDetails.push(`${missingCap} of ${venues.length} missing capacity: ${names}`);
        if (venueStatus === 'ready') venueStatus = 'warning';
      }
      if (missingAvail > 0) {
        const names = missingAvailVenuesList.map(venueName).join(', ');
        venueDetails.push(`${missingAvail} of ${venues.length} missing availability: ${names}`);
        if (venueStatus === 'ready') venueStatus = 'warning';
      }
      if (venueDetails.length === 0) {
        venueSummary = `${venues.length} active, all configured`;
      } else {
        const problemVenueIds = new Set([
          ...missingCapVenuesList.map((v: any) => v.id),
          ...missingAvailVenuesList.map((v: any) => v.id),
        ]);
        venueSummary = `${problemVenueIds.size} of ${venues.length} ${problemVenueIds.size === 1 ? 'venue needs' : 'venues need'} attention`;
      }
    }

    const ready =
      templateStatus !== 'error' &&
      staffStatus !== 'error' &&
      venueStatus !== 'error';

    const result: ValidationResult = {
      ready,
      checks: {
        templates: {
          label: 'Event Templates',
          status: templateStatus,
          count: templates.length,
          total: templates.length,
          details: templateDetails,
          summary: templateSummary,
        },
        instructors: {
          label: 'Staff',
          status: staffStatus,
          count: staffMembers.length,
          total: staffMembers.length,
          details: staffDetails,
          summary: staffSummary,
        },
        venues: {
          label: 'Venues',
          status: venueStatus,
          count: venues.length,
          total: venues.length,
          details: venueDetails,
          summary: venueSummary,
        },
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('Validation API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
