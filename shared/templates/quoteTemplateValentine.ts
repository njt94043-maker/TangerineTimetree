import type { QuoteTemplateData } from './quoteTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';

export function generateQuoteValentineHtml(data: QuoteTemplateData): string {
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

  const lineItemsHtml = data.lineItems.map((item, i) => `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="td-desc">${htmlEscape(item.description)}</td>
        <td class="td-qty">${item.quantity}</td>
        <td class="td-price">${fmt(item.unitPrice)}</td>
        <td class="td-total">${fmt(item.lineTotal)}</td>
      </tr>`).join('');

  const discountHtml = data.discountAmount > 0 ? `
      <div class="summary-row"><span class="summary-label">Discount:</span><span class="summary-value">&minus;${fmt(data.discountAmount)}</span></div>` : '';

  const pliHtml = data.pliOption === 'details' ? `
  <div class="pli-section">
    <h3>Public Liability Insurance</h3>
    <div class="pli-grid">
      <div><div class="pli-label">Insurer</div><div class="pli-value">${e.pliInsurer}</div></div>
      <div><div class="pli-label">Policy No.</div><div class="pli-value">${e.pliPolicyNumber}</div></div>
      <div><div class="pli-label">Cover</div><div class="pli-value">${e.pliCoverAmount}</div></div>
      <div><div class="pli-label">Expiry</div><div class="pli-value">${e.pliExpiryDate}</div></div>
    </div>
  </div>` : data.pliOption === 'certificate' ? `
  <div class="pli-section">
    <h3>Public Liability Insurance</h3>
    <p class="pli-note">A copy of our PLI certificate is available upon request.</p>
  </div>` : '';

  const notesSection = data.notes ? `
  <div class="notes-section"><h3>Notes</h3><p>${notesHtml}</p></div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Lora', serif; color: #4a3040; font-size: 14px; line-height: 1.5; background: #fdf5f7; }
  .page { min-height: 100vh; display: flex; flex-direction: column; }
  .header { background: linear-gradient(135deg, #8b1a4a, #a0274f); color: #fff; padding: 32px 40px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-family: 'Playfair Display', serif; font-size: 38px; font-weight: 700; letter-spacing: 4px; }
  .header .subtitle { font-size: 12px; letter-spacing: 2px; color: rgba(255,182,193,0.7); font-style: italic; }
  .header .logo { width: 80px; height: 80px; }
  .rose-rule { height: 4px; background: linear-gradient(90deg, #b45064, #e8a0b0, #b45064); }
  .meta-bar { padding: 16px 40px; display: flex; gap: 36px; background: rgba(180,80,100,0.04); border-bottom: 1px solid rgba(180,80,100,0.12); }
  .meta-item { font-size: 13px; }
  .meta-label { color: #8b1a4a; font-weight: 700; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; display: block; margin-bottom: 2px; }
  .parties { display: flex; padding: 24px 40px; gap: 40px; }
  .party { flex: 1; }
  .party-label { color: #8b1a4a; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #b45064; display: inline-block; }
  .party-name { font-weight: 700; font-size: 16px; margin-bottom: 2px; }
  .party-detail { font-size: 13px; color: #8a6e7e; line-height: 1.4; }
  .party-detail a { color: #8b1a4a; text-decoration: none; }
  .event-bar { margin: 0 40px; padding: 14px 20px; background: rgba(180,80,100,0.05); border: 1px solid rgba(180,80,100,0.12); border-radius: 4px; display: flex; gap: 30px; }
  .event-item { font-size: 13px; }
  .event-field-label { color: #8b1a4a; font-weight: 700; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; display: block; margin-bottom: 2px; }
  .table-section { margin: 20px 40px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  thead th { background: #b45064; color: #fff; padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  thead th.th-qty { text-align: center; width: 60px; }
  thead th.th-price { text-align: right; width: 110px; }
  thead th.th-total { text-align: right; width: 110px; }
  .row-even td { background: rgba(180,80,100,0.03); }
  .row-odd td { background: #fdf5f7; }
  td { padding: 12px 14px; border-bottom: 1px solid rgba(180,80,100,0.1); }
  .td-qty { text-align: center; color: #8a6e7e; }
  .td-price { text-align: right; color: #8a6e7e; }
  .td-total { text-align: right; font-weight: 700; }
  .summary-section { display: flex; justify-content: flex-end; margin: 12px 40px 0; }
  .summary-block { min-width: 280px; }
  .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
  .summary-label { color: #8a6e7e; }
  .summary-value { font-weight: 700; }
  .total-bar { background: #8b1a4a; color: #fff; display: flex; justify-content: space-between; padding: 12px 20px; font-weight: 700; font-size: 18px; border-radius: 4px; margin-top: 6px; }
  .total-bar .total-amt { color: #ffb6c1; }
  .pli-section { padding: 16px 40px; }
  .pli-section h3 { font-size: 12px; font-weight: 700; color: #8b1a4a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .pli-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; }
  .pli-label { font-size: 10px; color: #8a6e7e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .pli-value { font-size: 13px; }
  .pli-note { font-size: 13px; color: #8a6e7e; font-style: italic; }
  .notes-section { padding: 16px 40px; }
  .notes-section h3 { font-size: 12px; font-weight: 700; color: #8b1a4a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .notes-section p { font-size: 13px; color: #8a6e7e; line-height: 1.5; }
  .terms-section { padding: 16px 40px; border-top: 1px solid rgba(180,80,100,0.12); }
  .terms-section h3 { font-size: 12px; font-weight: 700; color: #8b1a4a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .terms-section p { font-size: 12px; color: #8a6e7e; line-height: 1.6; }
  .spacer { flex: 1; }
  .footer { background: linear-gradient(135deg, #8b1a4a, #a0274f); color: #fff; padding: 20px 40px; text-align: center; font-size: 12px; }
  .footer .website { font-weight: 700; font-size: 13px; color: #ffb6c1; margin-bottom: 4px; }
  .footer .validity { color: rgba(255,255,255,0.7); }
  .footer .romantic { color: #ffb6c1; font-style: italic; margin-top: 4px; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <h1>QUOTE</h1>
      <div class="subtitle">&hearts; ${e.tradingAs}</div>
    </div>
    <div class="logo">${TGT_LOGO_SVG}</div>
  </div>

  <div class="rose-rule"></div>

  <div class="meta-bar">
    <div class="meta-item"><span class="meta-label">Quote Number</span><strong>${e.quoteNumber}</strong></div>
    <div class="meta-item"><span class="meta-label">Date</span>${data.quoteDate}</div>
    <div class="meta-item"><span class="meta-label">Valid Until</span>${data.validUntil}</div>
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
      ${data.toEmail ? `<div class="party-detail">${e.toEmail}</div>` : ''}
      ${data.toPhone ? `<div class="party-detail">${e.toPhone}</div>` : ''}
    </div>
  </div>

  <div class="event-bar">
    <div class="event-item"><span class="event-field-label">Event Type</span>${e.eventType}</div>
    <div class="event-item"><span class="event-field-label">Date</span>${e.eventDate}</div>
    <div class="event-item"><span class="event-field-label">Venue</span>${e.venueName}</div>
    <div class="event-item"><span class="event-field-label">Address</span>${venueAddressHtml}</div>
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
      <div class="total-bar"><span>TOTAL:</span><span class="total-amt">${fmt(data.total)}</span></div>
    </div>
  </div>

  ${pliHtml}
  ${notesSection}

  <div class="terms-section">
    <h3>Terms &amp; Conditions</h3>
    <p>${termsHtml}</p>
  </div>

  <div class="spacer"></div>

  <div class="footer">
    <div class="website">${e.website}</div>
    <div class="validity">This quote is valid for ${data.validityDays} days from date of issue</div>
    <div class="romantic">&hearts; An evening to remember &hearts;</div>
  </div>
</div>
</body>
</html>`;
}
