// Shared PDF templates — used by both native (GigBooks) and web (Tangerine Timetree)

// Template routers
export { getInvoiceHtml } from './getInvoiceTemplate';
export { getReceiptHtml } from './getReceiptTemplate';
export { getQuoteHtml } from './getQuoteHtml';
export { getFormalInvoiceHtml } from './getFormalInvoiceHtml';

// Data interfaces
export type { InvoiceTemplateData } from './invoiceTemplate';
export type { ReceiptTemplateData } from './receiptTemplate';
export type { QuoteTemplateData } from './quoteTemplate';
export type { FormalInvoiceTemplateData } from './formalInvoiceTemplate';

// Style metadata
export { INVOICE_STYLES, DEFAULT_INVOICE_STYLE } from './invoiceStyles';
export type { InvoiceStyleMeta } from './invoiceStyles';

// Colors (for consumers that need PDF color palette)
export { PDF_COLORS } from './colors';
