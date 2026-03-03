import { ReceiptTemplateData } from './receiptTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from '../utils/htmlEscape';

export function generateReceiptChristmasHtml(data: ReceiptTemplateData): string {
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
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Outfit', sans-serif;
    color: #e8e0d4;
    font-size: 14px;
    line-height: 1.5;
    background: #0d1f14;
  }

  .page {
    background: #0d1f14;
    color: #e8e0d4;
    min-height: 100%;
    position: relative;
    overflow: hidden;
  }

  /* Paper grain texture */
  .grain {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      radial-gradient(ellipse, #1a3020 0.8px, transparent 0.8px),
      radial-gradient(ellipse, #081510 0.5px, transparent 0.5px),
      radial-gradient(ellipse, #162a1c 0.3px, transparent 0.3px);
    background-size: 11px 11px, 7px 7px, 5px 5px;
    background-position: 0 0, 3px 5px, 7px 2px;
    opacity: 0.4;
  }

  /* Gold accent bars */
  .gold-bar {
    height: 4px;
    background: linear-gradient(90deg, transparent, #c9a84c, #e8c65a, #c9a84c, transparent);
  }

  .gold-bar-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, transparent, #c9a84c, #e8c65a, #c9a84c, transparent);
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
    border: 2px solid rgba(201, 168, 76, 0.2);
  }

  .header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 28px;
    font-weight: 700;
    color: #c9a84c;
    line-height: 1;
  }

  .header-subtitle {
    font-size: 9px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #8b9e87;
    font-weight: 500;
    margin-top: 2px;
  }

  .header-watermark {
    font-family: 'Cormorant Garamond', serif;
    font-size: 48px;
    color: rgba(201, 168, 76, 0.06);
    letter-spacing: 8px;
    pointer-events: none;
  }

  /* ---- ORNAMENTAL DIVIDER ---- */
  .divider {
    padding: 0 40px;
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 1;
  }

  .divider-line-l {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, #2d4a32);
  }

  .divider-line-r {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, #2d4a32, transparent);
  }

  .divider-dots {
    display: flex;
    gap: 4px;
  }

  .divider-dots span {
    font-size: 8px;
  }

  .divider-dot-red { color: #8b3a3a; }
  .divider-dot-gold { color: #c9a84c; }

  /* ---- BODY ---- */
  .body {
    padding: 28px 40px 36px;
    position: relative;
    z-index: 1;
  }

  /* Meta row */
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 18px;
    border-bottom: 1px solid #2d4a32;
  }

  .ref-badge {
    font-family: 'Cormorant Garamond', serif;
    background: #8b3a3a;
    color: #e8e0d4;
    padding: 4px 14px;
    font-size: 16px;
    letter-spacing: 2px;
    border-radius: 4px;
  }

  .date-text {
    font-size: 11px;
    color: #d4ccbc;
  }

  .date-label {
    color: #5a7a5e;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 9px;
  }

  /* Parties */
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
    color: #8b3a3a;
    margin: 0 0 8px 0;
    font-weight: 700;
  }

  .party-name {
    font-size: 14px;
    font-weight: 600;
    color: #c9a84c;
    margin: 0;
  }

  /* For section */
  .for-section {
    background: #132a1a;
    border: 1px solid #2d4a32;
    border-radius: 8px;
    padding: 18px 20px;
    margin-bottom: 24px;
  }

  .for-title {
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #5a7a5e;
    font-weight: 700;
    margin: 0 0 10px 0;
  }

  .for-text {
    font-size: 12px;
    color: #d4ccbc;
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
    background: linear-gradient(135deg, #1a0a0a, #2a1515);
    border: 1px solid #4a2020;
    padding: 14px 32px;
    border-radius: 8px;
  }

  .total-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #8b3a3a;
  }

  .total-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: 34px;
    font-weight: 700;
    color: #c9a84c;
    letter-spacing: 2px;
  }

  /* Footer */
  .footer {
    text-align: center;
  }

  .footer-msg {
    font-size: 10px;
    color: #5a7a5e;
    letter-spacing: 1px;
  }

  .footer-web {
    font-size: 9px;
    color: #3d5a42;
    margin-top: 6px;
  }
</style>
</head>
<body>
<div class="page">
  <div class="grain"></div>

  <!-- Snowflakes (reduced for receipt) -->
  <svg style="position:absolute;top:40px;right:30px;opacity:0.4;" width="16" height="16" viewBox="0 0 24 24" fill="none">
    <g stroke="#c9a84c" stroke-width="1" stroke-linecap="round" opacity="0.5">
      <line x1="12" y1="2" x2="12" y2="22"/><line x1="3.3" y1="7" x2="20.7" y2="17"/><line x1="3.3" y1="17" x2="20.7" y2="7"/>
      <line x1="12" y1="2" x2="10" y2="5"/><line x1="12" y1="2" x2="14" y2="5"/>
      <line x1="12" y1="22" x2="10" y2="19"/><line x1="12" y1="22" x2="14" y2="19"/>
      <line x1="3.3" y1="7" x2="5.8" y2="8.8"/><line x1="3.3" y1="7" x2="5" y2="5.2"/>
      <line x1="20.7" y1="7" x2="18.2" y2="8.8"/><line x1="20.7" y1="7" x2="19" y2="5.2"/>
      <line x1="3.3" y1="17" x2="5.8" y2="15.2"/><line x1="3.3" y1="17" x2="5" y2="18.8"/>
      <line x1="20.7" y1="17" x2="18.2" y2="15.2"/><line x1="20.7" y1="17" x2="19" y2="18.8"/>
    </g>
  </svg>
  <svg style="position:absolute;bottom:80px;left:30px;opacity:0.4;" width="12" height="12" viewBox="0 0 24 24" fill="none">
    <g stroke="#5a7a5e" stroke-width="1" stroke-linecap="round" opacity="0.5">
      <line x1="12" y1="2" x2="12" y2="22"/><line x1="3.3" y1="7" x2="20.7" y2="17"/><line x1="3.3" y1="17" x2="20.7" y2="7"/>
      <line x1="12" y1="2" x2="10" y2="5"/><line x1="12" y1="2" x2="14" y2="5"/>
      <line x1="12" y1="22" x2="10" y2="19"/><line x1="12" y1="22" x2="14" y2="19"/>
      <line x1="3.3" y1="7" x2="5.8" y2="8.8"/><line x1="3.3" y1="7" x2="5" y2="5.2"/>
      <line x1="20.7" y1="7" x2="18.2" y2="8.8"/><line x1="20.7" y1="7" x2="19" y2="5.2"/>
      <line x1="3.3" y1="17" x2="5.8" y2="15.2"/><line x1="3.3" y1="17" x2="5" y2="18.8"/>
      <line x1="20.7" y1="17" x2="18.2" y2="15.2"/><line x1="20.7" y1="17" x2="19" y2="18.8"/>
    </g>
  </svg>
  <svg style="position:absolute;top:140px;right:70px;opacity:0.4;" width="10" height="10" viewBox="0 0 24 24" fill="none">
    <g stroke="#5a7a5e" stroke-width="1" stroke-linecap="round" opacity="0.5">
      <line x1="12" y1="2" x2="12" y2="22"/><line x1="3.3" y1="7" x2="20.7" y2="17"/><line x1="3.3" y1="17" x2="20.7" y2="7"/>
      <line x1="12" y1="2" x2="10" y2="5"/><line x1="12" y1="2" x2="14" y2="5"/>
      <line x1="12" y1="22" x2="10" y2="19"/><line x1="12" y1="22" x2="14" y2="19"/>
    </g>
  </svg>

  <!-- Holly corner top-left -->
  <svg style="position:absolute;top:-10px;left:-10px;width:70px;height:70px;" viewBox="0 0 120 120" fill="none">
    <path d="M56,42 C54,38 52,36 48,34 C50,32 50,28 46,24 C44,20 46,16 50,12 C52,16 54,20 56,22 C58,18 60,16 60,20 C60,24 58,28 58,32 C60,34 60,38 58,42 Z" fill="#1a6b35" opacity="0.8"/>
    <path d="M56,42 Q52,28 50,12" stroke="#0f4420" stroke-width="0.6" fill="none" opacity="0.5"/>
    <path d="M60,44 C64,40 68,40 72,38 C72,42 76,42 80,40 C84,40 86,44 82,46 C80,44 76,46 74,48 C76,50 74,54 70,52 C66,50 62,48 60,46 Z" fill="#228B22" opacity="0.7"/>
    <path d="M60,44 Q72,42 82,44" stroke="#14601e" stroke-width="0.6" fill="none" opacity="0.4"/>
    <path d="M54,48 C50,52 48,56 44,60 C46,62 44,66 40,68 C38,72 42,74 46,72 C46,68 50,66 52,64 C50,68 52,70 56,68 C58,64 56,56 54,50 Z" fill="#1a6b35" opacity="0.65"/>
    <path d="M54,48 Q48,58 42,70" stroke="#0f4420" stroke-width="0.6" fill="none" opacity="0.4"/>
    <circle cx="55" cy="42" r="5.5" fill="#dc3545"/><circle cx="61" cy="44" r="5" fill="#c82333"/><circle cx="57" cy="48" r="5.2" fill="#dc3545"/>
    <circle cx="53" cy="40" r="2" fill="#ff6b6b" opacity="0.5"/><circle cx="59" cy="42" r="1.7" fill="#ff6b6b" opacity="0.5"/><circle cx="55" cy="46" r="1.8" fill="#ff6b6b" opacity="0.5"/>
    <circle cx="55" cy="42" r="0.8" fill="#a71d2a" opacity="0.3"/><circle cx="61" cy="44" r="0.7" fill="#a71d2a" opacity="0.3"/><circle cx="57" cy="48" r="0.8" fill="#a71d2a" opacity="0.3"/>
  </svg>

  <!-- Bauble — bottom-right (gold) -->
  <svg style="position:absolute;bottom:60px;right:30px;width:18px;height:24px;" viewBox="0 0 30 38" fill="none">
    <rect x="13" y="2" width="4" height="5" rx="1" fill="#c9a84c" opacity="0.6"/>
    <circle cx="15" cy="22" r="13" fill="#c9a84c" opacity="0.4"/>
    <ellipse cx="11" cy="18" rx="4" ry="6" fill="white" opacity="0.08" transform="rotate(-20 11 18)"/>
  </svg>

  <!-- Gold top bar -->
  <div class="gold-bar"></div>

  <!-- Header -->
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

  <!-- Divider -->
  <div class="divider">
    <div class="divider-line-l"></div>
    <div class="divider-dots">
      <span class="divider-dot-red">&#9679;</span>
      <span class="divider-dot-gold">&#9670;</span>
      <span class="divider-dot-red">&#9679;</span>
    </div>
    <div class="divider-line-r"></div>
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
      <p class="footer-msg">This receipt confirms payment has been made &#10022;</p>
      <p class="footer-web">${e.website}</p>
    </div>
  </div>

  <!-- Gold bottom bar -->
  <div class="gold-bar-bottom"></div>
</div>
</body>
</html>`;
}
