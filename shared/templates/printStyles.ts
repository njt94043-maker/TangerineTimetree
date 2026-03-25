/**
 * Shared print CSS for all PDF templates (invoice, receipt, quote, formal invoice).
 * Ensures correct A4 rendering, background preservation, and single-page fit.
 */
export const PRINT_CSS = `
  @page {
    size: A4;
    margin: 12mm;
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
    /* Hide decorative overlays that don't print well */
    .scanlines, .grain, .ember-glow, .linen,
    .radial-glow, .gold-shimmer, .snowfall {
      display: none !important;
    }
  }
`;
