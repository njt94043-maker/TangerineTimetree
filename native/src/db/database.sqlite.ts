import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('gigbooks.db');
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = await getDb();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      your_name TEXT DEFAULT 'Nathan Thomas',
      trading_as TEXT DEFAULT 'The Green Tangerine',
      business_type TEXT DEFAULT 'Live Music Entertainment',
      website TEXT DEFAULT 'www.thegreentangerine.com',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      bank_account_name TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      bank_sort_code TEXT DEFAULT '',
      bank_account_number TEXT DEFAULT '',
      payment_terms_days INTEGER DEFAULT 14,
      next_invoice_number INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      contact_name TEXT DEFAULT '',
      address TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS band_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      is_self INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      venue TEXT NOT NULL,
      gig_date TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      paid_date TEXT DEFAULT '',
      pdf_uri TEXT DEFAULT '',
      style TEXT DEFAULT 'classic',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      venue_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      pdf_uri TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (member_id) REFERENCES band_members(id)
    );
  `);

  // Migration: add style column to invoices if missing (existing installs)
  try {
    await database.execAsync(`ALTER TABLE invoices ADD COLUMN style TEXT DEFAULT 'classic'`);
  } catch {
    // Column already exists — ignore
  }

  // Migration: create venues table if missing (existing installs)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      venue_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
  `);

  // Seed default settings if not exists
  const existing = await database.getFirstAsync(
    'SELECT id FROM settings WHERE id = ?', ['default']
  );
  if (!existing) {
    await database.runAsync('INSERT INTO settings (id) VALUES (?)', ['default']);
  }

  // Seed default band members if empty
  const memberCount = await database.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM band_members'
  );
  if (!memberCount || memberCount.c === 0) {
    await seedBandMembers(database);
  }

  // Seed clients from existing invoices if empty
  const clientCount = await database.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM clients'
  );
  if (!clientCount || clientCount.c === 0) {
    await seedClients(database);
  }

  // Seed venues if empty
  const venueCount = await database.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM venues'
  );
  if (!venueCount || venueCount.c === 0) {
    await seedVenues(database);
  }
}

async function seedClients(database: SQLite.SQLiteDatabase): Promise<void> {
  const clients = [
    {
      id: 'client_gin_juice',
      company_name: 'Gin & Juice',
      contact_name: '',
      address: 'Oyster Wharf, Mumbles Road, Mumbles, Swansea SA3 4DN',
      email: 'info@ginandjuice.co.uk',
      phone: '',
    },
    {
      id: 'client_youngs',
      company_name: "Young & Co's Brewery PLC",
      contact_name: '',
      address: 'Copper House, 5 Garratt Lane, Wandsworth, London SW18 4AQ',
      email: '',
      phone: '',
    },
    {
      id: 'client_north_star',
      company_name: 'North Star, Cardiff',
      contact_name: '',
      address: '',
      email: 'info@northstarcardiff.com',
      phone: '',
    },
    {
      id: 'client_suave',
      company_name: 'Suave Agency',
      contact_name: '',
      address: '',
      email: '',
      phone: '',
    },
    {
      id: 'client_event_uk',
      company_name: 'Event UK',
      contact_name: '',
      address: 'PO Box 512, Sutton, SM1 9QZ',
      email: 'info@eventuk.co.uk',
      phone: '0208 669 6849',
    },
    {
      id: 'client_andrew_norton',
      company_name: 'Andrew Norton',
      contact_name: 'Andrew Norton',
      address: '22 Maen Gilfach, Trelewis, Merthyr',
      email: 'cassettesinthesun@gmail.com',
      phone: '',
    },
  ];
  for (const c of clients) {
    await database.runAsync(
      'INSERT INTO clients (id, company_name, contact_name, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [c.id, c.company_name, c.contact_name, c.address, c.email, c.phone]
    );
  }
}

async function seedVenues(database: SQLite.SQLiteDatabase): Promise<void> {
  const venues = [
    { id: 'venue_1', client_id: 'client_gin_juice', venue_name: 'Gin & Juice, Mumbles' },
    { id: 'venue_2', client_id: 'client_youngs', venue_name: 'The Ship, Wandsworth' },
    { id: 'venue_3', client_id: 'client_youngs', venue_name: 'The Alma, Wandsworth' },
  ];
  for (const v of venues) {
    await database.runAsync(
      'INSERT INTO venues (id, client_id, venue_name) VALUES (?, ?, ?)',
      [v.id, v.client_id, v.venue_name]
    );
  }
}

async function seedBandMembers(database: SQLite.SQLiteDatabase): Promise<void> {
  const members = [
    { id: 'member_1', name: 'Nathan Thomas', sort_order: 1, is_self: 1 },
    { id: 'member_2', name: 'Member 2', sort_order: 2, is_self: 0 },
    { id: 'member_3', name: 'Member 3', sort_order: 3, is_self: 0 },
    { id: 'member_4', name: 'Member 4', sort_order: 4, is_self: 0 },
  ];
  for (const m of members) {
    await database.runAsync(
      'INSERT INTO band_members (id, name, sort_order, is_self) VALUES (?, ?, ?, ?)',
      [m.id, m.name, m.sort_order, m.is_self]
    );
  }
}
