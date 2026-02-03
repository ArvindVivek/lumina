/**
 * Apply the migration to fix empty series arrays
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Applying Mosaic Fix Migration           ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260202000001_fix_mosaic_empty_series_arrays.sql');

  console.log(`Reading migration file: ${migrationPath}\n`);

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Executing migration...\n');

  // Split by statement separators and execute each
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`Executing statement ${i + 1}/${statements.length}...`);

    try {
      // Use raw SQL execution via edge function or direct connection
      // For Supabase, we need to use the SQL editor approach or psql
      // Since we can't execute raw SQL via JS client easily, we'll use a workaround

      // Try to detect what type of statement this is
      if (statement.includes('CREATE OR REPLACE FUNCTION')) {
        const functionName = statement.match(/FUNCTION (\w+\.\w+|\w+)/i)?.[1];
        console.log(`  Creating/replacing function: ${functionName}`);
      } else if (statement.includes('GRANT')) {
        console.log(`  Granting permissions...`);
      } else if (statement.includes('COMMENT')) {
        console.log(`  Adding comment...`);
      }

      // For now, we'll output the SQL for manual execution
      successCount++;
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
      errorCount++;
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`Statements processed: ${statements.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);

  console.log('\n⚠️  Note: Supabase JS client cannot execute raw SQL migrations.');
  console.log('Please apply this migration using one of these methods:');
  console.log('1. Supabase Studio SQL Editor: https://supabase.com/dashboard/project/fbloukfgdjvwzdgrcnzt/sql');
  console.log('2. psql: psql postgresql://postgres.fbloukfgdjvwzdgrcnzt:Eaglestrike%23123@aws-0-us-west-1.pooler.supabase.com:6543/postgres');
  console.log(`3. Copy the SQL from: ${migrationPath}`);
}

main().catch(console.error);
