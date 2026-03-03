import { InvoiceTemplateData } from './invoiceTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from '../utils/htmlEscape';

export function generateChristmasHtml(data: InvoiceTemplateData): string {
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

  /* Snowflake container */
  .snowflakes {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.6;
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
    padding: 36px 44px 28px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    position: relative;
    z-index: 1;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .logo-wrap {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid rgba(201, 168, 76, 0.2);
  }

  .header-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 32px;
    font-weight: 700;
    color: #c9a84c;
    letter-spacing: 0.5px;
    line-height: 1.1;
  }

  .header-tagline {
    font-size: 11px;
    color: #8b9e87;
    margin-top: 6px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .header-invoice {
    font-family: 'Cormorant Garamond', serif;
    font-size: 38px;
    font-weight: 300;
    color: #8b3a3a;
    letter-spacing: 3px;
    text-transform: uppercase;
    text-align: right;
  }

  .header-invnum {
    font-size: 13px;
    color: #c9a84c;
    font-weight: 600;
    margin-top: 4px;
    text-align: right;
  }

  /* ---- ORNAMENTAL DIVIDER ---- */
  .divider {
    padding: 0 44px;
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

  /* ---- DATES ---- */
  .dates {
    padding: 20px 44px;
    display: flex;
    gap: 32px;
    position: relative;
    z-index: 1;
  }

  .date-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #5a7a5e;
    margin-bottom: 4px;
  }

  .date-value {
    font-size: 13px;
    color: #d4ccbc;
  }

  /* ---- FROM / TO ---- */
  .parties {
    padding: 12px 44px;
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
    color: #8b3a3a;
    margin-bottom: 10px;
    font-weight: 700;
  }

  .from-name {
    font-size: 14px;
    font-weight: 600;
    color: #c9a84c;
  }

  .from-ta {
    font-size: 12px;
    color: #8b9e87;
    margin-top: 2px;
  }

  .from-web {
    font-size: 11px;
    color: #7a8a76;
    margin-top: 6px;
  }

  .to-name {
    font-size: 14px;
    font-weight: 600;
    color: #e8e0d4;
  }

  .to-contact {
    font-size: 12px;
    color: #b0a898;
    margin-top: 2px;
  }

  .to-address {
    font-size: 11px;
    color: #7a8a76;
    margin-top: 6px;
  }

  /* ---- DESCRIPTION ---- */
  .desc-wrap {
    padding: 24px 44px;
    position: relative;
    z-index: 1;
  }

  .desc-box {
    background: #132a1a;
    border: 1px solid #2d4a32;
    border-radius: 8px;
    padding: 20px 24px;
  }

  .desc-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #5a7a5e;
    margin-bottom: 10px;
  }

  .desc-text {
    font-size: 13px;
    color: #d4ccbc;
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
    background: linear-gradient(135deg, #1a0a0a, #2a1515);
    border: 1px solid #4a2020;
    border-radius: 8px;
  }

  .amount-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #8b3a3a;
    font-weight: 700;
  }

  .amount-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: 36px;
    font-weight: 700;
    color: #c9a84c;
  }

  /* ---- BANK DETAILS ---- */
  .bank-wrap {
    padding: 24px 44px;
    position: relative;
    z-index: 1;
  }

  .bank-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #8b3a3a;
    margin-bottom: 12px;
    font-weight: 700;
  }

  .bank-grid {
    display: flex;
    gap: 32px;
  }

  .bank-label {
    font-size: 9px;
    color: #5a7a5e;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .bank-value {
    font-size: 12px;
    color: #d4ccbc;
  }

  /* ---- FOOTER ---- */
  .footer {
    margin: 20px 44px 0;
    padding: 16px 0;
    border-top: 1px solid #2d4a32;
    text-align: center;
    position: relative;
    z-index: 1;
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

  <!-- Snowflakes -->
  <div class="snowflakes">
    <svg style="position:absolute;top:60px;right:44px;" width="20" height="20" viewBox="0 0 24 24" fill="none">
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
    <svg style="position:absolute;top:120px;right:90px;" width="14" height="14" viewBox="0 0 24 24" fill="none">
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
    <svg style="position:absolute;top:200px;right:30px;" width="10" height="10" viewBox="0 0 24 24" fill="none">
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
    <svg style="position:absolute;bottom:140px;left:30px;" width="16" height="16" viewBox="0 0 24 24" fill="none">
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
    <svg style="position:absolute;bottom:80px;left:80px;" width="12" height="12" viewBox="0 0 24 24" fill="none">
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
    <svg style="position:absolute;bottom:200px;right:60px;" width="11" height="11" viewBox="0 0 24 24" fill="none">
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
  </div>

  <!-- Holly corner top-left -->
  <svg style="position:absolute;top:-10px;left:-10px;width:100px;height:100px;" viewBox="0 0 120 120" fill="none">
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

  <!-- Holly corner bottom-right (rotated) -->
  <svg style="position:absolute;bottom:-10px;right:-10px;width:90px;height:90px;transform:rotate(180deg);" viewBox="0 0 120 120" fill="none">
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

  <!-- Christmas tree watermark -->
  <svg style="position:absolute;bottom:160px;right:40px;width:60px;height:80px;opacity:0.5;" viewBox="0 0 60 80" fill="none">
    <polygon points="30,8 18,30 42,30" fill="#1e5430" opacity="0.5"/>
    <polygon points="30,18 14,42 46,42" fill="#2d6b3f" opacity="0.45"/>
    <polygon points="30,30 10,56 50,56" fill="#1e5430" opacity="0.4"/>
    <polygon points="30,4 31.5,8 35,8 32.5,10.5 33.5,14 30,12 26.5,14 27.5,10.5 25,8 28.5,8" fill="#c9a84c" opacity="0.6"/>
    <rect x="27" y="56" width="6" height="8" fill="#5a3a20" opacity="0.4"/>
    <circle cx="25" cy="26" r="2" fill="#8b3a3a" opacity="0.6"/>
    <circle cx="35" cy="36" r="2" fill="#c9a84c" opacity="0.5"/>
    <circle cx="22" cy="44" r="2.5" fill="#8b3a3a" opacity="0.5"/>
    <circle cx="38" cy="48" r="2" fill="#c9a84c" opacity="0.5"/>
    <circle cx="30" cy="50" r="2" fill="#8b3a3a" opacity="0.4"/>
  </svg>

  <!-- Bauble — top-left (dark red) -->
  <svg style="position:absolute;top:180px;left:20px;width:22px;height:28px;" viewBox="0 0 30 38" fill="none">
    <rect x="13" y="2" width="4" height="5" rx="1" fill="#c9a84c" opacity="0.6"/>
    <circle cx="15" cy="22" r="13" fill="#8b3a3a" opacity="0.4"/>
    <ellipse cx="11" cy="18" rx="4" ry="6" fill="white" opacity="0.08" transform="rotate(-20 11 18)"/>
  </svg>

  <!-- Bauble — bottom-right (gold) -->
  <svg style="position:absolute;bottom:100px;right:110px;width:18px;height:24px;" viewBox="0 0 30 38" fill="none">
    <rect x="13" y="2" width="4" height="5" rx="1" fill="#c9a84c" opacity="0.6"/>
    <circle cx="15" cy="22" r="13" fill="#c9a84c" opacity="0.4"/>
    <ellipse cx="11" cy="18" rx="4" ry="6" fill="white" opacity="0.08" transform="rotate(-20 11 18)"/>
  </svg>

  <!-- Gold top bar -->
  <div class="gold-bar"></div>

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

  <!-- From / To -->
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
        <div class="bank-value">${e.bankSortCode}</div>
      </div>
      <div>
        <div class="bank-label">Account No.</div>
        <div class="bank-value">${e.bankAccountNumber}</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-msg">Thank you for your business &mdash; Wishing you a wonderful festive season &#10022;</div>
    <div class="footer-web">${e.website}</div>
  </div>

  <!-- Gold bottom bar -->
  <div class="gold-bar-bottom"></div>
</div>
</body>
</html>`;
}
