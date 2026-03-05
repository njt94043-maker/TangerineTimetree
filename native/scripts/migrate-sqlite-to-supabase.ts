/**
 * SQLite → Supabase Migration Script
 *
 * Reads data from GigBooks SQLite (native app) and upserts into Supabase.
 * Run from native/ directory:  npx ts-node scripts/migrate-sqlite-to-supabase.ts
 *
 * Prerequisites:
 *   1. Run the S10 migration SQL in Supabase first (20260304200000_invoicing_schema.sql)
 *   2. Set SUPABASE_SERVICE_ROLE_KEY env var (bypasses RLS)
 *   3. Have the SQLite DB file accessible (gigbooks.db)
 *
 * This script uses the service role key (not anon key) to bypass RLS.
 * It maps SQLite text IDs → Supabase UUIDs and preserves relationships.
 */

import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import * as path from 'path';

// ─── Config ────────────────────────────────────────────

const SUPABASE_URL = 'https://jlufqgslgjowfaqmqlds.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

// Nathan's Supabase user ID (admin) — all migrated data owned by this user
const NATHAN_USER_ID = process.env.NATHAN_USER_ID;
if (!NATHAN_USER_ID) {
  console.error('ERROR: Set NATHAN_USER_ID environment variable (UUID from Supabase auth.users)');
  process.exit(1);
}

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'gigbooks.db');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── ID Mapping ────────────────────────────────────────

// SQLite uses text IDs like "client_gin_juice"; Supabase uses UUIDs.
// We track the mapping so FKs are preserved.
const clientIdMap = new Map<string, string>();  // old → new UUID
const venueIdMap = new Map<string, string>();
const invoiceIdMap = new Map<string, string>();
const memberIdMap = new Map<string, string>();  // old member_id → profile UUID

// ─── SQLite Types ──────────────────────────────────────

interface SqliteClient {
  id: string;
  company_name: string;
  contact_name: string;
  address: string;
  email: string;
  phone: string;
  created_at: string;
}

interface SqliteVenue {
  id: string;
  client_id: string;
  venue_name: string;
  created_at: string;
}

interface SqliteInvoice {
  id: string;
  invoice_number: string;
  client_id: string;
  venue: string;
  gig_date: string;
  amount: number;
  description: string;
  issue_date: string;
  due_date: string;
  status: string;
  paid_date: string;
  pdf_uri: string;
  style: string;
  created_at: string;
}

interface SqliteReceipt {
  id: string;
  invoice_id: string;
  member_id: string;
  amount: number;
  date: string;
  pdf_uri: string;
  created_at: string;
}

interface SqliteSettings {
  your_name: string;
  trading_as: string;
  business_type: string;
  website: string;
  email: string;
  phone: string;
  bank_account_name: string;
  bank_name: string;
  bank_sort_code: string;
  bank_account_number: string;
  payment_terms_days: number;
  next_invoice_number: number;
}

interface SqliteBandMember {
  id: string;
  name: string;
  sort_order: number;
  is_self: number;
}

// ─── Migration Functions ───────────────────────────────

async function migrateSettings(db: Database.Database): Promise<void> {
  console.log('\n📋 Migrating settings...');

  const settings = db.prepare(
    'SELECT your_name, trading_as, business_type, website, email, phone, bank_account_name, bank_name, bank_sort_code, bank_account_number, payment_terms_days, next_invoice_number FROM settings WHERE id = ?'
  ).get('default') as SqliteSettings | undefined;

  if (!settings) {
    console.log('  No settings found, skipping');
    return;
  }

  // User settings → user_settings table
  const { error: userError } = await supabase
    .from('user_settings')
    .upsert({
      id: NATHAN_USER_ID,
      your_name: settings.your_name,
      email: settings.email,
      phone: settings.phone,
      bank_account_name: settings.bank_account_name,
      bank_name: settings.bank_name,
      bank_sort_code: settings.bank_sort_code,
      bank_account_number: settings.bank_account_number,
    });

  if (userError) {
    console.error('  ERROR migrating user_settings:', userError.message);
  } else {
    console.log('  ✓ user_settings migrated');
  }

  // Band settings → band_settings table
  const { error: bandError } = await supabase
    .from('band_settings')
    .upsert({
      id: 'default',
      trading_as: settings.trading_as,
      business_type: settings.business_type,
      website: settings.website,
      payment_terms_days: settings.payment_terms_days,
      next_invoice_number: settings.next_invoice_number,
    });

  if (bandError) {
    console.error('  ERROR migrating band_settings:', bandError.message);
  } else {
    console.log('  ✓ band_settings migrated (next_invoice_number:', settings.next_invoice_number, ')');
  }
}

async function migrateBandMembers(db: Database.Database): Promise<void> {
  console.log('\n👥 Mapping band members to profiles...');

  const members = db.prepare('SELECT * FROM band_members ORDER BY sort_order').all() as SqliteBandMember[];
  const { data: profiles } = await supabase.from('profiles').select('id, name, is_admin').order('name');

  if (!profiles || profiles.length === 0) {
    console.error('  ERROR: No profiles found in Supabase. Create user accounts first.');
    return;
  }

  // Map member_1 (is_self=1) → Nathan's profile (is_admin=true)
  const adminProfile = profiles.find((p: any) => p.is_admin);
  const selfMember = members.find(m => m.is_self === 1);

  if (adminProfile && selfMember) {
    memberIdMap.set(selfMember.id, adminProfile.id);
    console.log(`  ✓ ${selfMember.name} → ${adminProfile.name} (admin)`);
  }

  // Map other members by sort order to non-admin profiles
  const otherMembers = members.filter(m => m.is_self !== 1);
  const otherProfiles = profiles.filter((p: any) => !p.is_admin);

  for (let i = 0; i < otherMembers.length && i < otherProfiles.length; i++) {
    memberIdMap.set(otherMembers[i].id, otherProfiles[i].id);
    console.log(`  ✓ ${otherMembers[i].name} → ${otherProfiles[i].name}`);
  }

  if (otherMembers.length > otherProfiles.length) {
    console.warn(`  ⚠ ${otherMembers.length - otherProfiles.length} SQLite members have no matching Supabase profile`);
  }
}

async function migrateClients(db: Database.Database): Promise<void> {
  console.log('\n🏢 Migrating clients...');

  const clients = db.prepare('SELECT * FROM clients ORDER BY company_name').all() as SqliteClient[];

  for (const c of clients) {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        company_name: c.company_name,
        contact_name: c.contact_name || '',
        address: c.address || '',
        email: c.email || '',
        phone: c.phone || '',
        created_by: NATHAN_USER_ID,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  ERROR: ${c.company_name}:`, error.message);
    } else {
      clientIdMap.set(c.id, data.id);
      console.log(`  ✓ ${c.company_name} → ${data.id}`);
    }
  }

  console.log(`  Total: ${clientIdMap.size}/${clients.length} clients migrated`);
}

async function migrateVenues(db: Database.Database): Promise<void> {
  console.log('\n📍 Migrating venues...');

  const venues = db.prepare('SELECT * FROM venues ORDER BY venue_name').all() as SqliteVenue[];

  for (const v of venues) {
    const newClientId = clientIdMap.get(v.client_id);
    if (!newClientId) {
      console.warn(`  ⚠ Skipping venue "${v.venue_name}" — client ${v.client_id} not migrated`);
      continue;
    }

    const { data, error } = await supabase
      .from('venues')
      .insert({
        client_id: newClientId,
        venue_name: v.venue_name,
        address: '',
        created_by: NATHAN_USER_ID,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  ERROR: ${v.venue_name}:`, error.message);
    } else {
      venueIdMap.set(v.id, data.id);
      console.log(`  ✓ ${v.venue_name} → ${data.id}`);
    }
  }

  console.log(`  Total: ${venueIdMap.size}/${venues.length} venues migrated`);
}

async function migrateInvoices(db: Database.Database): Promise<void> {
  console.log('\n📄 Migrating invoices...');

  const invoices = db.prepare('SELECT * FROM invoices ORDER BY created_at').all() as SqliteInvoice[];

  for (const inv of invoices) {
    const newClientId = clientIdMap.get(inv.client_id);
    if (!newClientId) {
      console.warn(`  ⚠ Skipping invoice ${inv.invoice_number} — client ${inv.client_id} not migrated`);
      continue;
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: inv.invoice_number,
        client_id: newClientId,
        venue: inv.venue,
        gig_date: inv.gig_date,
        amount: inv.amount,
        description: inv.description,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        status: inv.status || 'draft',
        paid_date: inv.paid_date || null,
        style: inv.style || 'classic',
        created_by: NATHAN_USER_ID,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  ERROR: ${inv.invoice_number}:`, error.message);
    } else {
      invoiceIdMap.set(inv.id, data.id);
      console.log(`  ✓ ${inv.invoice_number} (£${inv.amount}) → ${data.id}`);
    }
  }

  console.log(`  Total: ${invoiceIdMap.size}/${invoices.length} invoices migrated`);
}

async function migrateReceipts(db: Database.Database): Promise<void> {
  console.log('\n🧾 Migrating receipts...');

  const receipts = db.prepare('SELECT * FROM receipts ORDER BY created_at').all() as SqliteReceipt[];
  let migrated = 0;

  for (const r of receipts) {
    const newInvoiceId = invoiceIdMap.get(r.invoice_id);
    const newMemberId = memberIdMap.get(r.member_id);

    if (!newInvoiceId) {
      console.warn(`  ⚠ Skipping receipt — invoice ${r.invoice_id} not migrated`);
      continue;
    }
    if (!newMemberId) {
      console.warn(`  ⚠ Skipping receipt — member ${r.member_id} not mapped`);
      continue;
    }

    const { error } = await supabase
      .from('receipts')
      .insert({
        invoice_id: newInvoiceId,
        member_id: newMemberId,
        amount: r.amount,
        date: r.date,
      });

    if (error) {
      console.error(`  ERROR:`, error.message);
    } else {
      migrated++;
    }
  }

  console.log(`  Total: ${migrated}/${receipts.length} receipts migrated`);
}

// ─── Main ──────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════');
  console.log('  GigBooks SQLite → Supabase Migration');
  console.log('═══════════════════════════════════════════════');
  console.log(`  DB path: ${DB_PATH}`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  Owner: ${NATHAN_USER_ID}`);

  let db: Database.Database;
  try {
    db = new Database(DB_PATH, { readonly: true });
  } catch (err) {
    console.error(`\nERROR: Could not open SQLite database at ${DB_PATH}`);
    console.error('  Copy gigbooks.db from the Android device first.');
    console.error('  adb pull /data/data/com.gigbooks/databases/gigbooks.db .');
    process.exit(1);
  }

  try {
    await migrateSettings(db);
    await migrateBandMembers(db);
    await migrateClients(db);
    await migrateVenues(db);
    await migrateInvoices(db);
    await migrateReceipts(db);

    console.log('\n═══════════════════════════════════════════════');
    console.log('  Migration Summary');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Clients:  ${clientIdMap.size}`);
    console.log(`  Venues:   ${venueIdMap.size}`);
    console.log(`  Invoices: ${invoiceIdMap.size}`);
    console.log(`  Members:  ${memberIdMap.size}`);
    console.log('\n  ✅ Done! Verify data in Supabase Dashboard.');
  } finally {
    db.close();
  }
}

main().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
