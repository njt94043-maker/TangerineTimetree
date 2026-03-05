import { PDF_COLORS } from './colors';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';

export interface QuoteTemplateData {
  quoteNumber: string;
  quoteDate: string;
  validUntil: string;
  fromName: string;
  tradingAs: string;
  businessType: string;
  website: string;
  toCompany: string;
  toContact: string;
  toAddress: string;
  toEmail: string;
  toPhone: string;
  eventType: string;
  eventDate: string;
  venueName: string;
  venueAddress: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discountAmount: number;
  total: number;
  pliOption: 'certificate' | 'details' | 'none';
  pliInsurer: string;
  pliPolicyNumber: string;
  pliCoverAmount: string;
  pliExpiryDate: string;
  termsAndConditions: string;
  validityDays: number;
  notes: string;
}

export function generateQuoteHtml(data: QuoteTemplateData): string {
  const addressHtml = htmlEscape(data.toAddress).replace(/\n/g, '<br>');
  const venueAddressHtml = htmlEscape(data.venueAddress).replace(/\n/g, '<br>');
  const termsHtml = htmlEscape(data.termsAndConditions).replace(/\n/g, '<br>');
  const notesHtml = data.notes ? htmlEscape(data.notes).replace(/\n/g, '<br>') : '';

  const e = {
    quoteNumber: htmlEscape(data.quoteNumber),
    fromName: htmlEscape(data.fromName),
    tradingAs: htmlEscape(data.tradingAs),
    businessType: htmlEscape(data.businessType),
    website: htmlEscape(data.website),
    toCompany: htmlEscape(data.toCompany),
    toContact: htmlEscape(data.toContact),
    toEmail: htmlEscape(data.toEmail),
    toPhone: htmlEscape(data.toPhone),
    eventType: htmlEscape(data.eventType),
    eventDate: htmlEscape(data.eventDate),
    venueName: htmlEscape(data.venueName),
    pliInsurer: htmlEscape(data.pliInsurer),
    pliPolicyNumber: htmlEscape(data.pliPolicyNumber),
    pliCoverAmount: htmlEscape(data.pliCoverAmount),
    pliExpiryDate: htmlEscape(data.pliExpiryDate),
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
      <div class="summary-label">Discount</div>
      <div class="summary-value">-${fmt(data.discountAmount)}</div>
    </div>` : '';

  const pliHtml = data.pliOption === 'details' ? `
  <div class="pli-section">
    <div class="section-title">Public Liability Insurance</div>
    <div class="pli-grid">
      <div class="pli-item">
        <div class="pli-label">Insurer</div>
        <div class="pli-value">${e.pliInsurer}</div>
      </div>
      <div class="pli-item">
        <div class="pli-label">Policy Number</div>
        <div class="pli-value">${e.pliPolicyNumber}</div>
      </div>
      <div class="pli-item">
        <div class="pli-label">Cover Amount</div>
        <div class="pli-value">${e.pliCoverAmount}</div>
      </div>
      <div class="pli-item">
        <div class="pli-label">Expiry Date</div>
        <div class="pli-value">${e.pliExpiryDate}</div>
      </div>
    </div>
  </div>` : data.pliOption === 'certificate' ? `
  <div class="pli-section">
    <div class="section-title">Public Liability Insurance</div>
    <div class="pli-note">A copy of our PLI certificate is available upon request.</div>
  </div>` : '';

  const notesSection = data.notes ? `
  <div class="notes-section">
    <div class="section-title">Notes</div>
    <div class="notes-text">${notesHtml}</div>
  </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: ${PDF_COLORS.bodyText}; font-size: 14px; line-height: 1.5; overflow-x: hidden; width: 100%; }
  .page { min-height: 100vh; display: flex; flex-direction: column; }
  .header { background: ${PDF_COLORS.headerBg}; color: ${PDF_COLORS.headerText}; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 36px; font-weight: bold; letter-spacing: 4px; }
  .header .logo { width: 90px; height: 90px; }
  .meta { padding: 20px 40px; }
  .meta-row { margin-bottom: 3px; font-size: 13px; }
  .meta-label { color: ${PDF_COLORS.labelText}; }
  .orange-rule { height: 3px; background: ${PDF_COLORS.accentRule}; margin: 0 40px; }
  .parties { display: flex; padding: 20px 40px; gap: 40px; }
  .party { flex: 1; }
  .party-label { color: ${PDF_COLORS.headerBg}; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .party-name { font-weight: bold; font-size: 16px; margin-bottom: 2px; }
  .party-detail { font-size: 13px; color: ${PDF_COLORS.labelText}; line-height: 1.4; }
  .party-detail a { color: ${PDF_COLORS.headerBg}; text-decoration: none; }
  .event-section { padding: 16px 40px; background: #f9f9f9; margin: 0 40px; border-radius: 4px; margin-bottom: 16px; }
  .event-title { color: ${PDF_COLORS.headerBg}; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .event-grid { display: flex; gap: 32px; font-size: 13px; }
  .event-item-label { color: ${PDF_COLORS.labelText}; font-size: 11px; margin-bottom: 2px; }
  .event-item-value { font-weight: 600; }
  .table-section { margin-top: 12px; }
  .table-header { background: ${PDF_COLORS.tableHeaderBg}; color: ${PDF_COLORS.tableHeaderText}; display: flex; padding: 10px 40px; font-weight: bold; font-size: 13px; border-radius: 4px 4px 0 0; margin: 0 40px; }
  .table-header .col-desc { flex: 3; }
  .table-header .col-qty { flex: 0.7; text-align: center; }
  .table-header .col-price { flex: 1; text-align: right; }
  .table-header .col-total { flex: 1; text-align: right; }
  .table-row { display: flex; padding: 12px 40px; margin: 0 40px; border-bottom: 1px solid #eee; }
  .table-row .col-desc { flex: 3; font-size: 14px; }
  .table-row .col-qty { flex: 0.7; text-align: center; font-size: 14px; }
  .table-row .col-price { flex: 1; text-align: right; font-size: 14px; }
  .table-row .col-total { flex: 1; text-align: right; font-size: 14px; }
  .orange-rule-table { height: 2px; background: ${PDF_COLORS.accentRule}; margin: 0 40px; }
  .summary-section { display: flex; flex-direction: column; align-items: flex-end; padding: 0 40px; margin-top: 8px; }
  .summary-row { display: flex; justify-content: space-between; width: 260px; padding: 4px 0; font-size: 14px; }
  .summary-label { color: ${PDF_COLORS.labelText}; }
  .summary-value { font-weight: 600; }
  .total-bar { background: ${PDF_COLORS.totalBarBg}; color: ${PDF_COLORS.totalBarText}; display: flex; justify-content: space-between; padding: 12px 20px; font-weight: bold; font-size: 18px; border-radius: 4px; width: 260px; margin-top: 4px; }
  .section-title { color: ${PDF_COLORS.headerBg}; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .pli-section { padding: 20px 40px; }
  .pli-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; font-size: 13px; }
  .pli-label { color: ${PDF_COLORS.labelText}; font-size: 11px; margin-bottom: 2px; }
  .pli-value { font-weight: 600; }
  .pli-note { font-size: 13px; color: ${PDF_COLORS.labelText}; font-style: italic; }
  .notes-section { padding: 16px 40px; }
  .notes-text { font-size: 13px; color: ${PDF_COLORS.bodyText}; background: #f9f9f9; border-left: 3px solid ${PDF_COLORS.accentRule}; padding: 12px 16px; border-radius: 0 4px 4px 0; }
  .terms-section { padding: 16px 40px; }
  .terms-text { font-size: 11px; color: ${PDF_COLORS.labelText}; line-height: 1.6; }
  .spacer { flex: 1; }
  .footer { background: ${PDF_COLORS.footerBg}; color: ${PDF_COLORS.footerText}; padding: 20px 40px; text-align: center; font-size: 12px; }
  .footer .website { font-weight: bold; font-size: 13px; margin-bottom: 4px; }
  .footer .validity { color: ${PDF_COLORS.totalBarBg}; font-weight: bold; }
  .footer .thanks { color: ${PDF_COLORS.totalBarBg}; font-style: italic; margin-top: 2px; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>QUOTE</h1>
    <div class="logo">${TGT_LOGO_SVG}</div>
  </div>

  <div class="meta">
    <div class="meta-row"><span class="meta-label">Quote Number: </span><strong>${e.quoteNumber}</strong></div>
    <div class="meta-row"><span class="meta-label">Date: </span>${data.quoteDate}</div>
    <div class="meta-row"><span class="meta-label">Valid Until: </span>${data.validUntil}</div>
  </div>

  <div class="orange-rule"></div>

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
      ${data.toEmail ? `<div class="party-detail">${e.toEmail}</div>` : ''}
      ${data.toPhone ? `<div class="party-detail">${e.toPhone}</div>` : ''}
    </div>
  </div>

  <div class="event-section">
    <div class="event-title">Event Details</div>
    <div class="event-grid">
      <div>
        <div class="event-item-label">Event Type</div>
        <div class="event-item-value">${e.eventType}</div>
      </div>
      <div>
        <div class="event-item-label">Date</div>
        <div class="event-item-value">${e.eventDate}</div>
      </div>
      <div>
        <div class="event-item-label">Venue</div>
        <div class="event-item-value">${e.venueName}</div>
      </div>
      <div>
        <div class="event-item-label">Venue Address</div>
        <div class="event-item-value">${venueAddressHtml}</div>
      </div>
    </div>
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

  <div class="orange-rule-table"></div>

  <div class="summary-section">
    <div class="summary-row">
      <div class="summary-label">Subtotal</div>
      <div class="summary-value">${fmt(data.subtotal)}</div>
    </div>
    ${discountHtml}
    <div class="total-bar">
      <div>TOTAL:</div>
      <div>${fmt(data.total)}</div>
    </div>
  </div>

  ${pliHtml}

  ${notesSection}

  <div class="terms-section">
    <div class="section-title">Terms &amp; Conditions</div>
    <div class="terms-text">${termsHtml}</div>
  </div>

  <div class="spacer"></div>

  <div class="footer">
    <div class="website">${e.website}</div>
    <div class="validity">This quote is valid for ${data.validityDays} days from the date of issue.</div>
    <div class="thanks">Thank you for considering us!</div>
  </div>
</div>
</body>
</html>`;
}
