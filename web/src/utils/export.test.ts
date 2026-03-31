import { describe, it, expect } from 'vitest';
import { filterByTaxYear } from './export';
import type { InvoiceWithClient } from '@shared/supabase/types';

// Minimal stub — only fields filterByTaxYear touches
function makeInvoice(gig_date: string): InvoiceWithClient {
  return { gig_date } as InvoiceWithClient;
}

describe('filterByTaxYear', () => {
  const invoices = [
    makeInvoice('2025-03-15'), // before 2025/26 tax year
    makeInvoice('2025-04-01'), // first day of 2025/26
    makeInvoice('2025-07-20'), // mid 2025/26
    makeInvoice('2025-12-25'), // Christmas 2025
    makeInvoice('2026-03-31'), // last day of 2025/26
    makeInvoice('2026-04-01'), // first day of 2026/27
  ];

  it('includes invoices within the tax year', () => {
    const result = filterByTaxYear(invoices, 2025);
    expect(result).toHaveLength(4);
    expect(result.map(i => i.gig_date)).toEqual([
      '2025-04-01', '2025-07-20', '2025-12-25', '2026-03-31',
    ]);
  });

  it('excludes invoices before the tax year', () => {
    const result = filterByTaxYear(invoices, 2025);
    expect(result.find(i => i.gig_date === '2025-03-15')).toBeUndefined();
  });

  it('excludes invoices after the tax year', () => {
    const result = filterByTaxYear(invoices, 2025);
    expect(result.find(i => i.gig_date === '2026-04-01')).toBeUndefined();
  });

  it('returns empty for a year with no invoices', () => {
    const result = filterByTaxYear(invoices, 2023);
    expect(result).toHaveLength(0);
  });

  it('includes boundary dates (April 1 start, March 31 end)', () => {
    const result = filterByTaxYear(invoices, 2025);
    expect(result.map(i => i.gig_date)).toContain('2025-04-01');
    expect(result.map(i => i.gig_date)).toContain('2026-03-31');
  });
});
