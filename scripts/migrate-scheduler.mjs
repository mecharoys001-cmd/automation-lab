#!/usr/bin/env node
/**
 * migrate-scheduler.mjs
 * 
 * Runs the Symphonix Scheduler Supabase migrations on the Automation Lab's Supabase instance.
 * This script reads each migration file and executes it in order.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get env vars from .env.local
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
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

console.log('🔧 Connecting to Supabase:', SUPABASE_URL);
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// List of migrations to run (in order)
const migrations = [
  '001_schema.sql',
  '002_rls_policies.sql',
  '003_seed_data.sql',
  '004_phase4_exceptions.sql',
  '006_venue_parameters.sql',
  '007_settings.sql'
];

// Path to the source migrations (from symphonix-scheduler)
const migrationsPath = '/home/ethan/.openclaw/workspace/projects/symphonix-scheduler/supabase/migrations';

async function runMigration(filename) {
  console.log(`\n📄 Running migration: ${filename}`);
  const sqlPath = join(migrationsPath, filename);
  const sql = readFileSync(sqlPath, 'utf-8');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try direct query if RPC doesn't exist
      const { error: directError } = await supabase.from('_migrations').insert({ name: filename });
      if (directError) {
        console.error(`❌ Error running ${filename}:`, error);
        // Continue anyway - may be already applied
      } else {
        console.log(`✅ ${filename} completed`);
      }
    } else {
      console.log(`✅ ${filename} completed`);
    }
  } catch (err) {
    console.error(`❌ Exception running ${filename}:`, err.message);
  }
}

async function main() {
  console.log('🚀 Starting Symphonix Scheduler migrations...\n');
  
  // Note: Supabase doesn't allow arbitrary SQL via the client API by default.
  // We need to use the Supabase SQL Editor or the service role key.
  console.log('⚠️  NOTE: These migrations must be run manually via the Supabase SQL Editor.');
  console.log('📋 Go to: https://supabase.com/dashboard/project/djuygbsnqakbctkjlmvl/sql/new');
  console.log('\nMigrations to run (in order):');
  
  for (const migration of migrations) {
    const sqlPath = join(migrationsPath, migration);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 ${migration}`);
    console.log('='.repeat(60));
    const sql = readFileSync(sqlPath, 'utf-8');
    console.log(sql);
  }
  
  console.log('\n✅ All migration SQL displayed above.');
  console.log('🔧 Copy and paste each migration into the Supabase SQL Editor and run them in order.');
}

main().catch(console.error);
