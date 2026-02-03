import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🔍 Checking processed column...\n');

// Check total series
const { count: totalSeries } = await supabase
  .from('series')
  .select('*', { count: 'exact', head: true });

console.log(`Total series: ${totalSeries}`);

// Check processed = true
const { count: processedTrue } = await supabase
  .from('series')
  .select('*', { count: 'exact', head: true })
  .eq('processed', true);

console.log(`Series with processed=true: ${processedTrue}`);

// Check processed = false
const { count: processedFalse } = await supabase
  .from('series')
  .select('*', { count: 'exact', head: true })
  .eq('processed', false);

console.log(`Series with processed=false: ${processedFalse}`);

// Check null processed
const { count: processedNull } = await supabase
  .from('series')
  .select('*', { count: 'exact', head: true })
  .is('processed', null);

console.log(`Series with processed=null: ${processedNull}`);

// Sample a few series to see the processed value
const { data: sampleSeries } = await supabase
  .from('series')
  .select('id, processed')
  .limit(5);

console.log('\nSample series:');
sampleSeries?.forEach(s => console.log(`  ID: ${s.id}, processed: ${s.processed}`));
