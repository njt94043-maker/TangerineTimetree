import type { InvoiceTemplateData } from './invoiceTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';
import { PRINT_CSS } from './printStyles';

export function generateCleanProfessionalHtml(data: InvoiceTemplateData): string {
  const amt = `\u00a3${data.amount.toFixed(2)}`;
  const addressHtml = htmlEscape(data.toAddress).replace(/\n/g, '<br>');
  const e = {
    fromName: htmlEscape(data.fromName),
    tradingAs: htmlEscape(data.tradingAs),
    businessType: htmlEscape(data.businessType),
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
<title>Invoice ${data.invoiceNumber} — The Green Tangerine</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
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

  /* Top gradient stripe */
  .top-stripe {
    height: 6px;
    background: linear-gradient(90deg, #2D5016, #3d8c1e, #FF8C00, #FFa833, #FF8C00, #3d8c1e, #2D5016);
  }

  .content {
    padding: 44px 48px;
  }

  /* Header: logo + company name left, invoice number right */
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

  .company-name .green {
    color: #2D5016;
  }

  .company-name .tangerine {
    color: #d4740e;
  }

  .company-tagline {
    font-family: 'Libre Baskerville', serif;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #b5a998;
    margin: 6px 0 0 2px;
  }

  .header-right {
    text-align: right;
  }

  .invoice-label {
    font-family: 'Libre Baskerville', serif;
    font-size: 10px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #c4b8a8;
    margin: 0 0 6px 0;
  }

  .invoice-number {
    font-family: 'DM Serif Display', serif;
    font-size: 24px;
    color: #2D5016;
    margin: 0;
  }

  /* Decorative wavy separator */
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

  /* Three-column grid: From / Bill To / Details */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 32px;
    margin-bottom: 36px;
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

  .details-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 12px;
  }

  .details-row:last-child {
    margin-bottom: 0;
  }

  .details-label {
    color: #aaa;
  }

  .details-value {
    color: #555;
  }

  .details-value-due {
    color: #b5542a;
    font-weight: 700;
  }

  /* Items table */
  .items-table {
    border: 1px solid #e4ddd2;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 28px;
    font-family: 'Libre Baskerville', serif;
  }

  .items-header {
    display: grid;
    grid-template-columns: 1fr 120px;
    padding: 13px 20px;
    background: #2D5016;
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.8);
    font-weight: 700;
  }

  .items-header-amount {
    text-align: right;
  }

  .items-row {
    display: grid;
    grid-template-columns: 1fr 120px;
    padding: 18px 20px;
    background: #fff;
    border-bottom: 1px solid #f0ebe3;
  }

  .items-row-desc {
    font-size: 13px;
    color: #555;
  }

  .items-row-amount {
    font-size: 14px;
    font-weight: 700;
    text-align: right;
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

  /* Payment details box */
  .payment-box {
    background: #fff;
    border: 1px solid #e4ddd2;
    border-radius: 3px;
    padding: 18px 20px;
    margin-bottom: 28px;
    font-family: 'Libre Baskerville', serif;
  }

  .payment-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #c4b8a8;
    margin: 0 0 12px 0;
    font-weight: 700;
  }

  .payment-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
    font-size: 12px;
  }

  .payment-field-label {
    color: #c4b8a8;
    margin: 0 0 4px 0;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  .payment-field-value {
    margin: 0;
    font-weight: 700;
    color: #555;
  }

  /* Footer */
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
  .payment-value-mono { font-family: 'JetBrains Mono', monospace; letter-spacing: 1px; }
  ${PRINT_CSS}
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
        <p class="invoice-label">Invoice</p>
        <p class="invoice-number">${data.invoiceNumber}</p>
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
        <p class="info-label">Bill To</p>
        <p class="info-name">${e.toCompany}</p>
        ${data.toContact ? `<p class="info-contact">${e.toContact}</p>` : ''}
        <p class="info-address">${addressHtml}</p>
      </div>
      <div>
        <p class="info-label">Details</p>
        <div>
          <div class="details-row">
            <span class="details-label">Issued</span>
            <span class="details-value">${data.issueDate}</span>
          </div>
          <div class="details-row">
            <span class="details-label">Due</span>
            <span class="details-value-due">${data.dueDate}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="items-table">
      <div class="items-header">
        <span>Description</span>
        <span class="items-header-amount">Amount</span>
      </div>
      <div class="items-row">
        <span class="items-row-desc">${e.description}</span>
        <span class="items-row-amount">${amt}</span>
      </div>
      <div class="items-total-row">
        <span class="items-total-label">Total</span>
        <span class="items-total-amount">${amt}</span>
      </div>
    </div>

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
          <p class="payment-field-value payment-value-mono">${e.bankSortCode}</p>
        </div>
        <div>
          <p class="payment-field-label">Account No.</p>
          <p class="payment-field-value payment-value-mono">${e.bankAccountNumber}</p>
        </div>
      </div>
    </div>

    <div class="footer">
      <p class="footer-text">
        Payment due within ${data.paymentTermsDays} days &middot; Thank you for your business
      </p>
    </div>
  </div>
</div>
</body>
</html>`;
}
