// types/activity.ts

export type ActivityEventType =
  | 'login'
  | 'logout'
  | 'tool_open'
  | 'tool_complete'
  | 'tool_error';

export interface ActivityLogEvent {
  id: string;
  event_type: ActivityEventType;
  user_email: string | null;
  user_id: string | null;
  tool_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ActivityFeedItem {
  id: string;
  event_type: ActivityEventType;
  user_email: string | null;
  tool_id: string | null;
  tool_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActivityFeedResponse {
  items: ActivityFeedItem[];
  total: number;
  page: number;
  pageSize: number;
}
