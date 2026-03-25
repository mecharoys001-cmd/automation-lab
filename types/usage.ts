// types/usage.ts

export interface ToolConfig {
  id: string;
  tool_id: string;
  display_name: string;
  minutes_per_use: number;
  tracking_method: 'per_use' | 'per_csv_upload' | 'per_schedule_run';
  description: string | null;
  is_active: boolean;
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
  total_uses: number;
  total_minutes_saved: number;
  total_hours_saved: number;
  last_used: string | null;
}

export interface TrackUsagePayload {
  tool_id: string;
  content_hash?: string;    // For CSV-based tools
  metadata?: Record<string, unknown>;
}
