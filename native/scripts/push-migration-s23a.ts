/**
 * Push S23A migration SQL to Supabase via the REST API.
 * Runs each statement individually for better error reporting.
 *
 * Usage: npx tsx native/scripts/push-migration-s23a.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://jlufqgslgjowfaqmqlds.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var first');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  const sqlPath = path.join(__dirname, 'migration-s23a.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Split into individual statements, filtering out comments and empty lines
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Running ${statements.length} SQL statements...\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    // Get first meaningful line as label
    const label = stmt.split('\n').filter(l => !l.trim().startsWith('--') && l.trim())[0]?.trim().slice(0, 80) ?? `Statement ${i + 1}`;

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_text: stmt + ';' });
      if (error) {
        // Try direct SQL approach via postgrest
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ sql_text: stmt + ';' }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
      }
      console.log(`  ✓ [${i + 1}/${statements.length}] ${label}`);
    } catch (err: any) {
      console.error(`  ✗ [${i + 1}/${statements.length}] ${label}`);
      console.error(`    Error: ${err.message}\n`);
    }
  }

  console.log('\nMigration complete!');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
