-- S24A: Bill-to flexibility — venue OR client billing
-- Decisions: D-078 (venue OR client billing), D-079 (venue contact fields),
--            D-081 (resolveBillTo), D-082 (gig_id FK on invoices)

-- 1. Add contact fields to venues so they can be invoiced directly
ALTER TABLE venues ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_name TEXT DEFAULT '';

-- 2. Make client_id nullable on invoices, quotes, formal_invoices
ALTER TABLE invoices ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE quotes ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE formal_invoices ALTER COLUMN client_id DROP NOT NULL;

-- 3. Add gig_id FK on invoices (link gig to its invoice)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gig_id UUID REFERENCES gigs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_gig_id ON invoices(gig_id);

-- 4. CHECK constraints: at least one of client_id or venue_id must be set
ALTER TABLE invoices ADD CONSTRAINT chk_invoices_bill_to
  CHECK (client_id IS NOT NULL OR venue_id IS NOT NULL);

ALTER TABLE quotes ADD CONSTRAINT chk_quotes_bill_to
  CHECK (client_id IS NOT NULL OR venue_id IS NOT NULL);

ALTER TABLE formal_invoices ADD CONSTRAINT chk_formal_invoices_bill_to
  CHECK (client_id IS NOT NULL OR venue_id IS NOT NULL);
