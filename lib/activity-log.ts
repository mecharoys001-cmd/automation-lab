import { createServiceClient } from '@/lib/supabase-service';

export type SchedulerActivityAction =
  | 'create_staff'
  | 'update_staff'
  | 'delete_staff'
  | 'create_venue'
  | 'update_venue'
  | 'delete_venue'
  | 'create_template'
  | 'update_template'
  | 'delete_template'
  | 'create_session'
  | 'update_session'
  | 'delete_session'
  | 'create_calendar_entry'
  | 'update_calendar_entry'
  | 'delete_calendar_entry'
  | 'generate_sessions'
  | 'bulk_update_sessions'
  | 'bulk_assign_sessions'
  | 'delete_draft_sessions'
  | 'cancel_future_sessions'
  | 'delete_future_sessions'
  | 'publish_placements'
  | 'publish_schedule'
  | 'flag_sessions'
  | 'resolve_exception'
  | 'update_settings'
  | 'save_version'
  | 'revert_version';

interface LogSchedulerActivityArgs {
  user: { id: string; email: string };
  action: SchedulerActivityAction;
  entityName?: string | null;
  count?: number;
  programId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget insert into activity_log for a meaningful scheduler save.
 * Surfaces in the Impact Dashboard activity feed via event_type='scheduler_action'.
 * Errors are logged but never thrown — the caller's primary mutation already
 * succeeded by the time we get here.
 */
export function logSchedulerActivity(args: LogSchedulerActivityArgs): void {
  try {
    const svc = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('activity_log') as any).insert({
      event_type: 'scheduler_action',
      user_email: args.user.email,
      user_id: args.user.id,
      tool_id: 'scheduler',
      metadata: {
        action: args.action,
        entity_name: args.entityName ?? null,
        count: args.count ?? 1,
        program_id: args.programId ?? null,
        ...(args.metadata ?? {}),
      },
    }).then(({ error }: { error: unknown }) => {
      if (error) console.warn('[activity-log] scheduler insert failed:', error);
    }).catch((err: unknown) => {
      console.warn('[activity-log] scheduler insert error:', err);
    });
  } catch (err) {
    console.warn('[activity-log] scheduler log threw:', err);
  }
}
