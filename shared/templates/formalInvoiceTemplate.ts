import { PDF_COLORS } from './colors';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';
import { PRINT_CSS } from './printStyles';

export interface FormalInvoiceTemplateData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  fromName: string;
  tradingAs: string;
  businessType: string;
  website: string;
  toCompany: string;
  toContact: string;
  toAddress: string;
  venueName: string;
  eventDate: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number }>;
  subtotal: number;
  discountAmount: number;
  total: number;
  bankAccountName: string;
  bankName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  paymentTermsDays: number;
  notes: string;
}

export function generateFormalInvoiceHtml(data: FormalInvoiceTemplateData): string {
  const addressHtml = htmlEscape(data.toAddress).replace(/\n/g, '<br>');
  const e = {
    fromName: htmlEscape(data.fromName),
    tradingAs: htmlEscape(data.tradingAs),
    businessType: htmlEscape(data.businessType),
    website: htmlEscape(data.website),
    toCompany: htmlEscape(data.toCompany),
    toContact: htmlEscape(data.toContact),
    venueName: htmlEscape(data.venueName),
    bankAccountName: htmlEscape(data.bankAccountName),
    bankName: htmlEscape(data.bankName),
    bankSortCode: htmlEscape(data.bankSortCode),
    bankAccountNumber: htmlEscape(data.bankAccountNumber),
    notes: htmlEscape(data.notes),
  };

  const fmt = (n: number) => `\u00a3${n.toFixed(2)}`;

  const lineItemsHtml = data.lineItems.map(item => `
    <div class="table-row">
      <div class="col-desc">${htmlEscape(item.description)}</div>
      <div class="col-qty">${item.quantity}</div>
      <div class="col-price">${fmt(item.unitPrice)}</div>
      <div class="col-total">${fmt(item.lineTotal)}</div>
    </div>`).join('');

  const discountHtml = data.discountAmount > 0 ? `
    <div class="summary-row">
      <span class="summary-label">Discount:</span>
      <span class="summary-value">&minus;${fmt(data.discountAmount)}</span>
    </div>` : '';

  const notesHtml = data.notes ? `
  <div class="notes">
    <h3>Notes</h3>
    <p>${e.notes.replace(/\n/g, '<br>')}</p>
  </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${data.invoiceNumber} — The Green Tangerine</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: ${PDF_COLORS.bodyText}; font-size: 14px; line-height: 1.5; overflow-x: hidden; width: 100%; }
  .page { min-height: 100%; display: flex; flex-direction: column; }
  .header { background: ${PDF_COLORS.headerBg}; color: ${PDF_COLORS.headerText}; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 36px; font-weight: bold; letter-spacing: 4px; }
  .header .logo { width: 90px; height: 90px; }
  .meta { padding: 20px 40px; }
  .meta-row { margin-bottom: 3px; font-size: 13px; }
  .meta-label { color: ${PDF_COLORS.labelText}; }
  .accent-rule { height: 3px; background: ${PDF_COLORS.accentRule}; margin: 0 40px; }
  .parties { display: flex; padding: 20px 40px; gap: 40px; }
  .party { flex: 1; }
  .party-label { color: ${PDF_COLORS.headerBg}; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .party-name { font-weight: bold; font-size: 16px; margin-bottom: 2px; }
  .party-detail { font-size: 13px; color: ${PDF_COLORS.labelText}; line-height: 1.4; }
  .party-detail a { color: ${PDF_COLORS.headerBg}; text-decoration: none; }
  .event-section { padding: 12px 40px 16px; }
  .event-label { color: ${PDF_COLORS.headerBg}; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .event-row { font-size: 13px; margin-bottom: 3px; }
  .event-field-label { color: ${PDF_COLORS.labelText}; }
  .table-section { margin-top: 10px; }
  .table-header { background: ${PDF_COLORS.tableHeaderBg}; color: ${PDF_COLORS.tableHeaderText}; display: flex; padding: 10px 40px; font-weight: bold; font-size: 13px; border-radius: 4px 4px 0 0; margin: 0 40px; }
  .table-row { display: flex; padding: 12px 40px; margin: 0 40px; border-bottom: 1px solid #eee; }
  .col-desc { flex: 3; font-size: 14px; }
  .col-qty { flex: 0.7; text-align: center; font-size: 14px; }
  .col-price { flex: 1; text-align: right; font-size: 14px; }
  .col-total { flex: 1; text-align: right; font-size: 14px; }
  .accent-rule-table { height: 2px; background: ${PDF_COLORS.accentRule}; margin: 0 40px; }
  .summary-section { display: flex; justify-content: flex-end; margin: 0 40px; padding-top: 8px; }
  .summary-block { min-width: 280px; }
  .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
  .summary-label { color: ${PDF_COLORS.labelText}; }
  .summary-value { font-weight: bold; }
  .total-bar { background: ${PDF_COLORS.totalBarBg}; color: ${PDF_COLORS.totalBarText}; display: flex; justify-content: space-between; padding: 12px 20px; font-weight: bold; font-size: 18px; border-radius: 4px; margin-top: 6px; }
  .notes { padding: 16px 40px; }
  .notes h3 { font-size: 13px; font-weight: bold; color: ${PDF_COLORS.headerBg}; margin-bottom: 6px; }
  .notes p { font-size: 13px; color: ${PDF_COLORS.labelText}; line-height: 1.5; }
  .payment { padding: 20px 40px; }
  .payment h3 { font-size: 13px; font-weight: bold; color: ${PDF_COLORS.headerBg}; margin-bottom: 8px; }
  .payment-row { font-size: 13px; margin-bottom: 3px; }
  .payment-label { color: ${PDF_COLORS.labelText}; }
  .spacer { flex: 1; }
  .footer { background: ${PDF_COLORS.footerBg}; color: ${PDF_COLORS.footerText}; padding: 20px 40px; text-align: center; font-size: 12px; }
  .footer .website { font-weight: bold; font-size: 13px; margin-bottom: 4px; }
  .footer .terms-label { color: ${PDF_COLORS.totalBarBg}; font-weight: bold; }
  .footer .thanks { color: ${PDF_COLORS.totalBarBg}; font-style: italic; margin-top: 2px; }
  .payment-value-mono { font-family: 'JetBrains Mono', monospace; letter-spacing: 1px; }
  ${PRINT_CSS}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>INVOICE</h1>
    <div class="logo">${TGT_LOGO_SVG}</div>
  </div>

  <div class="meta">
    <div class="meta-row"><span class="meta-label">Invoice Number: </span><strong>${data.invoiceNumber}</strong></div>
    <div class="meta-row"><span class="meta-label">Issue Date: </span>${data.issueDate}</div>
    <div class="meta-row"><span class="meta-label">Due Date: </span>${data.dueDate}</div>
  </div>

  <div class="accent-rule"></div>

  <div class="parties">
    <div class="party">
      <div class="party-label">From:</div>
      <div class="party-name">${e.fromName}</div>
      <div class="party-detail">Trading as: ${e.tradingAs}</div>
      <div class="party-detail">${e.businessType}</div>
      <div class="party-detail"><a href="https://${e.website}">${e.website}</a></div>
    </div>
    <div class="party">
      <div class="party-label">To:</div>
      <div class="party-name">${e.toCompany}</div>
      ${data.toContact ? `<div class="party-detail">${e.toContact}</div>` : ''}
      <div class="party-detail">${addressHtml}</div>
    </div>
  </div>

  <div class="event-section">
    <div class="event-label">Event Details</div>
    <div class="event-row"><span class="event-field-label">Venue: </span><strong>${e.venueName}</strong></div>
    <div class="event-row"><span class="event-field-label">Event Date: </span>${data.eventDate}</div>
  </div>

  <div class="table-section">
    <div class="table-header">
      <div class="col-desc">Description</div>
      <div class="col-qty">Qty</div>
      <div class="col-price">Unit Price</div>
      <div class="col-total">Total</div>
    </div>
    ${lineItemsHtml}
  </div>

  <div class="accent-rule-table"></div>

  <div class="summary-section">
    <div class="summary-block">
      <div class="summary-row">
        <span class="summary-label">Subtotal:</span>
        <span class="summary-value">${fmt(data.subtotal)}</span>
      </div>
      ${discountHtml}
      <div class="total-bar">
        <span>TOTAL:</span>
        <span>${fmt(data.total)}</span>
      </div>
    </div>
  </div>

  ${notesHtml}

  <div class="payment">
    <h3>Payment Details:</h3>
    <div class="payment-row"><span class="payment-label">Account Name: </span>${e.bankAccountName}</div>
    <div class="payment-row"><span class="payment-label">Bank: </span>${e.bankName}</div>
    <div class="payment-row"><span class="payment-label">Sort Code: </span><span class="payment-value-mono">${e.bankSortCode}</span></div>
    <div class="payment-row"><span class="payment-label">Account Number: </span><span class="payment-value-mono">${e.bankAccountNumber}</span></div>
  </div>

  <div class="spacer"></div>

  <div class="footer">
    <div class="website">${e.website}</div>
    <div class="terms-label">Payment Terms:</div>
    <div>Please pay within ${data.paymentTermsDays} days of invoice date</div>
    <div class="thanks">Thank you for your business!</div>
  </div>
</div>
</body>
</html>`;
}
