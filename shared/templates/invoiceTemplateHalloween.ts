import type { InvoiceTemplateData } from './invoiceTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';

export function generateHalloweenHtml(data: InvoiceTemplateData): string {
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
  .pumpkin-top-right {
    position: absolute;
    top: 56px;
    right: 38px;
    z-index: 0;
  }

  .pumpkin-bottom-left {
    position: absolute;
    bottom: 30px;
    left: 100px;
    opacity: 0.5;
    z-index: 0;
  }

  .pumpkin-bottom-right {
    position: absolute;
    bottom: 180px;
    right: 30px;
    opacity: 0.35;
    z-index: 0;
  }

  .bat-1 {
    position: absolute;
    top: 30px;
    right: 140px;
    z-index: 0;
  }

  .bat-2 {
    position: absolute;
    top: 70px;
    right: 200px;
    z-index: 0;
  }

  .bat-3 {
    position: absolute;
    top: 110px;
    left: 60px;
    z-index: 0;
  }

  .spider {
    position: absolute;
    top: -4px;
    right: 100px;
    width: 28px;
    height: 36px;
    opacity: 0.7;
    z-index: 0;
  }

  .candle-1 {
    position: absolute;
    bottom: 40px;
    left: 44px;
    width: 14px;
    height: 36px;
    opacity: 0.8;
    z-index: 0;
  }

  .candle-2 {
    position: absolute;
    bottom: 40px;
    left: 64px;
    width: 11px;
    height: 30px;
    opacity: 0.6;
    z-index: 0;
  }

  .candle-3 {
    position: absolute;
    bottom: 40px;
    right: 50px;
    width: 12px;
    height: 32px;
    opacity: 0.7;
    z-index: 0;
  }

  /* ---- HEADER ---- */
  .header {
    padding: 40px 44px 24px 54px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    position: relative;
    z-index: 1;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .logo-wrap {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid rgba(204,85,0,0.27);
  }

  .header-trading-name {
    font-family: 'Syne', sans-serif;
    font-size: 30px;
    font-weight: 800;
    color: #e8940a;
    letter-spacing: -0.5px;
    line-height: 1.1;
    text-transform: uppercase;
  }

  .header-business-type {
    font-size: 10px;
    color: #6a5a44;
    margin-top: 6px;
    letter-spacing: 3px;
    text-transform: uppercase;
  }

  .header-right {
    text-align: right;
  }

  .header-invoice-label {
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    font-weight: 800;
    color: #cc5500;
    letter-spacing: 6px;
    text-transform: uppercase;
  }

  .header-invoice-number {
    font-size: 22px;
    color: #e8940a;
    font-weight: 700;
    margin-top: 4px;
  }

  /* ---- DIVIDER ---- */
  .divider {
    padding: 0 44px 0 54px;
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

  /* ---- DATES ---- */
  .dates-row {
    padding: 20px 44px 12px 54px;
    display: flex;
    gap: 32px;
    position: relative;
    z-index: 1;
  }

  .date-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #5a4a34;
    margin-bottom: 4px;
    font-weight: 700;
  }

  .date-value {
    font-size: 13px;
    color: #c4b8a4;
  }

  /* ---- FROM / BILL TO ---- */
  .parties {
    padding: 16px 44px 12px 54px;
    display: flex;
    gap: 40px;
    position: relative;
    z-index: 1;
  }

  .party-col { flex: 1; }

  .party-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #cc5500;
    margin-bottom: 10px;
    font-weight: 700;
  }

  .from-name {
    font-size: 14px;
    font-weight: 700;
    color: #e8940a;
  }

  .from-trading-as {
    font-size: 12px;
    color: #6a5a44;
    margin-top: 2px;
  }

  .from-website {
    font-size: 11px;
    color: #5a4a34;
    margin-top: 6px;
  }

  .to-company {
    font-size: 14px;
    font-weight: 700;
    color: #e0d8cc;
  }

  .to-contact {
    font-size: 12px;
    color: #9a8a74;
    margin-top: 2px;
  }

  .to-address {
    font-size: 11px;
    color: #6a5a44;
    margin-top: 6px;
    white-space: pre-line;
  }

  /* ---- DESCRIPTION BOX ---- */
  .description-section {
    padding: 20px 44px 12px 54px;
    position: relative;
    z-index: 1;
  }

  .description-box {
    background: #1a1618;
    border: 1px solid #2a2226;
    border-left: 3px solid #cc5500;
    border-radius: 0 6px 6px 0;
    padding: 18px 22px;
  }

  .description-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #5a4a34;
    margin-bottom: 10px;
    font-weight: 700;
  }

  .description-text {
    font-size: 13px;
    color: #c4b8a4;
    white-space: pre-line;
    line-height: 1.7;
  }

  /* ---- AMOUNT BOX ---- */
  .amount-section {
    padding: 12px 44px 12px 54px;
    position: relative;
    z-index: 1;
  }

  .amount-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 22px;
    background: linear-gradient(135deg, #1a0d00, #261400);
    border: 1px solid #3a2200;
    border-radius: 6px;
  }

  .amount-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #cc5500;
    font-weight: 700;
  }

  .amount-value {
    font-family: 'Syne', sans-serif;
    font-size: 34px;
    font-weight: 800;
    color: #e8940a;
  }

  /* ---- PAYMENT DETAILS ---- */
  .payment-section {
    padding: 20px 44px 12px 54px;
    position: relative;
    z-index: 1;
  }

  .payment-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #cc5500;
    margin-bottom: 12px;
    font-weight: 700;
  }

  .payment-grid {
    display: flex;
    gap: 28px;
  }

  .payment-field-label {
    font-size: 9px;
    color: #5a4a34;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .payment-field-value {
    font-size: 12px;
    color: #c4b8a4;
  }

  /* ---- FOOTER ---- */
  .footer {
    margin: 24px 44px 0 54px;
    padding: 14px 0;
    border-top: 1px solid #2a2226;
    text-align: center;
    position: relative;
    z-index: 1;
  }

  .footer-thanks {
    font-size: 10px;
    color: #6a5a44;
    letter-spacing: 1px;
  }

  .footer-website {
    font-size: 9px;
    color: #3a3028;
    margin-top: 6px;
  }
</style>
</head>
<body>
<div class="page">
  <div class="grunge"></div>
  <div class="ember-glow"></div>
  <div class="ember-strip"></div>

  <!-- Pumpkin: top-right 46px -->
  <div class="pumpkin-top-right">
    <svg width="46" height="46" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
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

  <!-- Pumpkin: bottom-left 34px -->
  <div class="pumpkin-bottom-left">
    <svg width="34" height="34" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
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

  <!-- Pumpkin: bottom-right 26px -->
  <div class="pumpkin-bottom-right">
    <svg width="26" height="26" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
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

  <!-- Bat 1: 32px, color #4a3e34 -->
  <div class="bat-1">
    <svg width="32" height="19" viewBox="0 0 50 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 14 C22 8, 14 3, 2 5 C6 8, 8 10, 10 14 C8 12, 5 11, 2 12 C6 14, 10 16, 14 16 C10 18, 8 22, 6 26 C12 22, 16 18, 20 16 L25 20 L30 16 C34 18, 38 22, 44 26 C42 22, 40 18, 36 16 C40 16, 44 14, 48 12 C45 11, 42 12, 40 14 C42 10, 44 8, 48 5 C36 3, 28 8, 25 14Z" fill="#4a3e34" opacity="0.4"/>
      <circle cx="22" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
      <circle cx="28" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
    </svg>
  </div>

  <!-- Bat 2: 22px, color #3a3030 -->
  <div class="bat-2">
    <svg width="22" height="13" viewBox="0 0 50 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 14 C22 8, 14 3, 2 5 C6 8, 8 10, 10 14 C8 12, 5 11, 2 12 C6 14, 10 16, 14 16 C10 18, 8 22, 6 26 C12 22, 16 18, 20 16 L25 20 L30 16 C34 18, 38 22, 44 26 C42 22, 40 18, 36 16 C40 16, 44 14, 48 12 C45 11, 42 12, 40 14 C42 10, 44 8, 48 5 C36 3, 28 8, 25 14Z" fill="#3a3030" opacity="0.4"/>
      <circle cx="22" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
      <circle cx="28" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
    </svg>
  </div>

  <!-- Bat 3: 18px, color #3a3030 -->
  <div class="bat-3">
    <svg width="18" height="11" viewBox="0 0 50 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 14 C22 8, 14 3, 2 5 C6 8, 8 10, 10 14 C8 12, 5 11, 2 12 C6 14, 10 16, 14 16 C10 18, 8 22, 6 26 C12 22, 16 18, 20 16 L25 20 L30 16 C34 18, 38 22, 44 26 C42 22, 40 18, 36 16 C40 16, 44 14, 48 12 C45 11, 42 12, 40 14 C42 10, 44 8, 48 5 C36 3, 28 8, 25 14Z" fill="#3a3030" opacity="0.4"/>
      <circle cx="22" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
      <circle cx="28" cy="13" r="1.5" fill="#e8940a" opacity="0.7"/>
    </svg>
  </div>

  <!-- Spider with web thread -->
  <div class="spider">
    <svg viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="20" y1="0" x2="20" y2="18" stroke="#6a5a44" stroke-width="0.8" opacity="0.4"/>
      <ellipse cx="20" cy="24" rx="5" ry="4" fill="#2a2226" opacity="0.6"/>
      <ellipse cx="20" cy="30" rx="7" ry="6" fill="#2a2226" opacity="0.5"/>
      <g stroke="#3a3028" stroke-width="1" opacity="0.5">
        <path d="M15 24 C10 20, 6 16, 3 14"/>
        <path d="M15 26 C10 26, 5 28, 2 30"/>
        <path d="M15 28 C10 32, 6 36, 4 40"/>
        <path d="M14 30 C10 36, 8 40, 6 46"/>
        <path d="M25 24 C30 20, 34 16, 37 14"/>
        <path d="M25 26 C30 26, 35 28, 38 30"/>
        <path d="M25 28 C30 32, 34 36, 36 40"/>
        <path d="M26 30 C30 36, 32 40, 34 46"/>
      </g>
      <circle cx="18" cy="23" r="1.2" fill="#e8940a" opacity="0.6"/>
      <circle cx="22" cy="23" r="1.2" fill="#e8940a" opacity="0.6"/>
    </svg>
  </div>

  <!-- Candle 1 -->
  <div class="candle-1">
    <svg viewBox="0 0 20 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 6 C12 10, 14 14, 12 18 C11 20, 9 20, 8 18 C6 14, 8 10, 10 6Z" fill="#e8940a" opacity="0.5"/>
      <path d="M10 9 C11 12, 12 14, 11 17 C10.5 18, 9.5 18, 9 17 C8 14, 9 12, 10 9Z" fill="#ffcc44" opacity="0.4"/>
      <rect x="7" y="18" width="6" height="28" rx="1" fill="#d4c4a0" opacity="0.35"/>
      <ellipse cx="10" cy="18" rx="4" ry="2" fill="#e8d4b0" opacity="0.3"/>
      <path d="M12 22 C13 24, 13 28, 12.5 30" stroke="#d4c4a0" stroke-width="1.5" fill="none" opacity="0.3"/>
    </svg>
  </div>

  <!-- Candle 2 -->
  <div class="candle-2">
    <svg viewBox="0 0 20 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 6 C12 10, 14 14, 12 18 C11 20, 9 20, 8 18 C6 14, 8 10, 10 6Z" fill="#e8940a" opacity="0.5"/>
      <path d="M10 9 C11 12, 12 14, 11 17 C10.5 18, 9.5 18, 9 17 C8 14, 9 12, 10 9Z" fill="#ffcc44" opacity="0.4"/>
      <rect x="7" y="18" width="6" height="28" rx="1" fill="#d4c4a0" opacity="0.35"/>
      <ellipse cx="10" cy="18" rx="4" ry="2" fill="#e8d4b0" opacity="0.3"/>
      <path d="M12 22 C13 24, 13 28, 12.5 30" stroke="#d4c4a0" stroke-width="1.5" fill="none" opacity="0.3"/>
    </svg>
  </div>

  <!-- Candle 3 -->
  <div class="candle-3">
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
    <div class="header-left">
      <div class="logo-wrap">${TGT_LOGO_SVG}</div>
      <div>
        <div class="header-trading-name">${e.tradingAs}</div>
        <div class="header-business-type">${e.businessType}</div>
      </div>
    </div>
    <div class="header-right">
      <div class="header-invoice-label">Invoice</div>
      <div class="header-invoice-number">${data.invoiceNumber}</div>
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

  <!-- DATES -->
  <div class="dates-row">
    <div>
      <div class="date-label">Issued</div>
      <div class="date-value">${data.issueDate}</div>
    </div>
    <div>
      <div class="date-label">Due</div>
      <div class="date-value">${data.dueDate}</div>
    </div>
    <div>
      <div class="date-label">Terms</div>
      <div class="date-value">Net ${data.paymentTermsDays}</div>
    </div>
  </div>

  <!-- FROM / BILL TO -->
  <div class="parties">
    <div class="party-col">
      <div class="party-label">From</div>
      <div class="from-name">${e.fromName}</div>
      <div class="from-trading-as">t/a ${e.tradingAs}</div>
      <div class="from-website">${e.website}</div>
    </div>
    <div class="party-col">
      <div class="party-label">Bill To</div>
      <div class="to-company">${e.toCompany}</div>
      ${data.toContact ? `<div class="to-contact">${e.toContact}</div>` : ''}
      <div class="to-address">${addressHtml}</div>
    </div>
  </div>

  <!-- DESCRIPTION -->
  <div class="description-section">
    <div class="description-box">
      <div class="description-label">Description</div>
      <div class="description-text">${e.description}</div>
    </div>
  </div>

  <!-- AMOUNT -->
  <div class="amount-section">
    <div class="amount-box">
      <div class="amount-label">Amount Due</div>
      <div class="amount-value">${amt}</div>
    </div>
  </div>

  <!-- PAYMENT DETAILS -->
  <div class="payment-section">
    <div class="payment-title">Payment Details</div>
    <div class="payment-grid">
      <div>
        <div class="payment-field-label">Account Name</div>
        <div class="payment-field-value">${e.bankAccountName}</div>
      </div>
      <div>
        <div class="payment-field-label">Bank</div>
        <div class="payment-field-value">${e.bankName}</div>
      </div>
      <div>
        <div class="payment-field-label">Sort Code</div>
        <div class="payment-field-value">${e.bankSortCode}</div>
      </div>
      <div>
        <div class="payment-field-label">Account No.</div>
        <div class="payment-field-value">${e.bankAccountNumber}</div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-thanks">Thank you for your business &#128293;</div>
    <div class="footer-website">${e.website}</div>
  </div>
</div>
</body>
</html>`;
}
