import type { ReceiptTemplateData } from './receiptTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';

export function generateReceiptBoldRockHtml(data: ReceiptTemplateData): string {
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
    min-height: 100%;
    position: relative;
    overflow: hidden;
  }

  .scanlines {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 3px,
      rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px
    );
    pointer-events: none;
    z-index: 0;
  }

  .header {
    background: linear-gradient(160deg, #0f2b08, #1a4a0e 40%, #14380a 70%, #0d1f06);
    padding: 32px 40px 28px 40px;
    position: relative;
    overflow: hidden;
  }

  .header-stripe-overlay {
    position: absolute;
    top: 0; right: 0;
    width: 200px; height: 100%;
    background: repeating-linear-gradient(
      -45deg, transparent, transparent 8px,
      rgba(255,140,0,0.04) 8px, rgba(255,140,0,0.04) 10px
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

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .header-logo {
    width: 36px; height: 36px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .header-title {
    font-family: 'Archivo Black', sans-serif;
    font-size: 28px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #fff;
    line-height: 1;
  }

  .header-subtitle {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    font-weight: 500;
    margin-top: 2px;
  }

  .header-watermark {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 48px;
    color: rgba(255,255,255,0.04);
    letter-spacing: 8px;
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

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 18px;
    border-bottom: 2px solid #1a1a1a;
  }

  .ref-badge {
    font-family: 'Bebas Neue', sans-serif;
    background: #FF8C00;
    color: #000;
    padding: 4px 14px;
    font-size: 16px;
    letter-spacing: 3px;
  }

  .date-text {
    font-size: 11px;
    color: #999;
  }

  .date-label {
    color: #444;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 9px;
  }

  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-bottom: 28px;
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
    margin: 0;
  }

  .for-section {
    background: #151515;
    border: 1px solid #252525;
    padding: 18px 20px;
    margin-bottom: 24px;
  }

  .for-title {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #3d8c1e;
    font-weight: 700;
    margin: 0 0 10px 0;
  }

  .for-text {
    font-size: 12px;
    color: #bbb;
  }

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

  .footer {
    text-align: center;
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
      <div class="header-left">
        <div class="header-logo">${TGT_LOGO_SVG}</div>
        <div>
          <p class="header-title">RECEIPT</p>
          <p class="header-subtitle">Payment Confirmation</p>
        </div>
      </div>
      <p class="header-watermark">RECEIPT</p>
    </div>
  </div>

  <div class="orange-stripe"></div>

  <div class="body">
    <div class="meta-row">
      <span class="ref-badge">${data.invoiceNumber}</span>
      <div class="date-text">
        <span class="date-label">Date </span>
        <span>${data.receiptDate}</span>
      </div>
    </div>

    <div class="parties">
      <div>
        <p class="party-label">Payment From</p>
        <p class="party-name">${e.paidBy}</p>
      </div>
      <div>
        <p class="party-label">Payment To</p>
        <p class="party-name">${e.paidTo}</p>
      </div>
    </div>

    <div class="for-section">
      <p class="for-title">For</p>
      <p class="for-text">${e.description} at ${e.venue} on ${data.gigDate}</p>
    </div>

    <div class="total-row">
      <div class="total-box">
        <span class="total-label">Amount Paid</span>
        <span class="total-value">${amt}</span>
      </div>
    </div>

    <div class="footer">
      <p class="footer-terms">This receipt confirms payment has been made</p>
      <p class="footer-slogan">KEEP IT GREEN &#127818;</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
