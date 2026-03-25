import type { FormalInvoiceTemplateData } from './formalInvoiceTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';
import { PRINT_CSS } from './printStyles';

export function generateFormalInvoiceHalloweenHtml(data: FormalInvoiceTemplateData): string {
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

  const lineItemsHtml = data.lineItems.map((item, i) => `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="td-desc">${htmlEscape(item.description)}</td>
        <td class="td-qty">${item.quantity}</td>
        <td class="td-price">${fmt(item.unitPrice)}</td>
        <td class="td-total">${fmt(item.lineTotal)}</td>
      </tr>`).join('');

  const discountHtml = data.discountAmount > 0 ? `
      <div class="summary-row"><span class="summary-label">Discount:</span><span class="summary-value">&minus;${fmt(data.discountAmount)}</span></div>` : '';

  const notesHtml = data.notes ? `
  <div class="notes-section"><h3>Notes</h3><p>${e.notes.replace(/\n/g, '<br>')}</p></div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${data.invoiceNumber} — The Green Tangerine</title>
<link href="https://fonts.googleapis.com/css2?family=Creepster&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Nunito', sans-serif; color: #e0d6c8; font-size: 14px; line-height: 1.5; background: #1a1028; }
  .page { min-height: 100%; display: flex; flex-direction: column; background: #1a1028; }
  .header { background: linear-gradient(135deg, #2d1b4e, #1a1028); color: #fff; padding: 32px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #e8940a; }
  .header h1 { font-family: 'Creepster', cursive; font-size: 42px; letter-spacing: 6px; color: #e8940a; }
  .header .subtitle { font-size: 12px; color: rgba(232,148,10,0.6); letter-spacing: 2px; }
  .header .logo { width: 80px; height: 80px; }
  .meta-bar { padding: 16px 40px; display: flex; gap: 36px; background: rgba(232,148,10,0.06); border-bottom: 1px solid rgba(232,148,10,0.15); }
  .meta-item { font-size: 13px; }
  .meta-label { color: #e8940a; font-weight: 700; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; display: block; margin-bottom: 2px; }
  .parties { display: flex; padding: 24px 40px; gap: 40px; }
  .party { flex: 1; }
  .party-label { color: #e8940a; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #e8940a; display: inline-block; }
  .party-name { font-weight: 700; font-size: 16px; margin-bottom: 2px; }
  .party-detail { font-size: 13px; color: #9a8d7e; line-height: 1.4; }
  .party-detail a { color: #e8940a; text-decoration: none; }
  .event-bar { margin: 0 40px; padding: 14px 20px; background: rgba(232,148,10,0.06); border: 1px solid rgba(232,148,10,0.15); border-radius: 4px; display: flex; gap: 30px; }
  .event-item { font-size: 13px; }
  .event-field-label { color: #e8940a; font-weight: 700; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; display: block; margin-bottom: 2px; }
  .table-section { margin: 20px 40px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  thead th { background: #e8940a; color: #1a1028; padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  thead th.th-qty { text-align: center; width: 60px; }
  thead th.th-price { text-align: right; width: 110px; }
  thead th.th-total { text-align: right; width: 110px; }
  .row-even td { background: rgba(232,148,10,0.04); }
  .row-odd td { background: rgba(26,16,40,0.5); }
  td { padding: 12px 14px; border-bottom: 1px solid rgba(232,148,10,0.1); }
  .td-qty { text-align: center; color: #9a8d7e; }
  .td-price { text-align: right; color: #9a8d7e; }
  .td-total { text-align: right; font-weight: 700; color: #e0d6c8; }
  .summary-section { display: flex; justify-content: flex-end; margin: 12px 40px 0; }
  .summary-block { min-width: 280px; }
  .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
  .summary-label { color: #9a8d7e; }
  .summary-value { font-weight: 700; }
  .total-bar { background: #e8940a; color: #1a1028; display: flex; justify-content: space-between; padding: 12px 20px; font-weight: 700; font-size: 18px; border-radius: 4px; margin-top: 6px; }
  .notes-section { padding: 16px 40px; }
  .notes-section h3 { font-size: 12px; font-weight: 700; color: #e8940a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .notes-section p { font-size: 13px; color: #9a8d7e; line-height: 1.5; }
  .payment { padding: 20px 40px; border-top: 1px solid rgba(232,148,10,0.15); }
  .payment h3 { font-size: 12px; font-weight: 700; color: #e8940a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  .payment-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; }
  .payment-field-label { font-size: 10px; color: #9a8d7e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .payment-field-value { font-size: 13px; color: #e0d6c8; }
  .spacer { flex: 1; }
  .footer { background: #2d1b4e; color: #e0d6c8; padding: 20px 40px; text-align: center; font-size: 12px; }
  .footer .website { font-weight: 700; font-size: 13px; color: #e8940a; margin-bottom: 4px; }
  .footer .terms { color: rgba(224,214,200,0.6); }
  .footer .spooky { color: #e8940a; font-family: 'Creepster', cursive; font-size: 16px; margin-top: 4px; letter-spacing: 2px; }
  ${PRINT_CSS}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <h1>INVOICE</h1>
      <div class="subtitle">&#127875; ${e.tradingAs}</div>
    </div>
    <div class="logo">${TGT_LOGO_SVG}</div>
  </div>

  <div class="meta-bar">
    <div class="meta-item"><span class="meta-label">Invoice Number</span><strong>${data.invoiceNumber}</strong></div>
    <div class="meta-item"><span class="meta-label">Issue Date</span>${data.issueDate}</div>
    <div class="meta-item"><span class="meta-label">Due Date</span>${data.dueDate}</div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">${e.fromName}</div>
      <div class="party-detail">Trading as: ${e.tradingAs}</div>
      <div class="party-detail">${e.businessType}</div>
      <div class="party-detail"><a href="https://${e.website}">${e.website}</a></div>
    </div>
    <div class="party">
      <div class="party-label">To</div>
      <div class="party-name">${e.toCompany}</div>
      ${data.toContact ? `<div class="party-detail">${e.toContact}</div>` : ''}
      <div class="party-detail">${addressHtml}</div>
    </div>
  </div>

  <div class="event-bar">
    <div class="event-item"><span class="event-field-label">Venue</span>${e.venueName}</div>
    <div class="event-item"><span class="event-field-label">Event Date</span>${data.eventDate}</div>
  </div>

  <div class="table-section">
    <table>
      <thead><tr><th>Description</th><th class="th-qty">Qty</th><th class="th-price">Unit Price</th><th class="th-total">Total</th></tr></thead>
      <tbody>${lineItemsHtml}</tbody>
    </table>
  </div>

  <div class="summary-section">
    <div class="summary-block">
      <div class="summary-row"><span class="summary-label">Subtotal:</span><span class="summary-value">${fmt(data.subtotal)}</span></div>
      ${discountHtml}
      <div class="total-bar"><span>TOTAL:</span><span>${fmt(data.total)}</span></div>
    </div>
  </div>

  ${notesHtml}

  <div class="payment">
    <h3>Payment Details</h3>
    <div class="payment-grid">
      <div><div class="payment-field-label">Account Name</div><div class="payment-field-value">${e.bankAccountName}</div></div>
      <div><div class="payment-field-label">Bank</div><div class="payment-field-value">${e.bankName}</div></div>
      <div><div class="payment-field-label">Sort Code</div><div class="payment-field-value">${e.bankSortCode}</div></div>
      <div><div class="payment-field-label">Account No.</div><div class="payment-field-value">${e.bankAccountNumber}</div></div>
    </div>
  </div>

  <div class="spacer"></div>

  <div class="footer">
    <div class="website">${e.website}</div>
    <div class="terms">Please pay within ${data.paymentTermsDays} days of invoice date</div>
    <div class="spooky">&#127875; SPOOKTACULAR ENTERTAINMENT &#127875;</div>
  </div>
</div>
</body>
</html>`;
}
