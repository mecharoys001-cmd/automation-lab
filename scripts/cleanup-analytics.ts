/**
 * Analytics Cleanup Script
 * Run this periodically (e.g., daily cron) to delete analytics events older than 30 days
 * This prevents the hot path from being slowed down by cleanup operations
 */

import { createServiceClient } from '../lib/supabase-service';

async function cleanupOldAnalytics() {
  console.log('[analytics-cleanup] Starting cleanup...');
  
  try {
    const svc = createServiceClient();
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('analytics_events') as any)
      .delete()
      .lt('created_at', cutoffDate)
      .select('id'); // Get count of deleted rows
    
    if (error) {
      console.error('[analytics-cleanup] Error:', error);
      process.exit(1);
    }
    
    const count = Array.isArray(data) ? data.length : 0;
    console.log(`[analytics-cleanup] Deleted ${count} events older than ${cutoffDate}`);
    console.log('[analytics-cleanup] Cleanup complete!');
    process.exit(0);
  } catch (err) {
    console.error('[analytics-cleanup] Unexpected error:', err);
    process.exit(1);
  }
}

cleanupOldAnalytics();
