import type { ReceiptTemplateData } from './receiptTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';
import { PRINT_CSS } from './printStyles';

export function generateReceiptHalloweenHtml(data: ReceiptTemplateData): string {
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
<title>Receipt for ${data.paidTo} — The Green Tangerine</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Space Grotesk', sans-serif;
    color: #e0d8cc;
    font-size: 14px;
    line-height: 1.5;
    background: #111014;
  }

  .page {
    background: #111014;
    color: #e0d8cc;
    min-height: 100%;
    position: relative;
    overflow: hidden;
  }

  /* Dark grunge texture */
  .grunge {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      radial-gradient(ellipse, #1c181e 0.7px, transparent 0.7px),
      radial-gradient(ellipse, #0d0a0f 0.4px, transparent 0.4px),
      radial-gradient(ellipse, #201a1c 0.3px, transparent 0.3px);
    background-size: 13px 13px, 9px 9px, 5px 5px;
    background-position: 0 0, 4px 6px, 8px 3px;
    opacity: 0.5;
    z-index: 0;
  }

  /* Ember glow at top */
  .ember-glow {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 200px;
    background: radial-gradient(ellipse at 50% -20%, rgba(204,85,0,0.15), transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  /* Left ember strip */
  .ember-strip {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    background: linear-gradient(180deg, #cc5500, #e8940a, #cc5500, #8a3a00, #cc5500, #e8940a);
    z-index: 1;
  }

  /* ---- SVG DECORATIONS ---- */
  .pumpkin-bottom-right {
    position: absolute;
    bottom: 30px;
    right: 40px;
    opacity: 0.35;
    z-index: 0;
  }

  .bat-top-right {
    position: absolute;
    top: 24px;
    right: 80px;
    z-index: 0;
  }

  .bat-top-left {
    position: absolute;
    top: 60px;
    left: 60px;
    z-index: 0;
  }

  .candle-bottom-left {
    position: absolute;
    bottom: 30px;
    left: 44px;
    width: 12px;
    height: 30px;
    opacity: 0.6;
    z-index: 0;
  }

  /* ---- HEADER ---- */
  .header {
    padding: 32px 40px 28px 50px;
    position: relative;
    z-index: 1;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .logo-wrap {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid rgba(204,85,0,0.27);
  }

  .header-title {
    font-family: 'Syne', sans-serif;
    font-size: 28px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.5px;
    color: #e8940a;
    line-height: 1;
  }

  .header-subtitle {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #6a5a44;
    font-weight: 500;
    margin-top: 2px;
  }

  .header-watermark {
    font-family: 'Syne', sans-serif;
    font-size: 48px;
    font-weight: 800;
    color: rgba(232,148,10,0.04);
    letter-spacing: 8px;
    pointer-events: none;
  }

  /* ---- DIVIDER ---- */
  .divider {
    padding: 0 40px 0 50px;
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    z-index: 1;
  }

  .divider-line-left {
    flex: 1;
    height: 2px;
    background: linear-gradient(90deg, #cc5500, transparent);
  }

  .divider-line-right {
    flex: 1;
    height: 2px;
    background: linear-gradient(90deg, transparent, #cc5500);
  }

  .divider-slash {
    font-size: 16px;
    font-weight: 800;
  }

  .divider-slash-orange { color: #cc5500; }
  .divider-slash-amber { color: #e8940a; }

  /* ---- BODY ---- */
  .body {
    padding: 28px 40px 36px 50px;
    position: relative;
    z-index: 1;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 18px;
    border-bottom: 2px solid #2a2226;
  }

  .ref-badge {
    font-size: 16px;
    font-weight: 700;
    background: #e8940a;
    color: #111014;
    padding: 4px 14px;
    letter-spacing: 2px;
  }

  .date-text {
    font-size: 11px;
    color: #c4b8a4;
  }

  .date-label {
    color: #5a4a34;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 9px;
    font-weight: 700;
  }

  /* ---- PARTIES ---- */
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-bottom: 28px;
  }

  .party-label {
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #cc5500;
    margin: 0 0 8px 0;
    font-weight: 700;
  }

  .party-name {
    font-size: 14px;
    font-weight: 700;
    color: #e8940a;
    margin: 0;
  }

  /* ---- FOR SECTION ---- */
  .for-section {
    background: #1a1618;
    border: 1px solid #2a2226;
    border-left: 3px solid #cc5500;
    border-radius: 0 6px 6px 0;
    padding: 18px 20px;
    margin-bottom: 24px;
  }

  .for-title {
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #5a4a34;
    font-weight: 700;
    margin: 0 0 10px 0;
  }

  .for-text {
    font-size: 12px;
    color: #c4b8a4;
  }

  /* ---- TOTAL ---- */
  .total-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 28px;
  }

  .total-box {
    display: flex;
    align-items: center;
    gap: 20px;
    background: linear-gradient(135deg, #1a0d00, #261400);
    border: 1px solid #3a2200;
    padding: 14px 32px;
    border-radius: 6px;
  }

  .total-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #cc5500;
  }

  .total-value {
    font-family: 'Syne', sans-serif;
    font-size: 34px;
    font-weight: 800;
    color: #e8940a;
  }

  /* ---- FOOTER ---- */
  .footer {
    text-align: center;
  }

  .footer-msg {
    font-size: 10px;
    color: #6a5a44;
    letter-spacing: 1px;
  }

  .footer-website {
    font-size: 9px;
    color: #3a3028;
    margin-top: 6px;
  }
  ${PRINT_CSS}
</style>
</head>
<body>
<div class="page">
  <div class="grunge"></div>
  <div class="ember-glow"></div>
  <div class="ember-strip"></div>

  <!-- Pumpkin: bottom-right 28px -->
  <div class="pumpkin-bottom-right">
    <svg width="28" height="28" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M23,12 C23,8 25,5 28,4 C26,5 25,8 25,11" stroke="#5a7a34" stroke-width="2" fill="none" opacity="0.8"/>
      <ellipse cx="25" cy="30" rx="18" ry="15" fill="#e06600" opacity="0.6"/>
      <ellipse cx="18" cy="30" rx="8" ry="15" fill="#c45500" opacity="0.25"/>
      <ellipse cx="32" cy="30" rx="8" ry="15" fill="#c45500" opacity="0.25"/>
      <ellipse cx="25" cy="30" rx="6" ry="15" fill="#f07000" opacity="0.2"/>
      <polygon points="16,26 19,22 22,27" fill="#1a0d00" opacity="0.65"/>
      <polygon points="28,26 31,22 34,27" fill="#1a0d00" opacity="0.65"/>
      <path d="M18,34 C20,38 30,38 32,34 C30,36 20,36 18,34Z" fill="#1a0d00" opacity="0.6"/>
      <ellipse cx="19" cy="24" rx="5" ry="8" fill="white" opacity="0.08" transform="rotate(-10 19 24)"/>
    </svg>
  </div>

  <!-- Bat 1: top-right 28px, color #4a3e34 -->
  <div class="bat-top-right">
    <svg width="28" height="17" viewBox="0 0 50 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 14 C22 8, 14 3, 2 5 C6 8, 8 10, 10 14 C8 12, 5 11, 2 12 C6 14, 10 16, 14 16 C10 18, 8 22, 6 26 C12 22, 16 18, 20 16 L25 20 L30 16 C34 18, 38 22, 44 26 C42 22, 40 18, 36 16 C40 16, 44 14, 48 12 C45 11, 42 12, 40 14 C42 10, 44 8, 48 5 C36 3, 28 8, 25 14Z" fill="#4a3e34" opacity="0.4"/>
      <circle cx="22" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
      <circle cx="28" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
    </svg>
  </div>

  <!-- Bat 2: top-left 20px, color #3a3030 -->
  <div class="bat-top-left">
    <svg width="20" height="12" viewBox="0 0 50 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 14 C22 8, 14 3, 2 5 C6 8, 8 10, 10 14 C8 12, 5 11, 2 12 C6 14, 10 16, 14 16 C10 18, 8 22, 6 26 C12 22, 16 18, 20 16 L25 20 L30 16 C34 18, 38 22, 44 26 C42 22, 40 18, 36 16 C40 16, 44 14, 48 12 C45 11, 42 12, 40 14 C42 10, 44 8, 48 5 C36 3, 28 8, 25 14Z" fill="#3a3030" opacity="0.4"/>
      <circle cx="22" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
      <circle cx="28" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
    </svg>
  </div>

  <!-- Candle: bottom-left -->
  <div class="candle-bottom-left">
    <svg viewBox="0 0 20 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 6 C12 10, 14 14, 12 18 C11 20, 9 20, 8 18 C6 14, 8 10, 10 6Z" fill="#e8940a" opacity="0.5"/>
      <path d="M10 9 C11 12, 12 14, 11 17 C10.5 18, 9.5 18, 9 17 C8 14, 9 12, 10 9Z" fill="#ffcc44" opacity="0.4"/>
      <rect x="7" y="18" width="6" height="28" rx="1" fill="#d4c4a0" opacity="0.35"/>
      <ellipse cx="10" cy="18" rx="4" ry="2" fill="#e8d4b0" opacity="0.3"/>
      <path d="M12 22 C13 24, 13 28, 12.5 30" stroke="#d4c4a0" stroke-width="1.5" fill="none" opacity="0.3"/>
    </svg>
  </div>

  <!-- HEADER -->
  <div class="header">
    <div class="header-content">
      <div class="header-left">
        <div class="logo-wrap">${TGT_LOGO_SVG}</div>
        <div>
          <p class="header-title">RECEIPT</p>
          <p class="header-subtitle">Payment Confirmation</p>
        </div>
      </div>
      <p class="header-watermark">RECEIPT</p>
    </div>
  </div>

  <!-- DIVIDER -->
  <div class="divider">
    <div class="divider-line-left"></div>
    <span class="divider-slash divider-slash-orange">/</span>
    <span class="divider-slash divider-slash-amber">/</span>
    <span class="divider-slash divider-slash-orange">/</span>
    <div class="divider-line-right"></div>
  </div>

  <!-- BODY -->
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
      <p class="footer-msg">This receipt confirms payment has been made &#128293;</p>
      <p class="footer-website">${e.website}</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
