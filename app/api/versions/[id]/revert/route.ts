/**
 * POST /api/versions/:id/revert
 *
 * Full revert: replace ALL scheduling data from a version snapshot,
 * including instructors, venues, and tags.
 *
 * Delete order (respecting FK constraints):
 *   1. session_tags (depends on sessions + tags)
 *   2. sessions (depends on instructors, venues, templates)
 *   3. session_templates
 *   4. school_calendar
 *   5. instructors, venues, tags
 *
 * Insert order (satisfying FK constraints):
 *   1. instructors, venues, tags (no dependencies)
 *   2. session_templates
 *   3. sessions (depends on instructors, venues, templates)
 *   4. session_tags (depends on sessions + tags)
 *   5. school_calendar
 *
 *   6. UPDATE settings from snapshot
 *   7. If snapshot status=published, set all restored sessions to published
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import type { ScheduleSnapshot } from '@/types/database';
import { requireAdmin, requireMasterAdmin } from '@/lib/api-auth';
import { logSchedulerActivity } from '@/lib/activity-log';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    // Destructive: only master admins can revert to a previous version
    const masterCheck = requireMasterAdmin(auth.user);
    if (masterCheck) return masterCheck;

    const { id } = await params;
    const supabase = createServiceClient();

    // ── 1. Load the version ──────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: version, error: fetchErr } = await (supabase.from('schedule_versions') as any)
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !version) {
      return NextResponse.json(
        { error: fetchErr?.message ?? 'Version not found' },
        { status: 404 }
      );
    }

    const snapshot = version.snapshot as ScheduleSnapshot;
    const year = version.year as number;
    const isPublished = version.status === 'published';
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Old snapshots lack instructors/venues/tags fields — skip those
    // tables to avoid breaking FK constraints on existing data.
    const hasEntityData = 'instructors' in snapshot && 'venues' in snapshot && 'tags' in snapshot;

    // ── 2. DELETE current data (FK-safe order) ───────────────

    // 2a. Delete session_tags (depends on sessions + tags)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentSessions } = await (supabase.from('sessions') as any)
      .select('id')
      .gte('date', startDate)
      .lte('date', endDate);

    const currentSessionIds = (currentSessions ?? []).map((s: { id: string }) => s.id);

    if (currentSessionIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('session_tags') as any)
        .delete()
        .in('session_id', currentSessionIds);
    }

    // 2b. Delete sessions (depends on instructors, venues, templates)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('sessions') as any)
      .delete()
      .gte('date', startDate)
      .lte('date', endDate);

    // 2c. Delete session_templates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('session_templates') as any)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

    // 2d. Delete school_calendar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('school_calendar') as any)
      .delete()
      .gte('date', startDate)
      .lte('date', endDate);

    // 2e. Delete instructors, venues, tags (only if snapshot has them)
    if (hasEntityData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('staff') as any)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('venues') as any)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('tags') as any)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // ── 3. INSERT data from snapshot (FK-safe order) ─────────

    // 3a. Restore instructors, venues, tags (only if snapshot has them)
    if (hasEntityData) {
      if (snapshot.instructors?.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: instrErr } = await (supabase.from('staff') as any)
          .insert(snapshot.instructors);

        if (instrErr) {
          console.error('Revert: instructors insert error:', instrErr.message);
        }
      }

      if (snapshot.venues?.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: venueErr } = await (supabase.from('venues') as any)
          .insert(snapshot.venues);

        if (venueErr) {
          console.error('Revert: venues insert error:', venueErr.message);
        }
      }

      if (snapshot.tags?.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: tagErr } = await (supabase.from('tags') as any)
          .insert(snapshot.tags);

        if (tagErr) {
          console.error('Revert: tags insert error:', tagErr.message);
        }
      }
    }

    // 3b. Restore session_templates (sessions reference template_id)
    if (snapshot.session_templates?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: tmplErr } = await (supabase.from('session_templates') as any)
        .insert(snapshot.session_templates);

      if (tmplErr) {
        console.error('Revert: session_templates insert error:', tmplErr.message);
        return NextResponse.json(
          { error: `Failed to restore session templates: ${tmplErr.message}` },
          { status: 500 }
        );
      }
    }

    // Query the database for actually-inserted template IDs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dbTemplates } = await (supabase.from('session_templates') as any)
      .select('id');
    const restoredTemplateIds = new Set(
      (dbTemplates ?? []).map((t: { id: string }) => t.id)
    );

    // 3c. Restore sessions (depends on instructors, venues, templates)
    let sessionsSkipped = 0;
    if (snapshot.sessions?.length > 0) {
      // Validate template_id references exist in actually-restored templates
      const validSessions = snapshot.sessions.filter((s) => {
        if (s.template_id && !restoredTemplateIds.has(s.template_id)) {
          return false;
        }
        return true;
      });
      sessionsSkipped = snapshot.sessions.length - validSessions.length;

      if (sessionsSkipped > 0) {
        const orphanedIds = snapshot.sessions
          .filter((s) => s.template_id && !restoredTemplateIds.has(s.template_id))
          .map((s) => s.template_id);
        const uniqueIds = [...new Set(orphanedIds)];
        console.warn(
          `Revert: skipped ${sessionsSkipped} session(s) referencing missing template_id(s): ${uniqueIds.join(', ')}`
        );
      }

      if (validSessions.length > 0) {
        const sessions = validSessions.map((s) => ({
          ...s,
          status: isPublished ? 'published' : s.status,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: sessErr } = await (supabase.from('sessions') as any)
          .insert(sessions);

        if (sessErr) {
          console.error('Revert: sessions insert error:', sessErr.message);
          return NextResponse.json(
            { error: `Failed to restore sessions: ${sessErr.message}` },
            { status: 500 }
          );
        }
      }
    }

    // 3d. Restore session_tags (depends on sessions + tags)
    if (snapshot.session_tags?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: stErr } = await (supabase.from('session_tags') as any)
        .insert(snapshot.session_tags);

      if (stErr) {
        console.error('Revert: session_tags insert error:', stErr.message);
      }
    }

    // 3e. Restore school_calendar
    if (snapshot.school_calendar?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: calErr } = await (supabase.from('school_calendar') as any)
        .insert(snapshot.school_calendar);

      if (calErr) {
        console.error('Revert: school_calendar insert error:', calErr.message);
      }
    }

    // ── 4. UPDATE settings from snapshot ─────────────────────
    if (snapshot.settings) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: currentSettings } = await (supabase.from('settings') as any)
        .select('id')
        .limit(1)
        .single();

      if (currentSettings) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('settings') as any)
          .update({
            buffer_time_enabled: snapshot.settings.buffer_time_enabled,
            buffer_time_minutes: snapshot.settings.buffer_time_minutes,
            last_modified_at: new Date().toISOString(),
          })
          .eq('id', currentSettings.id);
      }
    }

    const warnings: string[] = [];
    if (sessionsSkipped > 0) {
      warnings.push(`${sessionsSkipped} session(s) skipped due to missing templates`);
    }
    if (!hasEntityData) {
      warnings.push('old snapshot format — instructors/venues/tags left as-is');
    }

    logSchedulerActivity({
      user: auth.user,
      action: 'revert_version',
      entityName: `v${version.version_number} (${year})`,
      metadata: { year, version_number: version.version_number, status: version.status },
    });

    return NextResponse.json({
      success: true,
      message: `Reverted to version ${version.version_number} from ${version.created_at}` +
        (warnings.length > 0 ? ` (${warnings.join('; ')})` : ''),
      sessionsRestored: (snapshot.sessions?.length ?? 0) - sessionsSkipped,
      sessionsSkipped,
      templatesRestored: snapshot.session_templates?.length ?? 0,
      instructorsRestored: hasEntityData ? (snapshot.instructors?.length ?? 0) : 0,
      venuesRestored: hasEntityData ? (snapshot.venues?.length ?? 0) : 0,
      tagsRestored: hasEntityData ? (snapshot.tags?.length ?? 0) : 0,
      oldSnapshotFormat: !hasEntityData,
    });
  } catch (err) {
    console.error('Version revert error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
