/**
 * Apply migration by executing SQL directly
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

const DATABASE_URL = 'postgresql://postgres.fbloukfgdjvwzdgrcnzt:Eaglestrike%23123@aws-0-us-west-1.pooler.supabase.com:6543/postgres';

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Applying Mosaic Fix Migration           ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260202000001_fix_mosaic_empty_series_arrays.sql');

  console.log(`Reading migration file: ${migrationPath}\n`);

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Migration SQL:\n');
  console.log('─'.repeat(80));
  console.log(sql);
  console.log('─'.repeat(80));
  console.log('\n');

  console.log('To apply this migration, run:');
  console.log('\npsql "$DATABASE_URL" <<\'EOF\'');
  console.log(sql);
  console.log('EOF');
}

main().catch(console.error);
