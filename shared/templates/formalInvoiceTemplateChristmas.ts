import type { FormalInvoiceTemplateData } from './formalInvoiceTemplate';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';
import { PRINT_CSS } from './printStyles';

export function generateFormalInvoiceChristmasHtml(data: FormalInvoiceTemplateData): string {
  const addressHtml = htmlEscape(data.toAddress).replace(/\n/g, '<br>');
  const e = {
    fromName: htmlEscape(data.fromName),
    tradingAs: htmlEscape(data.tradingAs),
    businessType: htmlEscape(data.businessType),
    website: htmlEscape(data.website),
    toCompany: htmlEscape(data.toCompany),
    toContact: htmlEscape(data.toContact),
    venueName: htmlEscape(data.venueName),
    bankAccountName: htmlEscape(data.bankAccountName),
    bankName: htmlEscape(data.bankName),
    bankSortCode: htmlEscape(data.bankSortCode),
    bankAccountNumber: htmlEscape(data.bankAccountNumber),
    notes: htmlEscape(data.notes),
  };

  const fmt = (n: number) => `\u00a3${n.toFixed(2)}`;

  const lineItemsHtml = data.lineItems.map((item, i) => `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="td-desc">${htmlEscape(item.description)}</td>
        <td class="td-qty">${item.quantity}</td>
        <td class="td-price">${fmt(item.unitPrice)}</td>
        <td class="td-total">${fmt(item.lineTotal)}</td>
      </tr>`).join('');

  const discountHtml = data.discountAmount > 0 ? `
      <div class="summary-row">
        <span class="summary-label">Discount:</span>
        <span class="summary-value">&minus;${fmt(data.discountAmount)}</span>
      </div>` : '';

  const notesHtml = data.notes ? `
  <div class="notes-section">
    <h3>Notes</h3>
    <p>${e.notes.replace(/\n/g, '<br>')}</p>
  </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${data.invoiceNumber} — The Green Tangerine</title>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=Cormorant+Garamond:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Crimson Text', serif;
    color: #2a2a2a;
    font-size: 14px;
    line-height: 1.5;
    background: #faf8f2;
  }

  .page {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    background: #faf8f2;
    position: relative;
    overflow: hidden;
  }

  /* Snowflakes background */
  .snowflakes {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .header {
    background: #1B4332;
    color: #fff;
    padding: 32px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 1;
  }

  .header-left h1 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 38px;
    font-weight: 700;
    letter-spacing: 4px;
    margin-bottom: 4px;
  }

  .header-left .subtitle {
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 2px;
    color: #c9a84c;
  }

  .header .logo {
    width: 80px;
    height: 80px;
  }

  .gold-rule {
    height: 4px;
    background: linear-gradient(90deg, #c9a84c, #e8d48c, #c9a84c);
    position: relative;
    z-index: 1;
  }

  .holly-border {
    height: 6px;
    background: repeating-linear-gradient(
      90deg,
      #1B4332 0px,
      #1B4332 8px,
      #c9a84c 8px,
      #c9a84c 10px,
      #8B0000 10px,
      #8B0000 12px,
      #c9a84c 12px,
      #c9a84c 14px
    );
    position: relative;
    z-index: 1;
  }

  .meta-bar {
    padding: 18px 40px;
    display: flex;
    gap: 40px;
    position: relative;
    z-index: 1;
    background: rgba(201,168,76,0.06);
    border-bottom: 1px solid rgba(201,168,76,0.15);
  }

  .meta-item {
    font-size: 13px;
  }

  .meta-label {
    color: #1B4332;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    display: block;
    margin-bottom: 2px;
  }

  .meta-value { color: #333; }

  .parties {
    display: flex;
    padding: 24px 40px;
    gap: 40px;
    position: relative;
    z-index: 1;
  }

  .party { flex: 1; }

  .party-label {
    color: #1B4332;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 2px solid #c9a84c;
    display: inline-block;
  }

  .party-name {
    font-weight: 700;
    font-size: 16px;
    margin-bottom: 2px;
  }

  .party-detail {
    font-size: 13px;
    color: #666;
    line-height: 1.4;
  }

  .party-detail a { color: #1B4332; text-decoration: none; }

  .event-bar {
    margin: 0 40px;
    padding: 14px 20px;
    background: rgba(201,168,76,0.08);
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 4px;
    display: flex;
    gap: 40px;
    position: relative;
    z-index: 1;
  }

  .event-item { font-size: 13px; }

  .event-field-label {
    color: #1B4332;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    display: block;
    margin-bottom: 2px;
  }

  .table-section {
    margin: 20px 40px 0;
    position: relative;
    z-index: 1;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  thead th {
    background: #c9a84c;
    color: #fff;
    padding: 10px 14px;
    text-align: left;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  thead th.th-qty { text-align: center; width: 60px; }
  thead th.th-price { text-align: right; width: 110px; }
  thead th.th-total { text-align: right; width: 110px; }

  .row-even td { background: rgba(201,168,76,0.04); }
  .row-odd td { background: #faf8f2; }

  td {
    padding: 12px 14px;
    border-bottom: 1px solid rgba(201,168,76,0.15);
  }

  .td-qty { text-align: center; color: #666; }
  .td-price { text-align: right; color: #666; }
  .td-total { text-align: right; font-weight: 700; }

  .summary-section {
    display: flex;
    justify-content: flex-end;
    margin: 12px 40px 0;
    position: relative;
    z-index: 1;
  }

  .summary-block { min-width: 280px; }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    font-size: 14px;
  }

  .summary-label { color: #666; }
  .summary-value { font-weight: 700; }

  .total-bar {
    background: #1B4332;
    color: #fff;
    display: flex;
    justify-content: space-between;
    padding: 12px 20px;
    font-weight: 700;
    font-size: 18px;
    border-radius: 4px;
    margin-top: 6px;
  }

  .total-bar .total-amt { color: #c9a84c; }

  .notes-section {
    padding: 16px 40px;
    position: relative;
    z-index: 1;
  }

  .notes-section h3 {
    font-size: 12px;
    font-weight: 700;
    color: #1B4332;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }

  .notes-section p {
    font-size: 13px;
    color: #666;
    line-height: 1.5;
  }

  .payment {
    padding: 20px 40px;
    border-top: 1px solid rgba(201,168,76,0.2);
    position: relative;
    z-index: 1;
  }

  .payment h3 {
    font-size: 12px;
    font-weight: 700;
    color: #1B4332;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 10px;
  }

  .payment-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
  }

  .payment-field-label {
    font-size: 10px;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .payment-field-value {
    font-size: 13px;
    color: #333;
  }

  .spacer { flex: 1; }

  .footer {
    background: #1B4332;
    color: #fff;
    padding: 20px 40px;
    text-align: center;
    font-size: 12px;
    position: relative;
    z-index: 1;
  }

  .footer .website {
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 4px;
    color: #c9a84c;
  }

  .footer .terms { color: rgba(255,255,255,0.7); }

  .footer .festive {
    color: #c9a84c;
    font-style: italic;
    margin-top: 4px;
  }
  ${PRINT_CSS}
</style>
</head>
<body>
<div class="page">
  <!-- Snowflakes -->
  <svg class="snowflakes" viewBox="0 0 600 900" preserveAspectRatio="none">
    <circle cx="50" cy="120" r="2" fill="#c9a84c" opacity="0.15"/>
    <circle cx="150" cy="80" r="1.5" fill="#c9a84c" opacity="0.12"/>
    <circle cx="350" cy="200" r="2.5" fill="#c9a84c" opacity="0.1"/>
    <circle cx="500" cy="150" r="1.8" fill="#c9a84c" opacity="0.13"/>
    <circle cx="80" cy="400" r="2" fill="#c9a84c" opacity="0.08"/>
    <circle cx="520" cy="350" r="1.5" fill="#c9a84c" opacity="0.1"/>
    <circle cx="250" cy="500" r="2" fill="#c9a84c" opacity="0.07"/>
    <circle cx="420" cy="600" r="1.8" fill="#c9a84c" opacity="0.09"/>
    <circle cx="100" cy="700" r="2.2" fill="#c9a84c" opacity="0.06"/>
    <circle cx="480" cy="780" r="1.5" fill="#c9a84c" opacity="0.08"/>
  </svg>

  <div class="header">
    <div class="header-left">
      <h1>INVOICE</h1>
      <div class="subtitle">&#9733; ${e.tradingAs} &#9733;</div>
    </div>
    <div class="logo">${TGT_LOGO_SVG}</div>
  </div>

  <div class="gold-rule"></div>
  <div class="holly-border"></div>

  <div class="meta-bar">
    <div class="meta-item">
      <span class="meta-label">Invoice Number</span>
      <span class="meta-value"><strong>${data.invoiceNumber}</strong></span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Issue Date</span>
      <span class="meta-value">${data.issueDate}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Due Date</span>
      <span class="meta-value">${data.dueDate}</span>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">${e.fromName}</div>
      <div class="party-detail">Trading as: ${e.tradingAs}</div>
      <div class="party-detail">${e.businessType}</div>
      <div class="party-detail"><a href="https://${e.website}">${e.website}</a></div>
    </div>
    <div class="party">
      <div class="party-label">To</div>
      <div class="party-name">${e.toCompany}</div>
      ${data.toContact ? `<div class="party-detail">${e.toContact}</div>` : ''}
      <div class="party-detail">${addressHtml}</div>
    </div>
  </div>

  <div class="event-bar">
    <div class="event-item">
      <span class="event-field-label">Venue</span>
      <span>${e.venueName}</span>
    </div>
    <div class="event-item">
      <span class="event-field-label">Event Date</span>
      <span>${data.eventDate}</span>
    </div>
  </div>

  <div class="table-section">
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="th-qty">Qty</th>
          <th class="th-price">Unit Price</th>
          <th class="th-total">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
      </tbody>
    </table>
  </div>

  <div class="summary-section">
    <div class="summary-block">
      <div class="summary-row">
        <span class="summary-label">Subtotal:</span>
        <span class="summary-value">${fmt(data.subtotal)}</span>
      </div>
      ${discountHtml}
      <div class="total-bar">
        <span>TOTAL:</span>
        <span class="total-amt">${fmt(data.total)}</span>
      </div>
    </div>
  </div>

  ${notesHtml}

  <div class="payment">
    <h3>Payment Details</h3>
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

  <div class="spacer"></div>

  <div class="footer">
    <div class="website">${e.website}</div>
    <div class="terms">Please pay within ${data.paymentTermsDays} days of invoice date</div>
    <div class="festive">&#9733; Wishing you a wonderful festive season! &#9733;</div>
  </div>
</div>
</body>
</html>`;
}
