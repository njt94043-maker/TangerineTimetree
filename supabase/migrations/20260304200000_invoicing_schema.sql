-- ============================================================
-- Sprint S10: Invoicing Schema
-- Tables: clients, venues, invoices, receipts, user_settings, band_settings
-- RPC: next_invoice_number (atomic increment)
-- ============================================================

-- Drop stale tables from earlier manual creation (reverse FK order)
DROP TABLE IF EXISTS receipts CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS band_settings CASCADE;

-- 1. Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  address TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_company ON clients(company_name);
CREATE INDEX idx_clients_created_by ON clients(created_by);

-- 2. Venues
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  venue_name TEXT NOT NULL,
  address TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_venues_client ON venues(client_id);

-- 3. Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id),
  venue TEXT NOT NULL DEFAULT '',
  gig_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  paid_date DATE,
  style TEXT NOT NULL DEFAULT 'classic',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_gig_date ON invoices(gig_date);
CREATE INDEX idx_invoices_created_by ON invoices(created_by);

-- Auto-update updated_at on invoices
CREATE TRIGGER on_invoice_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_gig_timestamp();

-- 4. Receipts
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receipts_invoice ON receipts(invoice_id);
CREATE INDEX idx_receipts_member ON receipts(member_id);

-- 5. User Settings (per-user: name, banking, etc.)
CREATE TABLE user_settings (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  your_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  bank_account_name TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  bank_sort_code TEXT DEFAULT '',
  bank_account_number TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Band Settings (single row: shared band config)
CREATE TABLE band_settings (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  trading_as TEXT DEFAULT 'The Green Tangerine',
  business_type TEXT DEFAULT 'Live Music Entertainment',
  website TEXT DEFAULT 'www.thegreentangerine.com',
  payment_terms_days INT DEFAULT 14,
  next_invoice_number INT DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default band_settings row
INSERT INTO band_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RPC: Atomic invoice number increment
-- Returns the current number and increments it in one step.
-- ============================================================

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_num INT;
BEGIN
  UPDATE band_settings
  SET next_invoice_number = next_invoice_number + 1,
      updated_at = NOW()
  WHERE id = 'default'
  RETURNING next_invoice_number - 1 INTO current_num;

  RETURN current_num;
END;
$$;

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_settings ENABLE ROW LEVEL SECURITY;

-- Clients: all band members can read, create, update, delete
CREATE POLICY "clients_select" ON clients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert" ON clients
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "clients_update" ON clients
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "clients_delete" ON clients
  FOR DELETE TO authenticated USING (true);

-- Venues: all band members can CRUD
CREATE POLICY "venues_select" ON venues
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "venues_insert" ON venues
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "venues_update" ON venues
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "venues_delete" ON venues
  FOR DELETE TO authenticated USING (true);

-- Invoices: all band members can CRUD
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE TO authenticated USING (true);

-- Receipts: all band members can read, insert, delete (via invoice owner)
CREATE POLICY "receipts_select" ON receipts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "receipts_insert" ON receipts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "receipts_delete" ON receipts
  FOR DELETE TO authenticated USING (true);

-- User Settings: own row only
CREATE POLICY "user_settings_select" ON user_settings
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "user_settings_insert" ON user_settings
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "user_settings_update" ON user_settings
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Band Settings: all band members can read, only admin can update
CREATE POLICY "band_settings_select" ON band_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "band_settings_update" ON band_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
