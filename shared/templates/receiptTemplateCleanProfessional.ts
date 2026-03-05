import type { ReceiptTemplateData } from './receiptTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';

export function generateReceiptCleanProfessionalHtml(data: ReceiptTemplateData): string {
  const amt = `\u00a3${data.amount.toFixed(2)}`;
  const e = {
    paidTo: htmlEscape(data.paidTo),
    paidBy: htmlEscape(data.paidBy),
    venue: htmlEscape(data.venue),
    description: htmlEscape(data.description),
    website: htmlEscape(data.website),
  };

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

  .content {
    padding: 44px 48px;
  }

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
    width: 56px; height: 56px;
    border-radius: 50%; overflow: hidden;
  }

  .receipt-title {
    font-family: 'DM Serif Display', serif;
    font-size: 28px;
    font-weight: 400;
    color: #1a1a1a;
    margin: 0;
  }

  .receipt-subtitle {
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #b5a998;
    margin: 4px 0 0 0;
  }

  .header-right { text-align: right; }

  .ref-label {
    font-size: 10px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #c4b8a8;
    margin: 0 0 6px 0;
  }

  .ref-number {
    font-family: 'DM Serif Display', serif;
    font-size: 18px;
    color: #2D5016;
  }

  .separator {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 24px 0;
  }

  .separator-line-left {
    flex: 1; height: 1px;
    background: linear-gradient(90deg, #ddd5c8, transparent);
  }

  .separator-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #d4a574;
    opacity: 0.5;
  }

  .separator-line-right {
    flex: 1; height: 1px;
    background: linear-gradient(90deg, transparent, #ddd5c8);
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 32px;
    margin-bottom: 36px;
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

  .info-detail {
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

  .details-label { color: #aaa; }
  .details-value { color: #555; }

  .amount-table {
    border: 1px solid #e4ddd2;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 28px;
  }

  .amount-header {
    padding: 13px 20px;
    background: #2D5016;
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.8);
    font-weight: 700;
  }

  .amount-row {
    display: grid;
    grid-template-columns: 1fr 120px;
    padding: 18px 20px;
    background: #fff;
    border-bottom: 1px solid #f0ebe3;
    font-size: 13px;
  }

  .amount-row-label { color: #555; }
  .amount-row-value { text-align: right; font-weight: 700; }

  .amount-total-row {
    display: grid;
    grid-template-columns: 1fr 120px;
    padding: 18px 20px;
    background: #f9f7f3;
  }

  .amount-total-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #b5a998;
    align-self: center;
  }

  .amount-total-value {
    font-family: 'DM Serif Display', serif;
    font-size: 26px;
    text-align: right;
    color: #2D5016;
  }

  .for-box {
    background: #fff;
    border: 1px solid #e4ddd2;
    border-radius: 3px;
    padding: 18px 20px;
    margin-bottom: 28px;
  }

  .for-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #c4b8a8;
    margin: 0 0 10px 0;
    font-weight: 700;
  }

  .for-text {
    font-size: 13px;
    color: #555;
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
          <h1 class="receipt-title">Receipt</h1>
          <p class="receipt-subtitle">Payment Confirmation</p>
        </div>
      </div>
      <div class="header-right">
        <p class="ref-label">Reference</p>
        <p class="ref-number">${data.invoiceNumber}</p>
      </div>
    </div>

    <div class="separator">
      <div class="separator-line-left"></div>
      <div class="separator-dot"></div>
      <div class="separator-line-right"></div>
    </div>

    <div class="info-grid">
      <div>
        <p class="info-label">Payment From</p>
        <p class="info-name">${e.paidBy}</p>
      </div>
      <div>
        <p class="info-label">Payment To</p>
        <p class="info-name">${e.paidTo}</p>
      </div>
      <div>
        <p class="info-label">Details</p>
        <div class="details-row">
          <span class="details-label">Date</span>
          <span class="details-value">${data.receiptDate}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Venue</span>
          <span class="details-value">${e.venue}</span>
        </div>
      </div>
    </div>

    <div class="amount-table">
      <div class="amount-header">Amount Paid</div>
      <div class="amount-row">
        <span class="amount-row-label">${e.description} at ${e.venue} on ${data.gigDate}</span>
        <span class="amount-row-value">${amt}</span>
      </div>
      <div class="amount-total-row">
        <span class="amount-total-label">Total</span>
        <span class="amount-total-value">${amt}</span>
      </div>
    </div>

    <div class="footer">
      <p class="footer-text">
        This receipt confirms payment has been made &middot; ${e.website}
      </p>
    </div>
  </div>
</div>
</body>
</html>`;
}
