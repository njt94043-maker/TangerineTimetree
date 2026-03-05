import type { InvoiceTemplateData } from './invoiceTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';

export function generateBoldRockHtml(data: InvoiceTemplateData): string {
  const amt = `\u00a3${data.amount.toFixed(2)}`;
  const addressHtml = htmlEscape(data.toAddress).replace(/\n/g, '<br>');
  const e = {
    fromName: htmlEscape(data.fromName),
    tradingAs: htmlEscape(data.tradingAs),
    website: htmlEscape(data.website),
    toCompany: htmlEscape(data.toCompany),
    toContact: htmlEscape(data.toContact),
    description: htmlEscape(data.description),
    bankAccountName: htmlEscape(data.bankAccountName),
    bankName: htmlEscape(data.bankName),
    bankSortCode: htmlEscape(data.bankSortCode),
    bankAccountNumber: htmlEscape(data.bankAccountNumber),
  };

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

  /* Subtle horizontal scan-line overlay */
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

  /* ---- HEADER ---- */
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

  .header-invoice-watermark {
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

  /* ---- ORANGE DIVIDER ---- */
  .orange-stripe {
    height: 4px;
    background: linear-gradient(90deg, #FF8C00, #FFa833, #FF7700);
  }

  /* ---- BODY ---- */
  .body {
    padding: 28px 40px 36px 40px;
    position: relative;
  }

  /* Invoice number row */
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

  .date-value {
    color: #999;
  }

  .date-value-due {
    color: #FF8C00;
    font-weight: 700;
  }

  /* From / Bill To */
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-bottom: 28px;
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

  /* Items table */
  .items-section {
    margin-bottom: 24px;
    font-family: 'Syne', sans-serif;
  }

  .items-header {
    display: grid;
    grid-template-columns: 1fr 120px;
    padding: 10px 16px;
    background: #151515;
    border: 1px solid #252525;
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #555;
    font-weight: 700;
  }

  .items-header-amount {
    text-align: right;
  }

  .item-row {
    display: grid;
    grid-template-columns: 1fr 120px;
    padding: 16px;
    border-bottom: 1px solid #1a1a1a;
    border-left: 1px solid #252525;
    border-right: 1px solid #252525;
  }

  .item-description {
    font-size: 12px;
    color: #bbb;
  }

  .item-amount {
    font-size: 13px;
    font-weight: 700;
    text-align: right;
  }

  /* Total */
  .total-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 28px;
  }

  .total-box {
    display: flex;
    align-items: center;
    gap: 20px;
    background: linear-gradient(135deg, #FF8C00, #e67a00);
    padding: 14px 32px;
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

  /* Payment details */
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
    color: #3d8c1e;
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

  /* Footer */
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

    <p class="header-invoice-watermark">INVOICE</p>
  </div>

  <!-- ORANGE STRIPE DIVIDER -->
  <div class="orange-stripe"></div>

  <!-- BODY -->
  <div class="body">
    <!-- Invoice number + dates -->
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

    <!-- From / Bill To -->
    <div class="parties">
      <div>
        <p class="party-label">From</p>
        <p class="party-name">${e.fromName}</p>
        <p class="party-detail">Trading as: ${e.tradingAs}</p>
        <p class="party-website">${e.website}</p>
      </div>
      <div>
        <p class="party-label">Bill To</p>
        <p class="party-name">${e.toCompany}</p>
        ${data.toContact ? `<p class="party-detail">${e.toContact}</p>` : ''}
        <p class="party-address">${addressHtml}</p>
      </div>
    </div>

    <!-- Items table -->
    <div class="items-section">
      <div class="items-header">
        <span>Description</span>
        <span class="items-header-amount">Amount</span>
      </div>
      <div class="item-row">
        <span class="item-description">${e.description}</span>
        <span class="item-amount">${amt}</span>
      </div>
    </div>

    <!-- Total -->
    <div class="total-row">
      <div class="total-box">
        <span class="total-label">Total</span>
        <span class="total-value">${amt}</span>
      </div>
    </div>

    <!-- Payment details -->
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

    <!-- Footer -->
    <div class="footer">
      <p class="footer-terms">Payment due within ${data.paymentTermsDays} days &middot; Thank you for your business</p>
      <p class="footer-slogan">KEEP IT GREEN &#127818;</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
