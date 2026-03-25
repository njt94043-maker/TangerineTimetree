import { useState, useEffect, useRef } from 'react';
import {
  getInvoice, getUserSettings, getBandSettings,
  getReceiptsForInvoice,
} from '@shared/supabase/queries';
import type { InvoiceStyle } from '@shared/supabase/types';
import { getInvoiceHtml, getReceiptHtml } from '@shared/templates';
import type { InvoiceTemplateData, ReceiptTemplateData } from '@shared/templates';
import { formatDateLong } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';

interface InvoicePreviewProps {
  invoiceId: string;
  onClose: () => void;
}

export function InvoicePreview({ invoiceId, onClose }: InvoicePreviewProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [inv, us, bs, receipts] = await Promise.all([
          getInvoice(invoiceId),
          getUserSettings(),
          getBandSettings(),
          getReceiptsForInvoice(invoiceId),
        ]);

        if (!inv || !us || !bs) return;

        const style = (inv.style || 'classic') as InvoiceStyle;

        const invoiceData: InvoiceTemplateData = {
          invoiceNumber: inv.invoice_number,
          issueDate: formatDateLong(inv.issue_date),
          dueDate: formatDateLong(inv.due_date),
          fromName: us.your_name,
          tradingAs: bs.trading_as,
          businessType: bs.business_type,
          website: bs.website,
          toCompany: inv.client_company_name || inv.venue_name || '',
          toContact: inv.client_contact_name || inv.venue_contact_name || '',
          toAddress: inv.client_address || inv.venue_address || '',
          description: inv.description,
          amount: inv.amount,
          bankAccountName: us.bank_account_name,
          bankName: us.bank_name,
          bankSortCode: us.bank_sort_code,
          bankAccountNumber: us.bank_account_number,
          paymentTermsDays: bs.payment_terms_days,
        };

        const htmlPages = [getInvoiceHtml(style, invoiceData)];

        // Add receipt pages
        for (const r of receipts) {
          const receiptData: ReceiptTemplateData = {
            receiptDate: formatDateLong(r.date),
            paidTo: r.member_name,
            paidBy: inv.client_company_name || inv.venue_name || '',
            amount: r.amount,
            venue: inv.venue,
            gigDate: formatDateLong(inv.gig_date),
            invoiceNumber: inv.invoice_number,
            description: inv.description,
            website: bs.website,
          };
          htmlPages.push(getReceiptHtml(style, receiptData));
        }

        setPages(htmlPages);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invoiceId]);

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
          {pages.map((_, i) => (
            <button
              key={i}
              className={`preview-page-btn ${i === currentPage ? 'active' : ''}`}
              onClick={() => setCurrentPage(i)}
            >
              {i === 0 ? 'Invoice' : `Receipt ${i}`}
            </button>
          ))}
        </div>
      )}

      <iframe
        ref={iframeRef}
        className="invoice-iframe invoice-iframe-full"
        srcDoc={pages[currentPage] || ''}
        title={currentPage === 0 ? 'Invoice' : `Receipt ${currentPage}`}
        sandbox="allow-same-origin allow-modals allow-scripts"
      />
    </div>
  );
}
