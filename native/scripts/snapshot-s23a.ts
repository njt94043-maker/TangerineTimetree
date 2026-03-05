/**
 * S23A Data Snapshot — backup clients, venues, gigs, quotes, invoices, formal_invoices
 * to a local JSON file before the venue/client restructure migration.
 *
 * Usage: npx ts-node native/scripts/snapshot-s23a.ts
 * (or: npx tsx native/scripts/snapshot-s23a.ts)
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

async function snapshot() {
  const tables = ['clients', 'venues', 'gigs', 'quotes', 'invoices', 'formal_invoices'] as const;
  const data: Record<string, unknown[]> = {};

  for (const table of tables) {
    const { data: rows, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      data[table] = [];
    } else {
      data[table] = rows ?? [];
      console.log(`${table}: ${(rows ?? []).length} rows`);
    }
  }

  const outPath = path.join(__dirname, '..', '..', 'backups', `snapshot-s23a-${new Date().toISOString().slice(0, 10)}.json`);
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`\nSnapshot saved to: ${outPath}`);
}

snapshot().catch(err => {
  console.error('Snapshot failed:', err);
  process.exit(1);
});
