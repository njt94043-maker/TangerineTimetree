import { useState, useEffect, useRef } from 'react';
import {
  getQuote, getQuoteLineItems, getUserSettings, getBandSettings,
  getFormalInvoiceByQuote, getFormalInvoiceLineItems, getFormalReceipts,
} from '@shared/supabase/queries';
import type { InvoiceStyle } from '@shared/supabase/types';
import { getQuoteHtml, getFormalInvoiceHtml, getReceiptHtml } from '@shared/templates';
import type { QuoteTemplateData, FormalInvoiceTemplateData, ReceiptTemplateData } from '@shared/templates';
import { formatDateLong, addDaysISO } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';

interface QuotePreviewProps {
  quoteId: string;
  onClose: () => void;
}

interface PageInfo {
  label: string;
  html: string;
}

export function QuotePreview({ quoteId, onClose }: QuotePreviewProps) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [quote, lineItems, us, bs] = await Promise.all([
          getQuote(quoteId),
          getQuoteLineItems(quoteId),
          getUserSettings(),
          getBandSettings(),
        ]);

        if (!quote || !us || !bs) return;

        const style = (quote.style || 'classic') as InvoiceStyle;
        const validUntil = addDaysISO(quote.created_at.slice(0, 10), quote.validity_days);

        const quoteData: QuoteTemplateData = {
          quoteNumber: quote.quote_number,
          quoteDate: formatDateLong(quote.created_at.slice(0, 10)),
          validUntil: formatDateLong(validUntil),
          fromName: us.your_name,
          tradingAs: bs.trading_as,
          businessType: bs.business_type,
          website: bs.website,
          toCompany: quote.client_company_name,
          toContact: quote.client_contact_name,
          toAddress: quote.client_address,
          toEmail: quote.client_email,
          toPhone: quote.client_phone,
          eventType: quote.event_type.charAt(0).toUpperCase() + quote.event_type.slice(1),
          eventDate: formatDateLong(quote.event_date),
          venueName: quote.venue_name,
          venueAddress: quote.venue_address,
          lineItems: lineItems.map(li => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unit_price,
            lineTotal: li.line_total,
          })),
          subtotal: quote.subtotal,
          discountAmount: quote.discount_amount,
          total: quote.total,
          pliOption: quote.pli_option,
          pliInsurer: bs.pli_insurer ?? '',
          pliPolicyNumber: bs.pli_policy_number ?? '',
          pliCoverAmount: bs.pli_cover_amount ?? '',
          pliExpiryDate: bs.pli_expiry_date ? formatDateLong(bs.pli_expiry_date) : '',
          termsAndConditions: quote.terms_and_conditions,
          validityDays: quote.validity_days,
          notes: quote.notes,
        };

        const htmlPages: PageInfo[] = [
          { label: 'Quote', html: getQuoteHtml(style, quoteData) },
        ];

        // Add formal invoice page if quote is accepted
        if (quote.status === 'accepted') {
          const fi = await getFormalInvoiceByQuote(quoteId);
          if (fi) {
            const fiItems = await getFormalInvoiceLineItems(fi.id);

            const formalData: FormalInvoiceTemplateData = {
              invoiceNumber: fi.invoice_number,
              issueDate: formatDateLong(fi.issue_date),
              dueDate: formatDateLong(fi.due_date),
              fromName: us.your_name,
              tradingAs: bs.trading_as,
              businessType: bs.business_type,
              website: bs.website,
              toCompany: fi.client_company_name,
              toContact: fi.client_contact_name,
              toAddress: fi.client_address,
              venueName: fi.venue_name,
              eventDate: formatDateLong(fi.event_date),
              lineItems: fiItems.map(li => ({
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unit_price,
                lineTotal: li.line_total,
              })),
              subtotal: fi.subtotal,
              discountAmount: fi.discount_amount,
              total: fi.total,
              bankAccountName: us.bank_account_name,
              bankName: us.bank_name,
              bankSortCode: us.bank_sort_code,
              bankAccountNumber: us.bank_account_number,
              paymentTermsDays: bs.payment_terms_days,
              notes: fi.notes,
            };

            htmlPages.push({ label: 'Invoice', html: getFormalInvoiceHtml(style, formalData) });

            // Add receipt pages if paid
            if (fi.status === 'paid') {
              const receipts = await getFormalReceipts(fi.id);
              for (const r of receipts) {
                const receiptData: ReceiptTemplateData = {
                  receiptDate: formatDateLong(r.date),
                  paidTo: r.member_name,
                  paidBy: fi.client_company_name,
                  amount: r.amount,
                  venue: fi.venue_name,
                  gigDate: formatDateLong(fi.event_date),
                  invoiceNumber: fi.invoice_number,
                  description: `Payment for ${quote.event_type} event`,
                  website: bs.website,
                };
                htmlPages.push({ label: `Receipt — ${r.member_name}`, html: getReceiptHtml(style, receiptData) });
              }
            }
          }
        }

        setPages(htmlPages);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [quoteId]);

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
  }

  if (loading) return <div className="app app-centered"><LoadingSpinner /></div>;

  return (
    <div className="form-wrap form-top invoice-preview-wrap">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">Preview</h2>
        <button className="btn btn-small btn-tangerine" onClick={handlePrint}>Print</button>
      </div>

      {pages.length > 1 && (
        <div className="preview-page-nav">
          {pages.map((p, i) => (
            <button
              key={i}
              className={`preview-page-btn ${i === currentPage ? 'active' : ''}`}
              onClick={() => setCurrentPage(i)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <iframe
        ref={iframeRef}
        className="invoice-iframe invoice-iframe-full"
        srcDoc={pages[currentPage]?.html || ''}
        title={pages[currentPage]?.label || 'Preview'}
        sandbox="allow-same-origin allow-modals allow-scripts"
      />
    </div>
  );
}
