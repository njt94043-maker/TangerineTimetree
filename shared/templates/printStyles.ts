/**
 * Shared print CSS for all PDF templates (invoice, receipt, quote, formal invoice).
 * Ensures correct A4 rendering, background preservation, and single-page fit.
 */
export const PRINT_CSS = `
  @page {
    size: A4;
    margin: 0;
  }
  @media print {
    html, body {
      height: auto !important;
      width: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page {
      min-height: auto !important;
      height: auto !important;
      overflow: visible !important;
      page-break-inside: avoid;
    }
    /* Compact spacing to fit A4 single page */
    .content {
      padding: 28px 36px !important;
    }
    .separator {
      margin: 14px 0 !important;
    }
    .info-grid {
      margin-bottom: 24px !important;
    }
    .items-table {
      margin-bottom: 18px !important;
    }
    .payment-box, .payment {
      margin-bottom: 16px !important;
      padding: 14px 16px !important;
    }
    .header {
      padding: 20px 36px !important;
    }
    .meta {
      padding: 14px 36px !important;
    }
    .parties {
      padding: 14px 36px !important;
    }
    .footer {
      padding: 12px 36px !important;
    }
    /* Hide decorative overlays that don't print well */
    .scanlines, .grain, .ember-glow, .linen,
    .radial-glow, .gold-shimmer, .snowfall {
      display: none !important;
    }
  }
`;
