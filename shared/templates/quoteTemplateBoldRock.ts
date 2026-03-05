import type { QuoteTemplateData } from './quoteTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';

export function generateQuoteBoldRockHtml(data: QuoteTemplateData): string {
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
      <div class="item-row">
        <span class="item-desc">${htmlEscape(item.description)}</span>
        <span class="item-qty">${item.quantity}</span>
        <span class="item-price">${fmt(item.unitPrice)}</span>
        <span class="item-total">${fmt(item.lineTotal)}</span>
      </div>`).join('');

  const discountHtml = data.discountAmount > 0 ? `
        <div class="summary-line">
          <span class="summary-line-label">Discount</span>
          <span class="summary-line-value">-${fmt(data.discountAmount)}</span>
        </div>` : '';

  const pliHtml = data.pliOption === 'details' ? `
    <div class="pli-box">
      <p class="pli-title">Public Liability Insurance</p>
      <div class="pli-grid">
        <div><p class="pli-field-label">Insurer</p><p class="pli-field-value">${e.pliInsurer}</p></div>
        <div><p class="pli-field-label">Policy Number</p><p class="pli-field-value">${e.pliPolicyNumber}</p></div>
        <div><p class="pli-field-label">Cover Amount</p><p class="pli-field-value">${e.pliCoverAmount}</p></div>
        <div><p class="pli-field-label">Expiry Date</p><p class="pli-field-value">${e.pliExpiryDate}</p></div>
      </div>
    </div>` : data.pliOption === 'certificate' ? `
    <div class="pli-box">
      <p class="pli-title">Public Liability Insurance</p>
      <p class="pli-note">A copy of our PLI certificate is available upon request.</p>
    </div>` : '';

  const notesSection = data.notes ? `
    <div class="notes-box">
      <p class="notes-title">Notes</p>
      <p class="notes-text">${notesHtml}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Syne', sans-serif;
    color: #fff;
    font-size: 14px;
    line-height: 1.5;
    background: #0C0C0C;
  }

  .page {
    background: #0C0C0C;
    color: #fff;
    padding: 0;
    min-height: 100%;
    position: relative;
    overflow: hidden;
  }

  .scanlines {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px);
    pointer-events: none;
    z-index: 0;
  }

  .header {
    background: linear-gradient(160deg, #0f2b08, #1a4a0e 40%, #14380a 70%, #0d1f06);
    padding: 36px 40px 32px 40px;
    position: relative;
    overflow: hidden;
  }

  .header-stripe-overlay {
    position: absolute;
    top: 0;
    right: 0;
    width: 200px;
    height: 100%;
    background: repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,140,0,0.04) 8px, rgba(255,140,0,0.04) 10px);
    pointer-events: none;
  }

  .header-content {
    position: relative;
    z-index: 1;
  }

  .header-the {
    font-family: 'Syne', sans-serif;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 10px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    margin: 0 0 -4px 4px;
  }

  .header-green {
    font-family: 'Archivo Black', sans-serif;
    font-size: 58px;
    font-weight: 400;
    text-transform: uppercase;
    color: #fff;
    margin: 0;
    line-height: 0.95;
    letter-spacing: 4px;
    text-shadow: 3px 3px 0 rgba(0,0,0,0.4);
  }

  .header-tangerine {
    font-family: 'Archivo Black', sans-serif;
    font-size: 58px;
    font-weight: 400;
    text-transform: uppercase;
    margin: -2px 0 0 0;
    line-height: 0.95;
    letter-spacing: 4px;
    background: linear-gradient(180deg, #FFa833 0%, #FF7700 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(3px 3px 0 rgba(0,0,0,0.3));
  }

  .header-logo-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
  }

  .header-logo {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .header-tagline {
    font-family: 'Syne', sans-serif;
    font-size: 10px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    margin: 0;
    font-weight: 500;
  }

  .header-quote-watermark {
    position: absolute;
    top: 50%;
    right: 30px;
    transform: translateY(-50%) rotate(-90deg);
    font-family: 'Bebas Neue', sans-serif;
    font-size: 72px;
    color: rgba(255,255,255,0.04);
    letter-spacing: 12px;
    margin: 0;
    transform-origin: center center;
    pointer-events: none;
  }

  .orange-stripe {
    height: 4px;
    background: linear-gradient(90deg, #FF8C00, #FFa833, #FF7700);
  }

  .body {
    padding: 28px 40px 36px 40px;
    position: relative;
  }

  .quote-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 18px;
    border-bottom: 2px solid #1a1a1a;
  }

  .quote-number-badge {
    font-family: 'Bebas Neue', sans-serif;
    background: #FF8C00;
    color: #000;
    padding: 4px 14px;
    font-size: 18px;
    letter-spacing: 3px;
  }

  .quote-dates {
    display: flex;
    gap: 24px;
    font-family: 'Syne', sans-serif;
    font-size: 11px;
  }

  .date-label {
    color: #444;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 9px;
  }

  .date-value { color: #999; }
  .date-value-valid { color: #FF8C00; font-weight: 700; }

  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-bottom: 24px;
    font-family: 'Syne', sans-serif;
  }

  .party-label {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #3d8c1e;
    margin: 0 0 8px 0;
    font-weight: 700;
  }

  .party-name {
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 2px 0;
  }

  .party-detail {
    font-size: 11px;
    color: #666;
    margin: 2px 0;
  }

  .party-website {
    font-size: 10px;
    color: #444;
    margin: 6px 0 0 0;
  }

  .party-address {
    font-size: 11px;
    color: #666;
    margin: 2px 0;
    white-space: pre-line;
  }

  .event-section {
    background: #151515;
    border: 1px solid #252525;
    padding: 16px 20px;
    margin-bottom: 24px;
    font-family: 'Syne', sans-serif;
  }

  .event-title {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #3d8c1e;
    font-weight: 700;
    margin: 0 0 12px 0;
  }

  .event-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
    font-size: 11px;
  }

  .event-field-label {
    color: #444;
    margin: 0 0 4px 0;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .event-field-value {
    margin: 0;
    color: #aaa;
  }

  .items-section {
    margin-bottom: 24px;
    font-family: 'Syne', sans-serif;
  }

  .items-header {
    display: grid;
    grid-template-columns: 3fr 0.7fr 1fr 1fr;
    padding: 10px 16px;
    background: #151515;
    border: 1px solid #252525;
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #555;
    font-weight: 700;
  }

  .items-header-qty { text-align: center; }
  .items-header-price { text-align: right; }
  .items-header-total { text-align: right; }

  .item-row {
    display: grid;
    grid-template-columns: 3fr 0.7fr 1fr 1fr;
    padding: 14px 16px;
    border-bottom: 1px solid #1a1a1a;
    border-left: 1px solid #252525;
    border-right: 1px solid #252525;
  }

  .item-desc { font-size: 12px; color: #bbb; }
  .item-qty { font-size: 12px; color: #888; text-align: center; }
  .item-price { font-size: 12px; color: #888; text-align: right; }
  .item-total { font-size: 13px; font-weight: 700; text-align: right; }

  .summary-section {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 24px;
    font-family: 'Syne', sans-serif;
  }

  .summary-block { min-width: 240px; }

  .summary-line {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 12px;
  }

  .summary-line-label { color: #555; }
  .summary-line-value { color: #aaa; }

  .total-box {
    display: flex;
    align-items: center;
    gap: 20px;
    background: linear-gradient(135deg, #FF8C00, #e67a00);
    padding: 14px 32px;
    margin-top: 8px;
  }

  .total-label {
    font-family: 'Syne', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(0,0,0,0.5);
  }

  .total-value {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 34px;
    color: #000;
    letter-spacing: 2px;
  }

  .pli-box {
    background: #151515;
    border: 1px solid #252525;
    padding: 16px 20px;
    margin-bottom: 20px;
    font-family: 'Syne', sans-serif;
  }

  .pli-title {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #3d8c1e;
    font-weight: 700;
    margin: 0 0 12px 0;
  }

  .pli-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
    font-size: 11px;
  }

  .pli-field-label {
    color: #444;
    margin: 0 0 4px 0;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .pli-field-value {
    margin: 0;
    color: #aaa;
  }

  .pli-note {
    font-size: 11px;
    color: #666;
    font-style: italic;
  }

  .notes-box {
    background: #151515;
    border: 1px solid #252525;
    border-left: 3px solid #FF8C00;
    padding: 16px 20px;
    margin-bottom: 20px;
    font-family: 'Syne', sans-serif;
  }

  .notes-title {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #3d8c1e;
    font-weight: 700;
    margin: 0 0 8px 0;
  }

  .notes-text {
    font-size: 11px;
    color: #aaa;
    line-height: 1.6;
  }

  .terms-section {
    margin-bottom: 20px;
    font-family: 'Syne', sans-serif;
  }

  .terms-title {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #3d8c1e;
    font-weight: 700;
    margin: 0 0 8px 0;
  }

  .terms-text {
    font-size: 10px;
    color: #444;
    line-height: 1.7;
  }

  .footer {
    text-align: center;
    font-family: 'Syne', sans-serif;
  }

  .footer-terms {
    font-size: 10px;
    color: #333;
  }

  .footer-slogan {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 16px;
    color: #3d8c1e;
    letter-spacing: 6px;
    margin-top: 6px;
  }
</style>
</head>
<body>
<div class="page">
  <div class="scanlines"></div>

  <!-- HEADER -->
  <div class="header">
    <div class="header-stripe-overlay"></div>
    <div class="header-content">
      <p class="header-the">THE</p>
      <h1 class="header-green">GREEN</h1>
      <h1 class="header-tangerine">TANGERINE</h1>
      <div class="header-logo-row">
        <div class="header-logo">${TGT_LOGO_SVG}</div>
        <p class="header-tagline">Live Music Entertainment</p>
      </div>
    </div>
    <p class="header-quote-watermark">QUOTE</p>
  </div>

  <div class="orange-stripe"></div>

  <!-- BODY -->
  <div class="body">
    <div class="quote-meta-row">
      <span class="quote-number-badge">${e.quoteNumber}</span>
      <div class="quote-dates">
        <div>
          <span class="date-label">Date </span>
          <span class="date-value">${data.quoteDate}</span>
        </div>
        <div>
          <span class="date-label">Valid Until </span>
          <span class="date-value-valid">${data.validUntil}</span>
        </div>
      </div>
    </div>

    <div class="parties">
      <div>
        <p class="party-label">From</p>
        <p class="party-name">${e.fromName}</p>
        <p class="party-detail">Trading as: ${e.tradingAs}</p>
        <p class="party-website">${e.website}</p>
      </div>
      <div>
        <p class="party-label">To</p>
        <p class="party-name">${e.toCompany}</p>
        ${data.toContact ? `<p class="party-detail">${e.toContact}</p>` : ''}
        <p class="party-address">${addressHtml}</p>
        ${data.toEmail ? `<p class="party-detail">${e.toEmail}</p>` : ''}
        ${data.toPhone ? `<p class="party-detail">${e.toPhone}</p>` : ''}
      </div>
    </div>

    <div class="event-section">
      <p class="event-title">Event Details</p>
      <div class="event-grid">
        <div>
          <p class="event-field-label">Event Type</p>
          <p class="event-field-value">${e.eventType}</p>
        </div>
        <div>
          <p class="event-field-label">Date</p>
          <p class="event-field-value">${e.eventDate}</p>
        </div>
        <div>
          <p class="event-field-label">Venue</p>
          <p class="event-field-value">${e.venueName}</p>
        </div>
        <div>
          <p class="event-field-label">Address</p>
          <p class="event-field-value">${venueAddressHtml}</p>
        </div>
      </div>
    </div>

    <div class="items-section">
      <div class="items-header">
        <span>Description</span>
        <span class="items-header-qty">Qty</span>
        <span class="items-header-price">Unit Price</span>
        <span class="items-header-total">Total</span>
      </div>
      ${lineItemsHtml}
    </div>

    <div class="summary-section">
      <div class="summary-block">
        <div class="summary-line">
          <span class="summary-line-label">Subtotal</span>
          <span class="summary-line-value">${fmt(data.subtotal)}</span>
        </div>
        ${discountHtml}
        <div class="total-box">
          <span class="total-label">Total</span>
          <span class="total-value">${fmt(data.total)}</span>
        </div>
      </div>
    </div>

    ${pliHtml}

    ${notesSection}

    <div class="terms-section">
      <p class="terms-title">Terms &amp; Conditions</p>
      <p class="terms-text">${termsHtml}</p>
    </div>

    <div class="footer">
      <p class="footer-terms">Quote valid for ${data.validityDays} days &middot; Let's make some noise</p>
      <p class="footer-slogan">KEEP IT GREEN &#127818;</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
