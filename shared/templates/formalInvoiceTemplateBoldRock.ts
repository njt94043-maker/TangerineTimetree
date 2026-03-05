import type { FormalInvoiceTemplateData } from './formalInvoiceTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';

export function generateFormalInvoiceBoldRockHtml(data: FormalInvoiceTemplateData): string {
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
    <div class="notes-box">
      <p class="notes-title">Notes</p>
      <p class="notes-text">${e.notes.replace(/\n/g, '<br>')}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Bebas+Neue&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
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
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(255,255,255,0.008) 3px,
      rgba(255,255,255,0.008) 4px
    );
    pointer-events: none;
    z-index: 0;
  }

  .header {
    background: linear-gradient(160deg, #111, #222 40%, #1a1a1a 70%, #111);
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
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 8px,
      rgba(255,140,0,0.04) 8px,
      rgba(255,140,0,0.04) 10px
    );
    pointer-events: none;
  }

  .header-content {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-title {
    font-family: 'Oswald', sans-serif;
    font-size: 48px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 6px;
    background: linear-gradient(180deg, #FFa833 0%, #FF7700 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(2px 2px 0 rgba(0,0,0,0.3));
  }

  .header-logo-block {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-logo {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .header-band {
    font-family: 'Oswald', sans-serif;
    font-size: 14px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
  }

  .header-invoice-watermark {
    position: absolute;
    top: 50%;
    right: 30px;
    transform: translateY(-50%) rotate(-90deg);
    font-family: 'Bebas Neue', sans-serif;
    font-size: 72px;
    color: rgba(255,255,255,0.03);
    letter-spacing: 12px;
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

  .invoice-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 18px;
    border-bottom: 2px solid #1a1a1a;
  }

  .invoice-number-badge {
    font-family: 'Bebas Neue', sans-serif;
    background: #FF8C00;
    color: #000;
    padding: 4px 14px;
    font-size: 18px;
    letter-spacing: 3px;
  }

  .invoice-dates {
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
  .date-value-due { color: #FF8C00; font-weight: 700; }

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
    color: #FF8C00;
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

  .event-bar {
    display: flex;
    gap: 28px;
    margin-bottom: 24px;
    padding: 12px 16px;
    background: #151515;
    border: 1px solid #252525;
    font-family: 'Syne', sans-serif;
  }

  .event-field-label {
    font-size: 8px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #555;
    display: block;
    margin-bottom: 2px;
  }

  .event-field-value {
    font-size: 12px;
    color: #ccc;
    font-weight: 600;
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

  .summary-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 24px;
  }

  .summary-block { min-width: 260px; }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 13px;
  }

  .summary-label { color: #555; }
  .summary-value { color: #ccc; font-weight: 600; }

  .total-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    background: linear-gradient(135deg, #FF8C00, #e67a00);
    padding: 14px 24px;
    margin-top: 6px;
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

  .notes-box {
    background: #151515;
    border: 1px solid #252525;
    padding: 14px 18px;
    margin-bottom: 20px;
    font-family: 'Syne', sans-serif;
  }

  .notes-title {
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #FF8C00;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .notes-text {
    font-size: 11px;
    color: #888;
    line-height: 1.6;
  }

  .payment-box {
    background: #151515;
    border: 1px solid #252525;
    padding: 18px 20px;
    margin-bottom: 20px;
    font-family: 'Syne', sans-serif;
  }

  .payment-title {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #FF8C00;
    font-weight: 700;
    margin: 0 0 12px 0;
  }

  .payment-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
    font-size: 11px;
  }

  .payment-field-label {
    color: #444;
    margin: 0 0 4px 0;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .payment-field-value {
    margin: 0;
    color: #aaa;
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

  <div class="header">
    <div class="header-stripe-overlay"></div>
    <div class="header-content">
      <div class="header-title">INVOICE</div>
      <div class="header-logo-block">
        <div class="header-logo">${TGT_LOGO_SVG}</div>
        <div class="header-band">${e.tradingAs}</div>
      </div>
    </div>
    <p class="header-invoice-watermark">INVOICE</p>
  </div>

  <div class="orange-stripe"></div>

  <div class="body">
    <div class="invoice-meta-row">
      <span class="invoice-number-badge">${data.invoiceNumber}</span>
      <div class="invoice-dates">
        <div>
          <span class="date-label">Issued </span>
          <span class="date-value">${data.issueDate}</span>
        </div>
        <div>
          <span class="date-label">Due </span>
          <span class="date-value-due">${data.dueDate}</span>
        </div>
      </div>
    </div>

    <div class="parties">
      <div>
        <p class="party-label">From</p>
        <p class="party-name">${e.fromName}</p>
        <p class="party-detail">Trading as: ${e.tradingAs}</p>
        <p class="party-detail">${e.businessType}</p>
        <p class="party-website">${e.website}</p>
      </div>
      <div>
        <p class="party-label">Bill To</p>
        <p class="party-name">${e.toCompany}</p>
        ${data.toContact ? `<p class="party-detail">${e.toContact}</p>` : ''}
        <p class="party-address">${addressHtml}</p>
      </div>
    </div>

    <div class="event-bar">
      <div>
        <span class="event-field-label">Venue</span>
        <span class="event-field-value">${e.venueName}</span>
      </div>
      <div>
        <span class="event-field-label">Event Date</span>
        <span class="event-field-value">${data.eventDate}</span>
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
        <div class="total-box">
          <span class="total-label">Total</span>
          <span class="total-value">${fmt(data.total)}</span>
        </div>
      </div>
    </div>

    ${notesHtml}

    <div class="payment-box">
      <p class="payment-title">Payment Details</p>
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
          <p class="payment-field-value">${e.bankSortCode}</p>
        </div>
        <div>
          <p class="payment-field-label">Account No.</p>
          <p class="payment-field-value">${e.bankAccountNumber}</p>
        </div>
      </div>
    </div>

    <div class="footer">
      <p class="footer-terms">Payment due within ${data.paymentTermsDays} days &middot; Thank you for your business</p>
      <p class="footer-slogan">KEEP IT GREEN &#127818;</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
