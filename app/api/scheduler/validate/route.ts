/**
 * GET /api/scheduler/validate?program_id=xxx
 *
 * Returns a readiness report for auto-schedule generation.
 * Checks that templates, instructors, and venues are properly
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
    const [programRes, templatesRes, instructorsRes, venuesRes] = await Promise.all([
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
      const missingTime = templates.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (t: any) => !t.start_time || !t.end_time
      );
      const missingGrades = templates.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (t: any) => !t.grade_groups || t.grade_groups.length === 0
      );

      if (missingTime.length > 0) {
        templateStatus = 'warning';
        templateDetails.push(`${missingTime.length} ${missingTime.length === 1 ? 'template is' : 'templates are'} missing start/end time`);
      }
      if (missingGrades.length > 0) {
        templateDetails.push(`${missingGrades.length} ${missingGrades.length === 1 ? 'template has' : 'templates have'} no grade groups assigned`);
        if (templateStatus === 'ready') templateStatus = 'warning';
      }
      if (templateDetails.length === 0) {
        templateSummary = `${templates.length} active, all configured`;
      } else {
        // Count unique templates that have at least one issue
        const problemTemplateIds = new Set([
          ...missingTime.map((t: any) => t.id),
          ...missingGrades.map((t: any) => t.id),
        ]);
        templateSummary = `${problemTemplateIds.size} of ${templates.length} need attention`;
      }
    }

    // --- Instructors check ---
    const instructors = instructorsRes.data ?? [];
    const instructorDetails: string[] = [];
    let instructorStatus: 'ready' | 'warning' | 'error' = 'ready';
    let instructorSummary = '';

    if (instructors.length === 0) {
      instructorStatus = 'error';
      instructorDetails.push('No active instructors found');
      instructorSummary = '0 instructors found';
    } else {
      const withSkills = instructors.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (i: any) => i.skills && i.skills.length > 0
      );
      const withAvailability = instructors.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (i: any) => i.availability_json && Object.keys(i.availability_json).length > 0
      );
      const missingSkills = instructors.length - withSkills.length;
      const missingAvail = instructors.length - withAvailability.length;

      if (withSkills.length === 0) {
        instructorStatus = 'warning';
        instructorDetails.push('None have event types configured');
      } else if (missingSkills > 0) {
        instructorDetails.push(`${missingSkills} ${missingSkills === 1 ? 'instructor is' : 'instructors are'} missing event types`);
      }

      if (withAvailability.length === 0) {
        instructorStatus = 'warning';
        instructorDetails.push('None have availability set');
      } else if (missingAvail > 0) {
        instructorDetails.push(`${missingAvail} ${missingAvail === 1 ? 'instructor is' : 'instructors are'} missing availability`);
      }

      if (missingSkills > 0 || missingAvail > 0) {
        if (instructorStatus === 'ready') instructorStatus = 'warning';
        // Count unique instructors that have at least one issue
        const missingSkillsInstructors = instructors.filter(
          (i: any) => !i.skills || i.skills.length === 0
        );
        const missingAvailInstructors = instructors.filter(
          (i: any) => !i.availability_json || Object.keys(i.availability_json).length === 0
        );
        const problemInstructorIds = new Set([
          ...missingSkillsInstructors.map((i: any) => i.id),
          ...missingAvailInstructors.map((i: any) => i.id),
        ]);
        instructorSummary = `${problemInstructorIds.size} of ${instructors.length} need attention`;
      } else {
        instructorSummary = `${instructors.length} active, all configured`;
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

      if (missingCap > 0) {
        venueDetails.push(`${missingCap} of ${venues.length} missing capacity`);
        if (venueStatus === 'ready') venueStatus = 'warning';
      }
      if (missingAvail > 0) {
        venueDetails.push(`${missingAvail} of ${venues.length} missing availability`);
        if (venueStatus === 'ready') venueStatus = 'warning';
      }
      if (venueDetails.length === 0) {
        venueSummary = `${venues.length} active, all configured`;
      } else {
        // Count unique venues that have at least one issue
        const missingCapVenues = venues.filter(
          (v: any) => !v.max_capacity || v.max_capacity <= 0
        );
        const missingAvailVenues = venues.filter(
          (v: any) => !v.availability_json || Object.keys(v.availability_json).length === 0
        );
        const problemVenueIds = new Set([
          ...missingCapVenues.map((v: any) => v.id),
          ...missingAvailVenues.map((v: any) => v.id),
        ]);
        venueSummary = `${problemVenueIds.size} of ${venues.length} ${problemVenueIds.size === 1 ? 'venue needs' : 'venues need'} attention`;
      }
    }

    const ready =
      templateStatus !== 'error' &&
      instructorStatus !== 'error' &&
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
          label: 'Instructors',
          status: instructorStatus,
          count: instructors.length,
          total: instructors.length,
          details: instructorDetails,
          summary: instructorSummary,
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
