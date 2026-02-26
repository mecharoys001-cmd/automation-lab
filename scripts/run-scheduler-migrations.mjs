#!/usr/bin/env node
/**
 * run-scheduler-migrations.mjs
 * 
 * Applies Symphonix Scheduler migrations to Automation Lab's Supabase
 * Reads .env.local and executes migrations via postgres client
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse .env.local
const envPath = join(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');
const env = {};
for (const line of envLines) {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    env[match[1]] = match[2];
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;

if (!SUPABASE_URL) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

// Extract project ref from Supabase URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not parse project ref from SUPABASE_URL');
  process.exit(1);
}

console.log('📋 Supabase Project:', projectRef);
console.log('\n⚠️  MANUAL MIGRATION REQUIRED');
console.log('━'.repeat(60));
console.log('\nPlease run these migrations manually in the Supabase SQL Editor:');
console.log(`🔗 https://supabase.com/dashboard/project/${projectRef}/sql/new`);
console.log('\nMigrations are located at:');
console.log('/home/ethan/.openclaw/workspace/projects/symphonix-scheduler/supabase/migrations/');
console.log('\nRun in this order:');
console.log('  1. 001_schema.sql');
console.log('  2. 002_rls_policies.sql');
console.log('  3. 003_seed_data.sql');
console.log('  4. 004_phase4_exceptions.sql');
console.log('  5. 006_venue_parameters.sql');
console.log('  6. 007_settings.sql');
console.log('\n✅ After running migrations, restart the dev server.');
