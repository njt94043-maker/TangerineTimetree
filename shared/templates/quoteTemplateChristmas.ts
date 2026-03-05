import type { QuoteTemplateData } from './quoteTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';

export function generateQuoteChristmasHtml(data: QuoteTemplateData): string {
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
      <div class="summary-row">
        <span class="summary-label">Discount:</span>
        <span class="summary-value">&minus;${fmt(data.discountAmount)}</span>
      </div>` : '';

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
  <div class="notes-section">
    <h3>Notes</h3>
    <p>${notesHtml}</p>
  </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=Cormorant+Garamond:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Crimson Text', serif; color: #2a2a2a; font-size: 14px; line-height: 1.5; background: #faf8f2; }
  .page { min-height: 100vh; display: flex; flex-direction: column; position: relative; overflow: hidden; }
  .snowflakes { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
  .header { background: #1B4332; color: #fff; padding: 32px 40px; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
  .header-left h1 { font-family: 'Cormorant Garamond', serif; font-size: 38px; font-weight: 700; letter-spacing: 4px; margin-bottom: 4px; }
  .header-left .subtitle { font-size: 12px; letter-spacing: 2px; color: #c9a84c; }
  .header .logo { width: 80px; height: 80px; }
  .gold-rule { height: 4px; background: linear-gradient(90deg, #c9a84c, #e8d48c, #c9a84c); position: relative; z-index: 1; }
  .holly-border { height: 6px; background: repeating-linear-gradient(90deg, #1B4332 0px, #1B4332 8px, #c9a84c 8px, #c9a84c 10px, #8B0000 10px, #8B0000 12px, #c9a84c 12px, #c9a84c 14px); position: relative; z-index: 1; }
  .meta-bar { padding: 18px 40px; display: flex; gap: 40px; position: relative; z-index: 1; background: rgba(201,168,76,0.06); border-bottom: 1px solid rgba(201,168,76,0.15); }
  .meta-item { font-size: 13px; }
  .meta-label { color: #1B4332; font-weight: 700; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; display: block; margin-bottom: 2px; }
  .parties { display: flex; padding: 24px 40px; gap: 40px; position: relative; z-index: 1; }
  .party { flex: 1; }
  .party-label { color: #1B4332; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #c9a84c; display: inline-block; }
  .party-name { font-weight: 700; font-size: 16px; margin-bottom: 2px; }
  .party-detail { font-size: 13px; color: #666; line-height: 1.4; }
  .party-detail a { color: #1B4332; text-decoration: none; }
  .event-bar { margin: 0 40px; padding: 14px 20px; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.2); border-radius: 4px; display: flex; gap: 30px; position: relative; z-index: 1; }
  .event-item { font-size: 13px; }
  .event-field-label { color: #1B4332; font-weight: 700; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; display: block; margin-bottom: 2px; }
  .table-section { margin: 20px 40px 0; position: relative; z-index: 1; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  thead th { background: #c9a84c; color: #fff; padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  thead th.th-qty { text-align: center; width: 60px; }
  thead th.th-price { text-align: right; width: 110px; }
  thead th.th-total { text-align: right; width: 110px; }
  .row-even td { background: rgba(201,168,76,0.04); }
  .row-odd td { background: #faf8f2; }
  td { padding: 12px 14px; border-bottom: 1px solid rgba(201,168,76,0.15); }
  .td-qty { text-align: center; color: #666; }
  .td-price { text-align: right; color: #666; }
  .td-total { text-align: right; font-weight: 700; }
  .summary-section { display: flex; justify-content: flex-end; margin: 12px 40px 0; position: relative; z-index: 1; }
  .summary-block { min-width: 280px; }
  .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
  .summary-label { color: #666; }
  .summary-value { font-weight: 700; }
  .total-bar { background: #1B4332; color: #fff; display: flex; justify-content: space-between; padding: 12px 20px; font-weight: 700; font-size: 18px; border-radius: 4px; margin-top: 6px; }
  .total-bar .total-amt { color: #c9a84c; }
  .pli-section { padding: 16px 40px; position: relative; z-index: 1; }
  .pli-section h3 { font-size: 12px; font-weight: 700; color: #1B4332; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .pli-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; }
  .pli-label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .pli-value { font-size: 13px; color: #333; }
  .pli-note { font-size: 13px; color: #666; font-style: italic; }
  .notes-section { padding: 16px 40px; position: relative; z-index: 1; }
  .notes-section h3 { font-size: 12px; font-weight: 700; color: #1B4332; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .notes-section p { font-size: 13px; color: #666; line-height: 1.5; }
  .terms-section { padding: 16px 40px; border-top: 1px solid rgba(201,168,76,0.2); position: relative; z-index: 1; }
  .terms-section h3 { font-size: 12px; font-weight: 700; color: #1B4332; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .terms-section p { font-size: 12px; color: #666; line-height: 1.6; }
  .spacer { flex: 1; }
  .footer { background: #1B4332; color: #fff; padding: 20px 40px; text-align: center; font-size: 12px; position: relative; z-index: 1; }
  .footer .website { font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #c9a84c; }
  .footer .validity { color: rgba(255,255,255,0.7); }
  .footer .festive { color: #c9a84c; font-style: italic; margin-top: 4px; }
</style>
</head>
<body>
<div class="page">
  <svg class="snowflakes" viewBox="0 0 600 900" preserveAspectRatio="none">
    <circle cx="50" cy="120" r="2" fill="#c9a84c" opacity="0.15"/>
    <circle cx="150" cy="80" r="1.5" fill="#c9a84c" opacity="0.12"/>
    <circle cx="350" cy="200" r="2.5" fill="#c9a84c" opacity="0.1"/>
    <circle cx="500" cy="150" r="1.8" fill="#c9a84c" opacity="0.13"/>
    <circle cx="80" cy="400" r="2" fill="#c9a84c" opacity="0.08"/>
    <circle cx="520" cy="350" r="1.5" fill="#c9a84c" opacity="0.1"/>
    <circle cx="250" cy="500" r="2" fill="#c9a84c" opacity="0.07"/>
    <circle cx="420" cy="600" r="1.8" fill="#c9a84c" opacity="0.09"/>
  </svg>

  <div class="header">
    <div class="header-left">
      <h1>QUOTE</h1>
      <div class="subtitle">&#9733; ${e.tradingAs} &#9733;</div>
    </div>
    <div class="logo">${TGT_LOGO_SVG}</div>
  </div>

  <div class="gold-rule"></div>
  <div class="holly-border"></div>

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
    <div class="festive">&#9733; Wishing you a wonderful festive season! &#9733;</div>
  </div>
</div>
</body>
</html>`;
}
