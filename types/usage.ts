// types/usage.ts

export interface ToolConfig {
  id: string;
  tool_id: string;
  display_name: string;
  minutes_per_use: number;
  tracking_method: 'per_use' | 'per_csv_upload' | 'per_schedule_run';
  description: string | null;
  is_active: boolean;
  is_external: boolean;
  tracking_notes: string | null;
  run_frequency: 'daily' | 'weekly' | 'monthly' | 'custom' | null;
  run_interval_days: number | null;
  first_run_date: string | null;
  historical_runs: number;
  historical_runs_seeded: boolean;
  next_run_date: string | null;
  visibility: 'public' | 'restricted' | 'hidden' | null;
  created_at: string;
  updated_at: string;
}

export interface ToolUsageEvent {
  id: string;
  tool_id: string;
  content_hash: string | null;
  user_email: string | null;
  org_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ToolUsageStats {
  tool_id: string;
  display_name: string;
  minutes_per_use: number;
  tracking_method: string;
  description: string | null;
  is_external?: boolean;
  tracking_notes?: string | null;
  run_frequency?: string | null;
  run_interval_days?: number | null;
  first_run_date?: string | null;
  next_run_date?: string | null;
  historical_runs_seeded?: boolean;
  visibility?: 'public' | 'restricted' | 'hidden' | null;
  total_uses: number;
  total_minutes_saved: number;
  total_hours_saved: number;
  last_used: string | null;
  unique_users?: number;
  repeat_users?: number;
  completion_rate?: number;
  avg_duration_seconds?: number;
}

export type UsageStatus = 'started' | 'completed' | 'error' | 'abandoned';

export interface TrackUsagePayload {
  tool_id: string;
  content_hash?: string;    // For CSV-based tools
  metadata?: Record<string, unknown>;
  status?: UsageStatus;
  duration_seconds?: number;
  error_message?: string;
  usage_session_id?: string;
}
