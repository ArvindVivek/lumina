import pg from 'postgres';

// Use direct connection instead of pooler
const sql = pg('postgresql://postgres:Eaglestrike%23123@db.fbloukfgdjvwzdgrcnzt.supabase.co:5432/postgres', {
  ssl: 'require'
});

console.log('🔍 Checking mosaic views directly...\n');

try {
  // Check if mosaic schema exists
  const schemas = await sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'mosaic'`;
  console.log('Mosaic schema exists:', schemas.length > 0);

  if (schemas.length > 0) {
    // Check views in mosaic schema
    const views = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'mosaic'
      AND table_type IN ('VIEW', 'MATERIALIZED VIEW')
    `;

    console.log('\nViews in mosaic schema:');
    views.forEach(v => console.log(`  - ${v.table_name}`));

    // Try to query a view
    if (views.length > 0) {
      const viewName = views[0].table_name;
      console.log(`\nQuerying ${viewName}...`);
      const data = await sql`SELECT COUNT(*) as count FROM mosaic.${sql(viewName)}`;
      console.log(`Rows in ${viewName}: ${data[0].count}`);
    }
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}
