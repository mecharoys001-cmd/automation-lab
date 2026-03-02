import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[SUPABASE] URL:', url?.slice(0, 40));
  console.log('[SUPABASE] KEY exists:', !!key);
  console.log('[SUPABASE] KEY length:', key?.length);
  console.log('[SUPABASE] KEY ends with:', key?.slice(-20));

  if (!url || !key) {
    throw new Error(`Missing env vars: URL=${!!url} KEY=${!!key}`);
  }

  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
