import type { QuoteTemplateData } from './quoteTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';
import { PRINT_CSS } from './printStyles';

export function generateQuotePremiumDarkHtml(data: QuoteTemplateData): string {
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
        <div class="summary-row">
          <span class="summary-label">Discount</span>
          <span class="summary-value">-${fmt(data.discountAmount)}</span>
        </div>` : '';

  const pliHtml = data.pliOption === 'details' ? `
    <div class="pli-section">
      <p class="section-label">Public Liability Insurance</p>
      <div class="pli-grid">
        <div><p class="pli-field-label">Insurer</p><p class="pli-field-value">${e.pliInsurer}</p></div>
        <div><p class="pli-field-label">Policy Number</p><p class="pli-field-value">${e.pliPolicyNumber}</p></div>
        <div><p class="pli-field-label">Cover Amount</p><p class="pli-field-value">${e.pliCoverAmount}</p></div>
        <div><p class="pli-field-label">Expiry Date</p><p class="pli-field-value">${e.pliExpiryDate}</p></div>
      </div>
    </div>` : data.pliOption === 'certificate' ? `
    <div class="pli-section">
      <p class="section-label">Public Liability Insurance</p>
      <p class="pli-note">A copy of our PLI certificate is available upon request.</p>
    </div>` : '';

  const notesSection = data.notes ? `
    <div class="notes-section">
      <p class="section-label">Notes</p>
      <p class="notes-text">${notesHtml}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Quote ${data.quoteNumber} — The Green Tangerine</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Cormorant Garamond', serif;
    color: #e8e8e8;
    font-size: 14px;
    line-height: 1.5;
  }

  .page {
    background: #09090B;
    color: #e8e8e8;
    padding: 0;
    min-height: 100%;
    position: relative;
    overflow: hidden;
  }

  .radial-glow {
    position: absolute;
    top: -60px;
    left: 50%;
    transform: translateX(-50%);
    width: 500px;
    height: 180px;
    background: radial-gradient(ellipse, rgba(212,175,55,0.10) 0%, transparent 70%);
    pointer-events: none;
  }

  .header-area {
    padding: 48px 48px 0 48px;
    position: relative;
  }

  .brand-block {
    text-align: center;
    margin-bottom: 12px;
  }

  .tagline {
    font-family: 'Cormorant Garamond', serif;
    font-size: 11px;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: #555;
    margin: 0 0 8px 0;
    font-weight: 300;
  }

  .company-name {
    font-family: 'Playfair Display', serif;
    font-size: 42px;
    font-weight: 900;
    color: #fff;
    margin: 0;
    line-height: 1.05;
    letter-spacing: -0.5px;
  }

  .company-name-the {
    font-style: italic;
    font-weight: 400;
    font-size: 32px;
    color: #666;
  }

  .company-name-green { color: #3d8c1e; }
  .company-name-tangerine {
    color: #d4af37;
    position: relative;
    display: inline-block;
  }

  .wavy-underline {
    position: absolute;
    bottom: -4px;
    left: 0;
    width: 100%;
    height: 6px;
  }

  .logo-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
  }

  .gradient-line-left {
    height: 1px;
    width: 60px;
    background: linear-gradient(90deg, transparent, #333);
  }

  .gradient-line-right {
    height: 1px;
    width: 60px;
    background: linear-gradient(90deg, #333, transparent);
  }

  .logo-container {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    overflow: hidden;
  }

  .logo-container svg { width: 60px; height: 60px; display: block; }

  .quote-bar {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 36px;
    padding-bottom: 28px;
    border-bottom: 1px solid #1a1a1a;
  }

  .quote-label {
    font-family: 'Cormorant Garamond', serif;
    font-size: 11px;
    letter-spacing: 5px;
    text-transform: uppercase;
    color: #d4af37;
    margin: 0;
    font-weight: 600;
  }

  .quote-number {
    font-family: 'Cormorant Garamond', serif;
    font-size: 28px;
    color: #fff;
    font-weight: 300;
    letter-spacing: 2px;
  }

  .body-area {
    padding: 28px 48px 48px 48px;
    font-family: 'Cormorant Garamond', serif;
  }

  .dates-row {
    display: flex;
    gap: 32px;
    margin-bottom: 32px;
    font-size: 13px;
  }

  .date-label {
    color: #444;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .date-value { color: #999; }
  .date-value-valid { color: #d4af37; }

  .parties-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    margin-bottom: 28px;
  }

  .section-label {
    font-size: 10px;
    letter-spacing: 3px;
    color: #3d8c1e;
    text-transform: uppercase;
    margin: 0 0 10px 0;
    font-weight: 600;
  }

  .party-name {
    font-size: 16px;
    color: #fff;
    margin: 0 0 4px 0;
    font-weight: 600;
  }

  .party-trading {
    font-size: 14px;
    color: #666;
    margin: 2px 0;
    font-style: italic;
  }

  .party-website {
    font-size: 12px;
    color: #444;
    margin: 8px 0 0 0;
  }

  .party-address {
    font-size: 14px;
    color: #666;
    margin: 2px 0;
    white-space: pre-line;
  }

  .party-contact {
    font-size: 14px;
    color: #888;
    margin: 2px 0;
  }

  .party-detail {
    font-size: 13px;
    color: #777;
    margin: 2px 0;
  }

  .event-box {
    background: #111;
    border: 1px solid #1a1a1a;
    border-radius: 4px;
    padding: 18px 22px;
    margin-bottom: 28px;
  }

  .event-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
    font-size: 13px;
  }

  .event-field-label {
    font-size: 9px;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin: 0 0 4px 0;
  }

  .event-field-value {
    color: #bbb;
    margin: 0;
  }

  .items-section { margin-bottom: 24px; }

  .items-header {
    display: grid;
    grid-template-columns: 3fr 0.7fr 1fr 1fr;
    padding: 10px 0;
    border-bottom: 1px solid #1a1a1a;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #444;
    font-weight: 600;
  }

  .items-header-qty { text-align: center; }
  .items-header-price { text-align: right; }
  .items-header-total { text-align: right; }

  .item-row {
    display: grid;
    grid-template-columns: 3fr 0.7fr 1fr 1fr;
    padding: 16px 0;
    border-bottom: 1px solid #111;
  }

  .item-desc { font-size: 15px; color: #bbb; }
  .item-qty { font-size: 15px; color: #999; text-align: center; }
  .item-price { font-size: 15px; color: #999; text-align: right; }
  .item-total { font-size: 15px; color: #fff; text-align: right; font-weight: 600; }

  .summary-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 28px;
  }

  .summary-block {
    min-width: 240px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 14px;
  }

  .summary-label { color: #555; }
  .summary-value { color: #bbb; }

  .total-block {
    border-top: 2px solid #d4af37;
    padding-top: 16px;
    text-align: right;
    margin-top: 8px;
  }

  .total-label {
    font-size: 10px;
    letter-spacing: 4px;
    color: #555;
    text-transform: uppercase;
    margin: 0 0 6px 0;
  }

  .total-amount {
    font-family: 'Playfair Display', serif;
    font-size: 38px;
    color: #fff;
    margin: 0;
    font-weight: 400;
    font-style: italic;
  }

  .pli-section {
    border-top: 1px solid #1a1a1a;
    padding-top: 20px;
    margin-bottom: 20px;
  }

  .pli-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
  }

  .pli-field-label {
    font-size: 9px;
    color: #444;
    margin: 0 0 4px 0;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .pli-field-value {
    font-size: 13px;
    color: #888;
    margin: 0;
  }

  .pli-note {
    font-size: 13px;
    color: #666;
    font-style: italic;
  }

  .notes-section {
    margin-bottom: 20px;
  }

  .notes-text {
    font-size: 13px;
    color: #999;
    background: #111;
    border-left: 3px solid #d4af37;
    padding: 12px 16px;
    border-radius: 0 4px 4px 0;
  }

  .terms-section {
    border-top: 1px solid #1a1a1a;
    padding-top: 20px;
    margin-bottom: 20px;
  }

  .terms-text {
    font-size: 11px;
    color: #555;
    line-height: 1.7;
  }

  .footer {
    margin-top: 24px;
    text-align: center;
  }

  .footer-text {
    font-size: 12px;
    color: #2a2a2a;
    font-style: italic;
  }

  .footer-website {
    font-size: 11px;
    color: #3d8c1e;
    letter-spacing: 2px;
    margin-top: 6px;
  }
  ${PRINT_CSS}
</style>
</head>
<body>
<div class="page">
  <div class="radial-glow"></div>

  <div class="header-area">
    <div class="brand-block">
      <p class="tagline">${e.businessType}</p>
      <h1 class="company-name">
        <span class="company-name-the">The </span><span class="company-name-green">Green</span><br>
        <span class="company-name-tangerine">Tangerine
          <svg class="wavy-underline" viewBox="0 0 200 6" preserveAspectRatio="none">
            <path d="M0 3 Q50 0 100 3 Q150 6 200 3" fill="none" stroke="#d4af37" stroke-width="1.5" opacity="0.4" />
          </svg>
        </span>
      </h1>
      <div class="logo-divider">
        <div class="gradient-line-left"></div>
        <div class="logo-container">${TGT_LOGO_SVG}</div>
        <div class="gradient-line-right"></div>
      </div>
    </div>

    <div class="quote-bar">
      <p class="quote-label">Quote</p>
      <span class="quote-number">${e.quoteNumber}</span>
    </div>
  </div>

  <div class="body-area">
    <div class="dates-row">
      <div>
        <span class="date-label">Date </span>
        <span class="date-value">${data.quoteDate}</span>
      </div>
      <div>
        <span class="date-label">Valid Until </span>
        <span class="date-value-valid">${data.validUntil}</span>
      </div>
    </div>

    <div class="parties-grid">
      <div>
        <p class="section-label">From</p>
        <p class="party-name">${e.fromName}</p>
        <p class="party-trading">t/a ${e.tradingAs}</p>
        <p class="party-website">${e.website}</p>
      </div>
      <div>
        <p class="section-label">To</p>
        <p class="party-name">${e.toCompany}</p>
        ${data.toContact ? `<p class="party-contact">${e.toContact}</p>` : ''}
        <p class="party-address">${addressHtml}</p>
        ${data.toEmail ? `<p class="party-detail">${e.toEmail}</p>` : ''}
        ${data.toPhone ? `<p class="party-detail">${e.toPhone}</p>` : ''}
      </div>
    </div>

    <div class="event-box">
      <p class="section-label">Event Details</p>
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
          <p class="event-field-label">Venue Address</p>
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

    <div class="summary-wrapper">
      <div class="summary-block">
        <div class="summary-row">
          <span class="summary-label">Subtotal</span>
          <span class="summary-value">${fmt(data.subtotal)}</span>
        </div>
        ${discountHtml}
        <div class="total-block">
          <p class="total-label">Total</p>
          <p class="total-amount">${fmt(data.total)}</p>
        </div>
      </div>
    </div>

    ${pliHtml}

    ${notesSection}

    <div class="terms-section">
      <p class="section-label">Terms &amp; Conditions</p>
      <p class="terms-text">${termsHtml}</p>
    </div>

    <div class="footer">
      <p class="footer-text">Valid for ${data.validityDays} days &middot; Thank you for considering us</p>
      <p class="footer-website">${e.website}</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
