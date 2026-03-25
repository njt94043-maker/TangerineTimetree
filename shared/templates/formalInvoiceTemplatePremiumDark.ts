import type { FormalInvoiceTemplateData } from './formalInvoiceTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';
import { PRINT_CSS } from './printStyles';

export function generateFormalInvoicePremiumDarkHtml(data: FormalInvoiceTemplateData): string {
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
      <div class="item-row">
        <span class="item-desc">${htmlEscape(item.description)}</span>
        <span class="item-qty">${item.quantity}</span>
        <span class="item-price">${fmt(item.unitPrice)}</span>
        <span class="item-total">${fmt(item.lineTotal)}</span>
      </div>`).join('');

  const discountHtml = data.discountAmount > 0 ? `
      <div class="summary-row">
        <span class="summary-label">Discount</span>
        <span class="summary-value">&minus;${fmt(data.discountAmount)}</span>
      </div>` : '';

  const notesHtml = data.notes ? `
    <div class="notes-section">
      <p class="section-label">Notes</p>
      <p class="notes-text">${e.notes.replace(/\n/g, '<br>')}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${data.invoiceNumber} — The Green Tangerine</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Cormorant Garamond', serif;
    color: #e8e8e8;
    font-size: 14px;
    line-height: 1.5;
  }

  .page {
    background: #1a1a2e;
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
    background: radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 70%);
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

  .company-name-green {
    color: #3d8c1e;
  }

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
    background: linear-gradient(90deg, transparent, #444);
  }

  .gradient-line-right {
    height: 1px;
    width: 60px;
    background: linear-gradient(90deg, #444, transparent);
  }

  .logo-container {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    overflow: hidden;
  }

  .logo-container svg {
    width: 60px;
    height: 60px;
    display: block;
  }

  .invoice-bar {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 36px;
    padding-bottom: 28px;
    border-bottom: 1px solid #2a2a3e;
  }

  .invoice-label {
    font-family: 'Cormorant Garamond', serif;
    font-size: 11px;
    letter-spacing: 5px;
    text-transform: uppercase;
    color: #d4af37;
    margin: 0;
    font-weight: 600;
  }

  .invoice-number {
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
    color: #555;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .date-value {
    color: #999;
  }

  .date-value-due {
    color: #d4af37;
  }

  .parties-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    margin-bottom: 28px;
  }

  .section-label {
    font-size: 10px;
    letter-spacing: 3px;
    color: #d4af37;
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
    color: #888;
    margin: 2px 0;
    font-style: italic;
  }

  .party-website {
    font-size: 12px;
    color: #666;
    margin: 8px 0 0 0;
  }

  .party-address {
    font-size: 14px;
    color: #888;
    margin: 2px 0;
    white-space: pre-line;
  }

  .party-contact {
    font-size: 14px;
    color: #999;
    margin: 2px 0;
  }

  .event-section {
    margin-bottom: 28px;
    padding: 16px 20px;
    background: rgba(212,175,55,0.04);
    border: 1px solid #2a2a3e;
    border-radius: 4px;
  }

  .event-row {
    font-size: 13px;
    margin-bottom: 4px;
  }

  .event-field-label {
    color: #666;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .event-field-value {
    color: #ccc;
  }

  .items-section {
    margin-bottom: 24px;
  }

  .items-header {
    display: grid;
    grid-template-columns: 3fr 0.7fr 1fr 1fr;
    padding: 10px 0;
    border-bottom: 1px solid #2a2a3e;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #555;
    font-weight: 600;
  }

  .items-header-qty { text-align: center; }
  .items-header-price { text-align: right; }
  .items-header-total { text-align: right; }

  .item-row {
    display: grid;
    grid-template-columns: 3fr 0.7fr 1fr 1fr;
    padding: 14px 0;
    border-bottom: 1px solid #1e1e32;
  }

  .item-desc {
    font-size: 15px;
    color: #bbb;
  }

  .item-qty {
    font-size: 14px;
    color: #999;
    text-align: center;
  }

  .item-price {
    font-size: 14px;
    color: #999;
    text-align: right;
  }

  .item-total {
    font-size: 15px;
    color: #fff;
    text-align: right;
    font-weight: 600;
  }

  .summary-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 28px;
  }

  .summary-block {
    min-width: 260px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 14px;
  }

  .summary-label {
    color: #666;
  }

  .summary-value {
    color: #ccc;
    font-weight: 600;
  }

  .total-block {
    border-top: 2px solid #d4af37;
    padding-top: 14px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 6px;
  }

  .total-label {
    font-size: 10px;
    letter-spacing: 4px;
    color: #666;
    text-transform: uppercase;
    margin: 0;
  }

  .total-amount {
    font-family: 'Playfair Display', serif;
    font-size: 36px;
    color: #fff;
    margin: 0;
    font-weight: 400;
    font-style: italic;
  }

  .notes-section {
    margin-bottom: 24px;
    padding: 14px 20px;
    background: rgba(255,255,255,0.02);
    border: 1px solid #2a2a3e;
    border-radius: 4px;
  }

  .notes-text {
    font-size: 13px;
    color: #888;
    line-height: 1.6;
  }

  .payment-section {
    border-top: 1px solid #2a2a3e;
    padding-top: 24px;
  }

  .payment-label {
    font-size: 10px;
    letter-spacing: 3px;
    color: #555;
    text-transform: uppercase;
    margin: 0 0 14px 0;
    font-weight: 600;
  }

  .payment-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 20px;
  }

  .payment-field-label {
    font-size: 9px;
    color: #444;
    margin: 0 0 4px 0;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .payment-field-value {
    font-size: 13px;
    color: #999;
    margin: 0;
  }

  .footer {
    margin-top: 36px;
    text-align: center;
  }

  .footer-text {
    font-size: 12px;
    color: #3a3a4e;
    font-style: italic;
  }

  .footer-website {
    font-size: 11px;
    color: #d4af37;
    letter-spacing: 2px;
    margin-top: 6px;
  }
  .payment-value-mono { font-family: 'JetBrains Mono', monospace; letter-spacing: 1px; }
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

    <div class="invoice-bar">
      <p class="invoice-label">Invoice</p>
      <span class="invoice-number">${data.invoiceNumber}</span>
    </div>
  </div>

  <div class="body-area">
    <div class="dates-row">
      <div>
        <span class="date-label">Issued </span>
        <span class="date-value">${data.issueDate}</span>
      </div>
      <div>
        <span class="date-label">Due </span>
        <span class="date-value-due">${data.dueDate}</span>
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
        <p class="section-label">Bill To</p>
        <p class="party-name">${e.toCompany}</p>
        ${data.toContact ? `<p class="party-contact">${e.toContact}</p>` : ''}
        <p class="party-address">${addressHtml}</p>
      </div>
    </div>

    <div class="event-section">
      <p class="section-label">Event Details</p>
      <div class="event-row"><span class="event-field-label">Venue: </span><span class="event-field-value">${e.venueName}</span></div>
      <div class="event-row"><span class="event-field-label">Event Date: </span><span class="event-field-value">${data.eventDate}</span></div>
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
          <p class="total-label">Total Due</p>
          <p class="total-amount">${fmt(data.total)}</p>
        </div>
      </div>
    </div>

    ${notesHtml}

    <div class="payment-section">
      <p class="payment-label">Payment Details</p>
      <div class="payment-grid">
        <div>
          <p class="payment-field-label">Account Name</p>
          <p class="payment-field-value">${e.bankAccountName}</p>
        </div>
        <div>
          <p class="payment-field-label">Bank</p>
          <p class="payment-field-value">${e.bankName}</p>
        </div>
        <div>
          <p class="payment-field-label">Sort Code</p>
          <p class="payment-field-value"><span class="payment-value-mono">${e.bankSortCode}</span></p>
        </div>
        <div>
          <p class="payment-field-label">Account No.</p>
          <p class="payment-field-value"><span class="payment-value-mono">${e.bankAccountNumber}</span></p>
        </div>
      </div>
    </div>

    <div class="footer">
      <p class="footer-text">Payment due within ${data.paymentTermsDays} days &middot; Thank you for your business</p>
      <p class="footer-website">${e.website}</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
