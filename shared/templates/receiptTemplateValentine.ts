import type { ReceiptTemplateData } from './receiptTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';
import { PRINT_CSS } from './printStyles';

export function generateReceiptValentineHtml(data: ReceiptTemplateData): string {
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
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lora:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Lora', serif;
    color: #3a2028;
    font-size: 14px;
    line-height: 1.5;
    background: #faf5f0;
  }

  .page {
    background: #faf5f0;
    color: #3a2028;
    min-height: 100%;
    position: relative;
    overflow: hidden;
  }

  /* Warm linen texture */
  .linen {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(0deg, #ede3d8 0.5px, transparent 0.5px),
      linear-gradient(90deg, #ede3d8 0.5px, transparent 0.5px),
      radial-gradient(ellipse, #e8ddd2 0.4px, transparent 0.4px);
    background-size: 4px 4px, 4px 4px, 7px 7px;
    background-position: 0 0, 0 0, 2px 3px;
    opacity: 0.4;
  }

  /* ---- SVG DECORATIONS ---- */
  .heart-cluster-tr {
    position: absolute;
    top: -10px;
    right: -10px;
    width: 100px;
    height: 100px;
    z-index: 0;
  }

  .rose-bl {
    position: absolute;
    bottom: 80px;
    left: 16px;
    opacity: 0.4;
    z-index: 0;
  }

  .scattered-heart-1 {
    position: absolute;
    top: 120px;
    left: 30px;
    opacity: 0.2;
    z-index: 0;
  }

  .scattered-heart-2 {
    position: absolute;
    bottom: 140px;
    right: 50px;
    opacity: 0.15;
    z-index: 0;
  }

  .scattered-heart-3 {
    position: absolute;
    top: 240px;
    right: 30px;
    opacity: 0.18;
    z-index: 0;
  }

  /* ---- ACCENT BARS ---- */
  .rose-bar {
    height: 4px;
    background: linear-gradient(90deg, #d4a0a0, #b45064, #d4a0a0);
  }

  .rose-bar-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #d4a0a0, #b45064, #d4a0a0);
  }

  /* ---- HEADER ---- */
  .header {
    padding: 32px 40px 28px;
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
    border: 2px solid rgba(180, 80, 100, 0.13);
  }

  .header-title {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    font-weight: 700;
    color: #8a3048;
    font-style: italic;
    line-height: 1;
  }

  .header-subtitle {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #b49898;
    font-weight: 500;
    margin-top: 2px;
  }

  .header-watermark {
    font-family: 'Playfair Display', serif;
    font-size: 48px;
    font-style: italic;
    color: rgba(180, 80, 100, 0.06);
    letter-spacing: 8px;
    pointer-events: none;
  }

  /* ---- HEART LINE DIVIDER ---- */
  .heart-divider {
    padding: 0 40px;
    position: relative;
    z-index: 1;
  }

  /* ---- BODY ---- */
  .body {
    padding: 28px 40px 36px;
    position: relative;
    z-index: 1;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 18px;
    border-bottom: 1px solid #e4d4cc;
  }

  .ref-badge {
    font-family: 'Playfair Display', serif;
    background: linear-gradient(135deg, #3a1828, #4a2038);
    color: #faf5f0;
    padding: 4px 14px;
    font-size: 16px;
    font-style: italic;
    letter-spacing: 2px;
    border-radius: 4px;
  }

  .date-text {
    font-size: 11px;
    color: #5a3040;
  }

  .date-label {
    color: #b49898;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 9px;
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
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #8a3048;
    margin: 0 0 8px 0;
    font-weight: 700;
  }

  .party-name {
    font-size: 14px;
    font-weight: 600;
    color: #3a2028;
    margin: 0;
  }

  /* ---- FOR SECTION ---- */
  .for-section {
    background: #f5ede8;
    border: 1px solid #e4d4cc;
    border-radius: 8px;
    padding: 18px 20px;
    margin-bottom: 24px;
  }

  .for-title {
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #b49898;
    font-weight: 700;
    margin: 0 0 10px 0;
  }

  .for-text {
    font-size: 12px;
    color: #5a3040;
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
    background: linear-gradient(135deg, #3a1828, #4a2038);
    padding: 14px 32px;
    border-radius: 8px;
  }

  .total-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #d4a0a0;
  }

  .total-value {
    font-family: 'Playfair Display', serif;
    font-size: 34px;
    font-weight: 700;
    color: #faf5f0;
    font-style: italic;
  }

  /* ---- FOOTER ---- */
  .footer {
    text-align: center;
  }

  .footer-msg {
    font-size: 10px;
    color: #b49898;
    letter-spacing: 1px;
    font-style: italic;
  }

  .footer-web {
    font-size: 9px;
    color: #d4c4bc;
    margin-top: 6px;
  }
  ${PRINT_CSS}
</style>
</head>
<body>
<div class="page">
  <div class="linen"></div>

  <!-- Heart cluster top-right (reduced size for receipt) -->
  <svg class="heart-cluster-tr" viewBox="0 0 100 100" fill="none">
    <path d="M50 85 C50 85, 15 55, 15 35 C15 22, 28 15, 38 20 C44 23, 48 28, 50 34 C52 28, 56 23, 62 20 C72 15, 85 22, 85 35 C85 55, 50 85, 50 85Z" fill="#b45064" opacity="0.2"/>
    <path d="M72 30 C72 30, 58 18, 58 10 C58 5, 63 2, 67 4 C69 5, 71 7, 72 9 C73 7, 75 5, 77 4 C81 2, 86 5, 86 10 C86 18, 72 30, 72 30Z" fill="#d4788a" opacity="0.3"/>
  </svg>

  <!-- Rose bottom-left -->
  <svg class="rose-bl" width="28" height="39" viewBox="0 0 40 56" fill="none">
    <path d="M20,28 C20,34 19,42 20,54" stroke="#5a7a4a" stroke-width="1.8" opacity="0.45"/>
    <path d="M20,40 C16,37 11,36 8,38 C11,40 16,40 20,40Z" fill="#5a7a4a" opacity="0.35"/>
    <path d="M20,40 L11,37" stroke="#4a6a3a" stroke-width="0.5" opacity="0.3"/>
    <path d="M20,10 C12,12 6,18 8,24 C9,27 13,28 16,26 C12,24 11,20 14,16Z" fill="#9a3050" opacity="0.3"/>
    <path d="M20,10 C28,12 34,18 32,24 C31,27 27,28 24,26 C28,24 29,20 26,16Z" fill="#8a2840" opacity="0.3"/>
    <path d="M20,12 C15,14 11,19 13,23 C15,25 18,24 18,21 C17,18 17,15 19,13Z" fill="#b45064" opacity="0.35"/>
    <path d="M20,12 C25,14 29,19 27,23 C25,25 22,24 22,21 C23,18 23,15 21,13Z" fill="#a84058" opacity="0.35"/>
    <path d="M20,15 C18,16 16.5,18 17.5,20 C18.5,21.5 20,21 20.5,19.5 C21,18 20.5,16 20,15Z" fill="#c4607a" opacity="0.45"/>
    <path d="M20,15 C22,16 23.5,18 22.5,20 C21.5,21.5 20,21 19.5,19.5 C19,18 19.5,16 20,15Z" fill="#d4708a" opacity="0.35"/>
    <circle cx="20" cy="18" r="1.5" fill="#d4788a" opacity="0.4"/>
  </svg>

  <!-- Scattered hearts -->
  <svg class="scattered-heart-1" width="12" height="12" viewBox="0 0 16 16"><path d="M8 14 C8 14, 2 9, 2 5 C2 3, 4 1, 6 2.5 C7 3, 7.5 4, 8 5 C8.5 4, 9 3, 10 2.5 C12 1, 14 3, 14 5 C14 9, 8 14, 8 14Z" fill="#b45064"/></svg>
  <svg class="scattered-heart-2" width="10" height="10" viewBox="0 0 16 16"><path d="M8 14 C8 14, 2 9, 2 5 C2 3, 4 1, 6 2.5 C7 3, 7.5 4, 8 5 C8.5 4, 9 3, 10 2.5 C12 1, 14 3, 14 5 C14 9, 8 14, 8 14Z" fill="#c4607a"/></svg>
  <svg class="scattered-heart-3" width="9" height="9" viewBox="0 0 16 16"><path d="M8 14 C8 14, 2 9, 2 5 C2 3, 4 1, 6 2.5 C7 3, 7.5 4, 8 5 C8.5 4, 9 3, 10 2.5 C12 1, 14 3, 14 5 C14 9, 8 14, 8 14Z" fill="#d4788a"/></svg>

  <!-- Top accent bar -->
  <div class="rose-bar"></div>

  <!-- Header -->
  <div class="header">
    <div class="header-content">
      <div class="header-left">
        <div class="logo-wrap">${TGT_LOGO_SVG}</div>
        <div>
          <p class="header-title">Receipt</p>
          <p class="header-subtitle">Payment Confirmation</p>
        </div>
      </div>
      <p class="header-watermark">RECEIPT</p>
    </div>
  </div>

  <!-- Heart line divider -->
  <div class="heart-divider">
    <svg width="100%" height="20" viewBox="0 0 400 20" fill="none" preserveAspectRatio="none">
      <line x1="0" y1="10" x2="170" y2="10" stroke="#d4baba" stroke-width="0.5" opacity="0.5"/>
      <path d="M190 10 C190 10, 185 5, 185 3 C185 1, 187 0, 188 1 C189 1.5, 189.5 2, 190 3 C190.5 2, 191 1.5, 192 1 C193 0, 195 1, 195 3 C195 5, 190 10, 190 10Z" fill="#b45064" opacity="0.4"/>
      <line x1="210" y1="10" x2="400" y2="10" stroke="#d4baba" stroke-width="0.5" opacity="0.5"/>
    </svg>
  </div>

  <!-- Body -->
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
      <p class="footer-msg">This receipt confirms payment has been made &#9829;</p>
      <p class="footer-web">${e.website}</p>
    </div>
  </div>

  <div class="rose-bar-bottom"></div>
</div>
</body>
</html>`;
}
