-- ============================================================
-- Sprint S15: Quoting & Formal Invoicing Schema
-- Tables: service_catalogue, quotes, quote_line_items,
--         formal_invoices, formal_invoice_line_items, formal_receipts
-- Alters: band_settings (PLI + T&C + quote fields)
-- RPC: next_quote_number (atomic increment)
-- ============================================================

-- 1. Service Catalogue
CREATE TABLE service_catalogue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  default_price NUMERIC(10,2) NOT NULL,
  unit_label TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_catalogue_sort ON service_catalogue(sort_order);

-- 2. Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  event_type TEXT NOT NULL DEFAULT 'other'
    CHECK (event_type IN ('wedding', 'corporate', 'private', 'festival', 'other')),
  event_date DATE NOT NULL,
  venue_name TEXT NOT NULL,
  venue_address TEXT DEFAULT '',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  pli_option TEXT NOT NULL DEFAULT 'none'
    CHECK (pli_option IN ('certificate', 'details', 'none')),
  terms_and_conditions TEXT DEFAULT '',
  validity_days INTEGER DEFAULT 30,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),
  style TEXT NOT NULL DEFAULT 'classic',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_event_date ON quotes(event_date);
CREATE INDEX idx_quotes_created_by ON quotes(created_by);

-- Auto-update updated_at on quotes
CREATE TRIGGER on_quote_updated
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_gig_timestamp();

-- 3. Quote Line Items
CREATE TABLE quote_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  service_id UUID REFERENCES service_catalogue(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(10,2) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_quote_line_items_quote ON quote_line_items(quote_id);

-- 4. Formal Invoices
CREATE TABLE formal_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  quote_id UUID NOT NULL REFERENCES quotes(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  venue_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid')),
  paid_date DATE,
  notes TEXT DEFAULT '',
  style TEXT NOT NULL DEFAULT 'classic',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_formal_invoices_quote ON formal_invoices(quote_id);
CREATE INDEX idx_formal_invoices_client ON formal_invoices(client_id);
CREATE INDEX idx_formal_invoices_status ON formal_invoices(status);

-- Auto-update updated_at on formal_invoices
CREATE TRIGGER on_formal_invoice_updated
  BEFORE UPDATE ON formal_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_gig_timestamp();

-- 5. Formal Invoice Line Items
CREATE TABLE formal_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES formal_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(10,2) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_formal_invoice_line_items_invoice ON formal_invoice_line_items(invoice_id);

-- 6. Formal Receipts
CREATE TABLE formal_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES formal_invoices(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_formal_receipts_invoice ON formal_receipts(invoice_id);
CREATE INDEX idx_formal_receipts_member ON formal_receipts(member_id);

-- ============================================================
-- Alter band_settings: add PLI + T&C + quote fields
-- ============================================================

ALTER TABLE band_settings
  ADD COLUMN IF NOT EXISTS pli_insurer TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pli_policy_number TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pli_cover_amount TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pli_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS default_terms_and_conditions TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_quote_validity_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS next_quote_number INTEGER DEFAULT 1;

-- ============================================================
-- RPC: Atomic quote number increment
-- ============================================================

CREATE OR REPLACE FUNCTION next_quote_number()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_num INT;
BEGIN
  UPDATE band_settings
  SET next_quote_number = next_quote_number + 1,
      updated_at = NOW()
  WHERE id = 'default'
  RETURNING next_quote_number - 1 INTO current_num;

  RETURN current_num;
END;
$$;

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE service_catalogue ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE formal_receipts ENABLE ROW LEVEL SECURITY;

-- Service Catalogue: all band members can CRUD
CREATE POLICY "service_catalogue_select" ON service_catalogue
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_catalogue_insert" ON service_catalogue
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "service_catalogue_update" ON service_catalogue
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service_catalogue_delete" ON service_catalogue
  FOR DELETE TO authenticated USING (true);

-- Quotes: all band members can CRUD
CREATE POLICY "quotes_select" ON quotes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "quotes_insert" ON quotes
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "quotes_update" ON quotes
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "quotes_delete" ON quotes
  FOR DELETE TO authenticated USING (true);

-- Quote Line Items: all band members can CRUD (cascade from quote)
CREATE POLICY "quote_line_items_select" ON quote_line_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "quote_line_items_insert" ON quote_line_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "quote_line_items_update" ON quote_line_items
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "quote_line_items_delete" ON quote_line_items
  FOR DELETE TO authenticated USING (true);

-- Formal Invoices: all band members can CRUD
CREATE POLICY "formal_invoices_select" ON formal_invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "formal_invoices_insert" ON formal_invoices
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "formal_invoices_update" ON formal_invoices
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "formal_invoices_delete" ON formal_invoices
  FOR DELETE TO authenticated USING (true);

-- Formal Invoice Line Items: all band members can CRUD
CREATE POLICY "formal_invoice_line_items_select" ON formal_invoice_line_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "formal_invoice_line_items_insert" ON formal_invoice_line_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "formal_invoice_line_items_update" ON formal_invoice_line_items
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "formal_invoice_line_items_delete" ON formal_invoice_line_items
  FOR DELETE TO authenticated USING (true);

-- Formal Receipts: all band members can read/insert/delete
CREATE POLICY "formal_receipts_select" ON formal_receipts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "formal_receipts_insert" ON formal_receipts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "formal_receipts_delete" ON formal_receipts
  FOR DELETE TO authenticated USING (true);
