import type { ReceiptTemplateData } from './receiptTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';

export function generateReceiptPremiumDarkHtml(data: ReceiptTemplateData): string {
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
    background: radial-gradient(ellipse, rgba(45,107,21,0.12) 0%, transparent 70%);
    pointer-events: none;
  }

  .header-area {
    padding: 48px 48px 0 48px;
    position: relative;
  }

  .brand-block { text-align: center; margin-bottom: 12px; }

  .tagline {
    font-size: 11px;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: #555;
    margin: 0 0 8px 0;
    font-weight: 300;
  }

  .receipt-bar {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 36px;
    padding-bottom: 28px;
    border-bottom: 1px solid #1a1a1a;
  }

  .receipt-label {
    font-size: 11px;
    letter-spacing: 5px;
    text-transform: uppercase;
    color: #FF8C00;
    font-weight: 600;
  }

  .receipt-ref {
    font-size: 16px;
    color: #555;
    font-weight: 300;
    letter-spacing: 2px;
  }

  .logo-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
  }

  .gradient-line-left {
    height: 1px; width: 60px;
    background: linear-gradient(90deg, transparent, #333);
  }
  .gradient-line-right {
    height: 1px; width: 60px;
    background: linear-gradient(90deg, #333, transparent);
  }

  .logo-container {
    width: 60px; height: 60px;
    border-radius: 50%; overflow: hidden;
  }
  .logo-container svg { width: 60px; height: 60px; display: block; }

  .body-area {
    padding: 28px 48px 48px 48px;
  }

  .date-row {
    font-size: 13px;
    color: #444;
    margin-bottom: 32px;
  }
  .date-value { color: #999; }

  .section-label {
    font-size: 10px;
    letter-spacing: 3px;
    color: #3d8c1e;
    text-transform: uppercase;
    margin: 0 0 14px 0;
    font-weight: 600;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    margin-bottom: 36px;
  }

  .detail-label {
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #444;
    margin-bottom: 6px;
  }

  .detail-value {
    font-size: 16px;
    color: #fff;
    font-weight: 600;
  }

  .detail-sub {
    font-size: 14px;
    color: #666;
    margin-top: 4px;
    font-style: italic;
  }

  .amount-block {
    border-top: 2px solid #FF8C00;
    padding-top: 16px;
    text-align: center;
    margin-bottom: 40px;
  }

  .amount-label {
    font-size: 10px;
    letter-spacing: 4px;
    color: #555;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .amount-value {
    font-family: 'Playfair Display', serif;
    font-size: 42px;
    color: #fff;
    font-weight: 400;
    font-style: italic;
  }

  .for-section {
    border-top: 1px solid #1a1a1a;
    padding-top: 24px;
    margin-bottom: 36px;
  }

  .for-text {
    font-size: 14px;
    color: #bbb;
  }

  .footer {
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
</style>
</head>
<body>
<div class="page">
  <div class="radial-glow"></div>

  <div class="header-area">
    <div class="brand-block">
      <p class="tagline">Payment Receipt</p>
      <div class="logo-divider">
        <div class="gradient-line-left"></div>
        <div class="logo-container">${TGT_LOGO_SVG}</div>
        <div class="gradient-line-right"></div>
      </div>
    </div>

    <div class="receipt-bar">
      <span class="receipt-label">Receipt</span>
      <span class="receipt-ref">Ref: ${data.invoiceNumber}</span>
    </div>
  </div>

  <div class="body-area">
    <div class="date-row">
      <span>Date: </span>
      <span class="date-value">${data.receiptDate}</span>
    </div>

    <div class="detail-grid">
      <div>
        <p class="detail-label">Payment From</p>
        <p class="detail-value">${e.paidBy}</p>
      </div>
      <div>
        <p class="detail-label">Payment To</p>
        <p class="detail-value">${e.paidTo}</p>
      </div>
    </div>

    <div class="amount-block">
      <p class="amount-label">Amount Paid</p>
      <p class="amount-value">${amt}</p>
    </div>

    <div class="for-section">
      <p class="section-label">For</p>
      <p class="for-text">${e.description} at ${e.venue} on ${data.gigDate}</p>
    </div>

    <div class="footer">
      <p class="footer-text">This receipt confirms payment has been made.</p>
      <p class="footer-website">${e.website}</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
