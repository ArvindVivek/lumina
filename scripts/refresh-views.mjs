import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('Refreshing mosaic materialized views...');

// Use the public schema wrapper function
const { data, error } = await supabase.rpc('refresh_all_mosaic_views');

if (error) {
  console.error('❌ Error refreshing views:', error);
  process.exit(1);
}

console.log('✅ Successfully refreshed materialized views');
console.log('Result:', data);
