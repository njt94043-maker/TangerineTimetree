import { PDF_COLORS } from './colors';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';
import { PRINT_CSS } from './printStyles';

export interface InvoiceTemplateData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  fromName: string;
  tradingAs: string;
  businessType: string;
  website: string;
  toCompany: string;
  toContact: string;
  toAddress: string;
  description: string;
  amount: number;
  bankAccountName: string;
  bankName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  paymentTermsDays: number;
}

export function generateInvoiceHtml(data: InvoiceTemplateData): string {
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
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: ${PDF_COLORS.bodyText}; font-size: 14px; line-height: 1.5; overflow-x: hidden; width: 100%; }
  .page { min-height: 100%; display: flex; flex-direction: column; }
  .header { background: ${PDF_COLORS.headerBg}; color: ${PDF_COLORS.headerText}; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 36px; font-weight: bold; letter-spacing: 4px; }
  .header .logo { width: 90px; height: 90px; }
  .meta { padding: 20px 40px; }
  .meta-row { margin-bottom: 3px; font-size: 13px; }
  .meta-label { color: ${PDF_COLORS.labelText}; }
  .orange-rule { height: 3px; background: ${PDF_COLORS.accentRule}; margin: 0 40px; }
  .parties { display: flex; padding: 20px 40px; gap: 40px; }
  .party { flex: 1; }
  .party-label { color: ${PDF_COLORS.headerBg}; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .party-name { font-weight: bold; font-size: 16px; margin-bottom: 2px; }
  .party-detail { font-size: 13px; color: ${PDF_COLORS.labelText}; line-height: 1.4; }
  .party-detail a { color: ${PDF_COLORS.headerBg}; text-decoration: none; }
  .table-section { margin-top: 20px; }
  .table-header { background: ${PDF_COLORS.tableHeaderBg}; color: ${PDF_COLORS.tableHeaderText}; display: flex; padding: 10px 40px; font-weight: bold; font-size: 13px; border-radius: 4px 4px 0 0; margin: 0 40px; }
  .table-header .desc { flex: 3; }
  .table-header .amt { flex: 1; text-align: right; }
  .table-row { display: flex; padding: 14px 40px; margin: 0 40px; border-bottom: 1px solid #eee; }
  .table-row .desc { flex: 3; font-size: 14px; }
  .table-row .amt { flex: 1; text-align: right; font-size: 14px; }
  .orange-rule-table { height: 2px; background: ${PDF_COLORS.accentRule}; margin: 0 40px; }
  .total-bar { background: ${PDF_COLORS.totalBarBg}; color: ${PDF_COLORS.totalBarText}; display: flex; padding: 12px 40px; font-weight: bold; font-size: 18px; border-radius: 4px; margin: 0 40px; margin-top: 2px; }
  .total-bar .desc { flex: 3; }
  .total-bar .amt { flex: 1; text-align: right; }
  .payment { padding: 25px 40px; }
  .payment h3 { font-size: 13px; font-weight: bold; color: ${PDF_COLORS.headerBg}; margin-bottom: 8px; }
  .payment-row { font-size: 13px; margin-bottom: 3px; }
  .payment-label { color: ${PDF_COLORS.labelText}; }
  .spacer { flex: 1; }
  .footer { background: ${PDF_COLORS.footerBg}; color: ${PDF_COLORS.footerText}; padding: 20px 40px; text-align: center; font-size: 12px; }
  .footer .website { font-weight: bold; font-size: 13px; margin-bottom: 4px; }
  .footer .terms-label { color: ${PDF_COLORS.totalBarBg}; font-weight: bold; }
  .footer .thanks { color: ${PDF_COLORS.totalBarBg}; font-style: italic; margin-top: 2px; }
  ${PRINT_CSS}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>INVOICE</h1>
    <div class="logo">${TGT_LOGO_SVG}</div>
  </div>

  <div class="meta">
    <div class="meta-row"><span class="meta-label">Invoice Number: </span><strong>${data.invoiceNumber}</strong></div>
    <div class="meta-row"><span class="meta-label">Issue Date: </span>${data.issueDate}</div>
    <div class="meta-row"><span class="meta-label">Due Date: </span>${data.dueDate}</div>
  </div>

  <div class="orange-rule"></div>

  <div class="parties">
    <div class="party">
      <div class="party-label">From:</div>
      <div class="party-name">${e.fromName}</div>
      <div class="party-detail">Trading as: ${e.tradingAs}</div>
      <div class="party-detail">${e.businessType}</div>
      <div class="party-detail"><a href="https://${e.website}">${e.website}</a></div>
    </div>
    <div class="party">
      <div class="party-label">To:</div>
      <div class="party-name">${e.toCompany}</div>
      ${data.toContact ? `<div class="party-detail">${e.toContact}</div>` : ''}
      <div class="party-detail">${addressHtml}</div>
    </div>
  </div>

  <div class="table-section">
    <div class="table-header">
      <div class="desc">Description</div>
      <div class="amt">Amount</div>
    </div>
    <div class="table-row">
      <div class="desc">${e.description}</div>
      <div class="amt">${amt}</div>
    </div>
  </div>

  <div class="orange-rule-table"></div>

  <div style="display: flex; justify-content: flex-end; margin: 0 40px;">
    <div class="total-bar" style="width: 300px; margin: 2px 0 0 0;">
      <div class="desc">TOTAL:</div>
      <div class="amt">${amt}</div>
    </div>
  </div>

  <div class="payment">
    <h3>Payment Details:</h3>
    <div class="payment-row"><span class="payment-label">Account Name: </span>${e.bankAccountName}</div>
    <div class="payment-row"><span class="payment-label">Bank: </span>${e.bankName}</div>
    <div class="payment-row"><span class="payment-label">Sort Code: </span>${e.bankSortCode}</div>
    <div class="payment-row"><span class="payment-label">Account Number: </span>${e.bankAccountNumber}</div>
  </div>

  <div class="spacer"></div>

  <div class="footer">
    <div class="website">${e.website}</div>
    <div class="terms-label">Payment Terms:</div>
    <div>Please pay within ${data.paymentTermsDays} days of invoice date</div>
    <div class="thanks">Thank you for your business!</div>
  </div>
</div>
</body>
</html>`;
}
