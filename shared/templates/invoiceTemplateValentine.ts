import type { InvoiceTemplateData } from './invoiceTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';
import { PRINT_CSS } from './printStyles';

export function generateValentineHtml(data: InvoiceTemplateData): string {
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
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
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
    width: 160px;
    height: 160px;
    z-index: 0;
  }

  .heart-cluster-bl {
    position: absolute;
    bottom: 20px;
    left: -20px;
    width: 120px;
    height: 120px;
    transform: rotate(180deg);
    opacity: 0.6;
    z-index: 0;
  }

  .rose-tl {
    position: absolute;
    top: 90px;
    left: 20px;
    opacity: 0.6;
    z-index: 0;
  }

  .rose-br {
    position: absolute;
    bottom: 140px;
    right: 24px;
    opacity: 0.5;
    transform: scaleX(-1);
    z-index: 0;
  }

  .rose-mr {
    position: absolute;
    top: 300px;
    right: 10px;
    opacity: 0.35;
    transform: rotate(15deg);
    z-index: 0;
  }

  .scattered-heart-1 {
    position: absolute;
    top: 200px;
    left: 40px;
    opacity: 0.25;
    z-index: 0;
  }

  .scattered-heart-2 {
    position: absolute;
    bottom: 240px;
    left: 100px;
    opacity: 0.22;
    z-index: 0;
  }

  .scattered-heart-3 {
    position: absolute;
    top: 450px;
    right: 60px;
    opacity: 0.18;
    z-index: 0;
  }

  .scattered-heart-4 {
    position: absolute;
    top: 160px;
    right: 180px;
    opacity: 0.15;
    z-index: 0;
  }

  .scattered-heart-5 {
    position: absolute;
    bottom: 300px;
    right: 140px;
    opacity: 0.18;
    z-index: 0;
  }

  /* ---- ACCENT BARS ---- */
  .rose-bar-top {
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
    padding: 36px 44px 20px;
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
    border: 2px solid rgba(180, 80, 100, 0.13);
  }

  .header-name {
    font-family: 'Playfair Display', serif;
    font-size: 30px;
    font-weight: 700;
    color: #8a3048;
    font-style: italic;
    line-height: 1.1;
  }

  .header-tagline {
    font-size: 10px;
    color: #b49898;
    margin-top: 6px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
  }

  .header-invoice {
    font-family: 'Playfair Display', serif;
    font-size: 32px;
    font-weight: 400;
    color: #c4a882;
    font-style: italic;
    letter-spacing: 2px;
    text-align: right;
  }

  .header-invnum {
    font-size: 13px;
    color: #8a3048;
    font-weight: 600;
    margin-top: 4px;
    text-align: right;
  }

  /* ---- HEART LINE DIVIDER ---- */
  .heart-divider {
    padding: 0 44px;
    position: relative;
    z-index: 1;
  }

  /* ---- DATES ---- */
  .dates {
    padding: 16px 44px 12px;
    display: flex;
    gap: 36px;
    position: relative;
    z-index: 1;
  }

  .date-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #b49898;
    margin-bottom: 4px;
  }

  .date-value {
    font-size: 13px;
    color: #5a3040;
  }

  /* ---- FROM / BILL TO ---- */
  .parties {
    padding: 16px 44px;
    display: flex;
    gap: 40px;
    position: relative;
    z-index: 1;
  }

  .party { flex: 1; }

  .party-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #8a3048;
    margin-bottom: 10px;
    font-weight: 700;
  }

  .from-name {
    font-size: 14px;
    font-weight: 600;
    color: #3a2028;
  }

  .from-ta {
    font-size: 12px;
    color: #7a5a68;
    margin-top: 2px;
    font-style: italic;
  }

  .from-web {
    font-size: 11px;
    color: #9a7a88;
    margin-top: 6px;
  }

  .to-name {
    font-size: 14px;
    font-weight: 600;
    color: #3a2028;
  }

  .to-contact {
    font-size: 12px;
    color: #7a5a68;
    margin-top: 2px;
  }

  .to-address {
    font-size: 11px;
    color: #9a7a88;
    margin-top: 6px;
    white-space: pre-line;
  }

  /* ---- DESCRIPTION ---- */
  .desc-wrap {
    padding: 20px 44px;
    position: relative;
    z-index: 1;
  }

  .desc-box {
    background: #f5ede8;
    border: 1px solid #e4d4cc;
    border-radius: 8px;
    padding: 20px 24px;
  }

  .desc-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #b49898;
    margin-bottom: 10px;
  }

  .desc-text {
    font-size: 13px;
    color: #5a3040;
    white-space: pre-line;
    line-height: 1.7;
  }

  /* ---- AMOUNT ---- */
  .amount-wrap {
    padding: 8px 44px;
    position: relative;
    z-index: 1;
  }

  .amount-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: linear-gradient(135deg, #3a1828, #4a2038);
    border-radius: 8px;
  }

  .amount-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #d4a0a0;
    font-weight: 700;
  }

  .amount-value {
    font-family: 'Playfair Display', serif;
    font-size: 34px;
    font-weight: 700;
    color: #faf5f0;
    font-style: italic;
  }

  /* ---- PAYMENT DETAILS ---- */
  .bank-wrap {
    padding: 24px 44px;
    position: relative;
    z-index: 1;
  }

  .bank-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #8a3048;
    margin-bottom: 12px;
    font-weight: 700;
  }

  .bank-grid {
    display: flex;
    gap: 28px;
  }

  .bank-label {
    font-size: 9px;
    color: #b49898;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .bank-value {
    font-size: 12px;
    color: #5a3040;
  }

  /* ---- FOOTER ---- */
  .footer {
    margin: 16px 44px 0;
    padding: 14px 0;
    border-top: 1px solid #e4d4cc;
    text-align: center;
    position: relative;
    z-index: 1;
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
  .payment-value-mono { font-family: 'JetBrains Mono', monospace; letter-spacing: 1px; }
  ${PRINT_CSS}
</style>
</head>
<body>
<div class="page">
  <div class="linen"></div>

  <!-- Heart cluster top-right -->
  <svg class="heart-cluster-tr" viewBox="0 0 100 100" fill="none">
    <path d="M50 85 C50 85, 15 55, 15 35 C15 22, 28 15, 38 20 C44 23, 48 28, 50 34 C52 28, 56 23, 62 20 C72 15, 85 22, 85 35 C85 55, 50 85, 50 85Z" fill="#b45064" opacity="0.2"/>
    <path d="M72 30 C72 30, 58 18, 58 10 C58 5, 63 2, 67 4 C69 5, 71 7, 72 9 C73 7, 75 5, 77 4 C81 2, 86 5, 86 10 C86 18, 72 30, 72 30Z" fill="#d4788a" opacity="0.3"/>
    <path d="M28 25 C28 25, 20 19, 20 14 C20 11, 23 9, 25 10 C26 11, 27 12, 28 13 C29 12, 30 11, 31 10 C33 9, 36 11, 36 14 C36 19, 28 25, 28 25Z" fill="#c4607a" opacity="0.35"/>
    <path d="M82 55 C82 55, 78 52, 78 49 C78 48, 79 47, 80 47.5 C81 48, 81 48, 82 49 C83 48, 83 48, 84 47.5 C85 47, 86 48, 86 49 C86 52, 82 55, 82 55Z" fill="#b45064" opacity="0.4"/>
    <path d="M18 60 C18 60, 15 58, 15 56 C15 55, 16 54, 17 54.5 C17.5 55, 17.5 55, 18 55.5 C18.5 55, 18.5 55, 19 54.5 C20 54, 21 55, 21 56 C21 58, 18 60, 18 60Z" fill="#d4788a" opacity="0.3"/>
  </svg>

  <!-- Heart cluster bottom-left (rotated, reduced opacity) -->
  <svg class="heart-cluster-bl" viewBox="0 0 100 100" fill="none">
    <path d="M50 85 C50 85, 15 55, 15 35 C15 22, 28 15, 38 20 C44 23, 48 28, 50 34 C52 28, 56 23, 62 20 C72 15, 85 22, 85 35 C85 55, 50 85, 50 85Z" fill="#b45064" opacity="0.2"/>
    <path d="M72 30 C72 30, 58 18, 58 10 C58 5, 63 2, 67 4 C69 5, 71 7, 72 9 C73 7, 75 5, 77 4 C81 2, 86 5, 86 10 C86 18, 72 30, 72 30Z" fill="#d4788a" opacity="0.3"/>
    <path d="M28 25 C28 25, 20 19, 20 14 C20 11, 23 9, 25 10 C26 11, 27 12, 28 13 C29 12, 30 11, 31 10 C33 9, 36 11, 36 14 C36 19, 28 25, 28 25Z" fill="#c4607a" opacity="0.35"/>
  </svg>

  <!-- Rose top-left -->
  <svg class="rose-tl" width="36" height="50" viewBox="0 0 40 56" fill="none">
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

  <!-- Rose bottom-right (mirrored) -->
  <svg class="rose-br" width="30" height="42" viewBox="0 0 40 56" fill="none">
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

  <!-- Rose mid-right (rotated) -->
  <svg class="rose-mr" width="26" height="36" viewBox="0 0 40 56" fill="none">
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
  <svg class="scattered-heart-1" width="16" height="16" viewBox="0 0 16 16"><path d="M8 14 C8 14, 2 9, 2 5 C2 3, 4 1, 6 2.5 C7 3, 7.5 4, 8 5 C8.5 4, 9 3, 10 2.5 C12 1, 14 3, 14 5 C14 9, 8 14, 8 14Z" fill="#b45064"/></svg>
  <svg class="scattered-heart-2" width="12" height="12" viewBox="0 0 16 16"><path d="M8 14 C8 14, 2 9, 2 5 C2 3, 4 1, 6 2.5 C7 3, 7.5 4, 8 5 C8.5 4, 9 3, 10 2.5 C12 1, 14 3, 14 5 C14 9, 8 14, 8 14Z" fill="#c4607a"/></svg>
  <svg class="scattered-heart-3" width="10" height="10" viewBox="0 0 16 16"><path d="M8 14 C8 14, 2 9, 2 5 C2 3, 4 1, 6 2.5 C7 3, 7.5 4, 8 5 C8.5 4, 9 3, 10 2.5 C12 1, 14 3, 14 5 C14 9, 8 14, 8 14Z" fill="#d4788a"/></svg>
  <svg class="scattered-heart-4" width="8" height="8" viewBox="0 0 16 16"><path d="M8 14 C8 14, 2 9, 2 5 C2 3, 4 1, 6 2.5 C7 3, 7.5 4, 8 5 C8.5 4, 9 3, 10 2.5 C12 1, 14 3, 14 5 C14 9, 8 14, 8 14Z" fill="#b45064"/></svg>
  <svg class="scattered-heart-5" width="14" height="14" viewBox="0 0 16 16"><path d="M8 14 C8 14, 2 9, 2 5 C2 3, 4 1, 6 2.5 C7 3, 7.5 4, 8 5 C8.5 4, 9 3, 10 2.5 C12 1, 14 3, 14 5 C14 9, 8 14, 8 14Z" fill="#c4607a"/></svg>

  <!-- Top accent bar -->
  <div class="rose-bar-top"></div>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="logo-wrap">${TGT_LOGO_SVG}</div>
      <div>
        <div class="header-name">${e.tradingAs}</div>
        <div class="header-tagline">${e.businessType}</div>
      </div>
    </div>
    <div>
      <div class="header-invoice">Invoice</div>
      <div class="header-invnum">${data.invoiceNumber}</div>
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

  <!-- Dates -->
  <div class="dates">
    <div>
      <div class="date-label">Issue Date</div>
      <div class="date-value">${data.issueDate}</div>
    </div>
    <div>
      <div class="date-label">Due Date</div>
      <div class="date-value">${data.dueDate}</div>
    </div>
    <div>
      <div class="date-label">Payment Terms</div>
      <div class="date-value">${data.paymentTermsDays} days</div>
    </div>
  </div>

  <!-- From / Bill To -->
  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="from-name">${e.fromName}</div>
      <div class="from-ta">t/a ${e.tradingAs}</div>
      <div class="from-web">${e.website}</div>
    </div>
    <div class="party">
      <div class="party-label">Bill To</div>
      <div class="to-name">${e.toCompany}</div>
      ${data.toContact ? `<div class="to-contact">${e.toContact}</div>` : ''}
      <div class="to-address">${addressHtml}</div>
    </div>
  </div>

  <!-- Description -->
  <div class="desc-wrap">
    <div class="desc-box">
      <div class="desc-label">Description</div>
      <div class="desc-text">${e.description}</div>
    </div>
  </div>

  <!-- Amount -->
  <div class="amount-wrap">
    <div class="amount-box">
      <div class="amount-label">Total Amount Due</div>
      <div class="amount-value">${amt}</div>
    </div>
  </div>

  <!-- Bank details -->
  <div class="bank-wrap">
    <div class="bank-title">Payment Details</div>
    <div class="bank-grid">
      <div>
        <div class="bank-label">Account Name</div>
        <div class="bank-value">${e.bankAccountName}</div>
      </div>
      <div>
        <div class="bank-label">Bank</div>
        <div class="bank-value">${e.bankName}</div>
      </div>
      <div>
        <div class="bank-label">Sort Code</div>
        <div class="bank-value payment-value-mono">${e.bankSortCode}</div>
      </div>
      <div>
        <div class="bank-label">Account No.</div>
        <div class="bank-value payment-value-mono">${e.bankAccountNumber}</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-msg">Thank you for a lovely evening &#9829;</div>
    <div class="footer-web">${e.website}</div>
  </div>

  <div class="rose-bar-bottom"></div>
</div>
</body>
</html>`;
}
