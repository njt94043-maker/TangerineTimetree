import type { QuoteTemplateData } from './quoteTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';

export function generateQuoteCleanProfessionalHtml(data: QuoteTemplateData): string {
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
      <div class="items-row">
        <span class="items-row-desc">${htmlEscape(item.description)}</span>
        <span class="items-row-qty">${item.quantity}</span>
        <span class="items-row-price">${fmt(item.unitPrice)}</span>
        <span class="items-row-total">${fmt(item.lineTotal)}</span>
      </div>`).join('');

  const discountHtml = data.discountAmount > 0 ? `
      <div class="items-summary-row">
        <span class="items-summary-label">Discount</span>
        <span class="items-summary-value">-${fmt(data.discountAmount)}</span>
      </div>` : '';

  const pliHtml = data.pliOption === 'details' ? `
    <div class="pli-box">
      <p class="box-title">Public Liability Insurance</p>
      <div class="pli-grid">
        <div><p class="pli-field-label">Insurer</p><p class="pli-field-value">${e.pliInsurer}</p></div>
        <div><p class="pli-field-label">Policy Number</p><p class="pli-field-value">${e.pliPolicyNumber}</p></div>
        <div><p class="pli-field-label">Cover Amount</p><p class="pli-field-value">${e.pliCoverAmount}</p></div>
        <div><p class="pli-field-label">Expiry Date</p><p class="pli-field-value">${e.pliExpiryDate}</p></div>
      </div>
    </div>` : data.pliOption === 'certificate' ? `
    <div class="pli-box">
      <p class="box-title">Public Liability Insurance</p>
      <p class="pli-note">A copy of our PLI certificate is available upon request.</p>
    </div>` : '';

  const notesSection = data.notes ? `
    <div class="notes-box">
      <p class="box-title">Notes</p>
      <p class="notes-text">${notesHtml}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Libre Baskerville', serif;
    color: #2a2a2a;
    font-size: 14px;
    line-height: 1.5;
  }

  .page {
    background: #FAF9F6;
    min-height: 100%;
    position: relative;
    overflow: hidden;
  }

  .top-stripe {
    height: 6px;
    background: linear-gradient(90deg, #2D5016, #3d8c1e, #FF8C00, #FFa833, #FF8C00, #3d8c1e, #2D5016);
  }

  .content { padding: 44px 48px; }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .logo-wrap {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    overflow: hidden;
  }

  .company-the {
    font-family: 'Instrument Serif', serif;
    font-size: 14px;
    font-style: italic;
    color: #999;
    margin: 0 0 -2px 2px;
    letter-spacing: 0.5px;
  }

  .company-name {
    font-family: 'DM Serif Display', serif;
    font-size: 34px;
    font-weight: 400;
    margin: 0;
    line-height: 1;
    color: #1a1a1a;
  }

  .company-name .green { color: #2D5016; }
  .company-name .tangerine { color: #d4740e; }

  .company-tagline {
    font-family: 'Libre Baskerville', serif;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #b5a998;
    margin: 6px 0 0 2px;
  }

  .header-right { text-align: right; }

  .quote-label {
    font-family: 'Libre Baskerville', serif;
    font-size: 10px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #c4b8a8;
    margin: 0 0 6px 0;
  }

  .quote-number {
    font-family: 'DM Serif Display', serif;
    font-size: 24px;
    color: #2D5016;
    margin: 0;
  }

  .separator {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 24px 0;
  }

  .separator-line-left {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, #ddd5c8, transparent);
  }

  .separator-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #d4a574;
    opacity: 0.5;
  }

  .separator-line-right {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, #ddd5c8);
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 32px;
    margin-bottom: 28px;
    font-family: 'Libre Baskerville', serif;
  }

  .info-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #c4b8a8;
    margin: 0 0 10px 0;
    font-weight: 700;
  }

  .info-name {
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 3px 0;
  }

  .info-trading {
    font-size: 12px;
    color: #888;
    margin: 2px 0;
    font-style: italic;
  }

  .info-website {
    font-size: 11px;
    color: #b5a998;
    margin: 8px 0 0 0;
  }

  .info-address {
    font-size: 12px;
    color: #888;
    margin: 2px 0;
    line-height: 1.4;
  }

  .info-contact {
    font-size: 12px;
    color: #888;
    margin: 2px 0;
  }

  .info-detail {
    font-size: 11px;
    color: #aaa;
    margin: 2px 0;
  }

  .details-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 12px;
  }

  .details-row:last-child { margin-bottom: 0; }

  .details-label { color: #aaa; }
  .details-value { color: #555; }
  .details-value-valid { color: #2D5016; font-weight: 700; }

  .event-box {
    background: #fff;
    border: 1px solid #e4ddd2;
    border-radius: 3px;
    padding: 16px 20px;
    margin-bottom: 28px;
    font-family: 'Libre Baskerville', serif;
  }

  .box-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #c4b8a8;
    margin: 0 0 12px 0;
    font-weight: 700;
  }

  .event-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
    font-size: 12px;
  }

  .event-field-label {
    color: #c4b8a8;
    margin: 0 0 4px 0;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  .event-field-value {
    margin: 0;
    font-weight: 700;
    color: #555;
  }

  .items-table {
    border: 1px solid #e4ddd2;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
    font-family: 'Libre Baskerville', serif;
  }

  .items-header {
    display: grid;
    grid-template-columns: 3fr 0.7fr 1fr 1fr;
    padding: 13px 20px;
    background: #2D5016;
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.8);
    font-weight: 700;
  }

  .items-header-qty { text-align: center; }
  .items-header-price { text-align: right; }
  .items-header-total { text-align: right; }

  .items-row {
    display: grid;
    grid-template-columns: 3fr 0.7fr 1fr 1fr;
    padding: 14px 20px;
    background: #fff;
    border-bottom: 1px solid #f0ebe3;
  }

  .items-row-desc { font-size: 13px; color: #555; }
  .items-row-qty { font-size: 13px; color: #888; text-align: center; }
  .items-row-price { font-size: 13px; color: #888; text-align: right; }
  .items-row-total { font-size: 14px; font-weight: 700; text-align: right; }

  .items-summary-row {
    display: grid;
    grid-template-columns: 1fr 120px;
    padding: 12px 20px;
    background: #f9f7f3;
  }

  .items-summary-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #b5a998;
    align-self: center;
  }

  .items-summary-value {
    font-size: 14px;
    text-align: right;
    color: #555;
    font-weight: 700;
  }

  .items-total-row {
    display: grid;
    grid-template-columns: 1fr 120px;
    padding: 18px 20px;
    background: #f9f7f3;
  }

  .items-total-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #b5a998;
    align-self: center;
  }

  .items-total-amount {
    font-family: 'DM Serif Display', serif;
    font-size: 26px;
    text-align: right;
    color: #2D5016;
  }

  .pli-box {
    background: #fff;
    border: 1px solid #e4ddd2;
    border-radius: 3px;
    padding: 16px 20px;
    margin-bottom: 20px;
    font-family: 'Libre Baskerville', serif;
  }

  .pli-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
    font-size: 12px;
  }

  .pli-field-label {
    color: #c4b8a8;
    margin: 0 0 4px 0;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  .pli-field-value {
    margin: 0;
    font-weight: 700;
    color: #555;
  }

  .pli-note {
    font-size: 12px;
    color: #888;
    font-style: italic;
  }

  .notes-box {
    background: #fff;
    border: 1px solid #e4ddd2;
    border-radius: 3px;
    padding: 16px 20px;
    margin-bottom: 20px;
    font-family: 'Libre Baskerville', serif;
  }

  .notes-text {
    font-size: 12px;
    color: #555;
    line-height: 1.6;
  }

  .terms-box {
    margin-bottom: 20px;
    font-family: 'Libre Baskerville', serif;
  }

  .terms-text {
    font-size: 10px;
    color: #aaa;
    line-height: 1.7;
  }

  .footer {
    text-align: center;
    padding: 12px 0 0 0;
  }

  .footer-text {
    font-family: 'Instrument Serif', serif;
    font-size: 13px;
    color: #c4b8a8;
    font-style: italic;
  }
</style>
</head>
<body>
<div class="page">
  <div class="top-stripe"></div>

  <div class="content">
    <div class="header">
      <div class="header-left">
        <div class="logo-wrap">${TGT_LOGO_SVG}</div>
        <div>
          <p class="company-the">The</p>
          <h1 class="company-name">
            <span class="green">Green </span>
            <span class="tangerine">Tangerine</span>
          </h1>
          <p class="company-tagline">${e.businessType}</p>
        </div>
      </div>
      <div class="header-right">
        <p class="quote-label">Quote</p>
        <p class="quote-number">${e.quoteNumber}</p>
      </div>
    </div>

    <div class="separator">
      <div class="separator-line-left"></div>
      <div class="separator-dot"></div>
      <div class="separator-line-right"></div>
    </div>

    <div class="info-grid">
      <div>
        <p class="info-label">From</p>
        <p class="info-name">${e.fromName}</p>
        <p class="info-trading">Trading as ${e.tradingAs}</p>
        <p class="info-website">${e.website}</p>
      </div>
      <div>
        <p class="info-label">To</p>
        <p class="info-name">${e.toCompany}</p>
        ${data.toContact ? `<p class="info-contact">${e.toContact}</p>` : ''}
        <p class="info-address">${addressHtml}</p>
        ${data.toEmail ? `<p class="info-detail">${e.toEmail}</p>` : ''}
        ${data.toPhone ? `<p class="info-detail">${e.toPhone}</p>` : ''}
      </div>
      <div>
        <p class="info-label">Details</p>
        <div>
          <div class="details-row">
            <span class="details-label">Date</span>
            <span class="details-value">${data.quoteDate}</span>
          </div>
          <div class="details-row">
            <span class="details-label">Valid Until</span>
            <span class="details-value-valid">${data.validUntil}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="event-box">
      <p class="box-title">Event Details</p>
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

    <div class="items-table">
      <div class="items-header">
        <span>Description</span>
        <span class="items-header-qty">Qty</span>
        <span class="items-header-price">Unit Price</span>
        <span class="items-header-total">Total</span>
      </div>
      ${lineItemsHtml}
      <div class="items-summary-row">
        <span class="items-summary-label">Subtotal</span>
        <span class="items-summary-value">${fmt(data.subtotal)}</span>
      </div>
      ${discountHtml}
      <div class="items-total-row">
        <span class="items-total-label">Total</span>
        <span class="items-total-amount">${fmt(data.total)}</span>
      </div>
    </div>

    ${pliHtml}

    ${notesSection}

    <div class="terms-box">
      <p class="box-title">Terms &amp; Conditions</p>
      <p class="terms-text">${termsHtml}</p>
    </div>

    <div class="footer">
      <p class="footer-text">
        This quote is valid for ${data.validityDays} days &middot; We look forward to performing at your event
      </p>
    </div>
  </div>
</div>
</body>
</html>`;
}
