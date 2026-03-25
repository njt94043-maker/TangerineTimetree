import { PDF_COLORS } from './colors';
import { TGT_LOGO_SVG } from './logo';
import { htmlEscape } from './htmlEscape';
import { PRINT_CSS } from './printStyles';

export interface ReceiptTemplateData {
  receiptDate: string;
  paidTo: string;
  paidBy: string;
  amount: number;
  venue: string;
  gigDate: string;
  invoiceNumber: string;
  description: string;
  website: string;
}

export function generateReceiptHtml(data: ReceiptTemplateData): string {
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
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: ${PDF_COLORS.bodyText}; font-size: 14px; line-height: 1.5; }
  .page { min-height: 100%; display: flex; flex-direction: column; }
  .header { background: ${PDF_COLORS.headerBg}; color: ${PDF_COLORS.headerText}; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 36px; font-weight: bold; letter-spacing: 4px; }
  .header .logo { width: 80px; height: 80px; }
  .body-section { padding: 30px 40px; }
  .date { font-size: 13px; color: ${PDF_COLORS.labelText}; margin-bottom: 20px; }
  .orange-rule { height: 3px; background: ${PDF_COLORS.accentRule}; margin: 0 40px; }
  .detail-row { display: flex; margin-bottom: 12px; }
  .detail-label { width: 140px; font-weight: bold; color: ${PDF_COLORS.labelText}; font-size: 13px; }
  .detail-value { flex: 1; font-size: 14px; }
  .amount-box { background: ${PDF_COLORS.totalBarBg}; color: ${PDF_COLORS.totalBarText}; padding: 16px 40px; display: flex; justify-content: space-between; align-items: center; font-size: 20px; font-weight: bold; margin: 20px 40px; border-radius: 4px; }
  .ref { padding: 10px 40px; font-size: 12px; color: ${PDF_COLORS.labelText}; }
  .spacer { flex: 1; }
  .footer { background: ${PDF_COLORS.footerBg}; color: ${PDF_COLORS.footerText}; padding: 20px 40px; text-align: center; font-size: 12px; }
  .footer .website { font-weight: bold; font-size: 13px; margin-bottom: 4px; }
  ${PRINT_CSS}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>RECEIPT</h1>
    <div class="logo">${TGT_LOGO_SVG}</div>
  </div>

  <div class="body-section">
    <div class="date">Date: ${data.receiptDate}</div>

    <div class="detail-row">
      <div class="detail-label">Payment From:</div>
      <div class="detail-value">${e.paidBy}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Payment To:</div>
      <div class="detail-value">${e.paidTo}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">For:</div>
      <div class="detail-value">${e.description} at ${e.venue} on ${data.gigDate}</div>
    </div>
  </div>

  <div class="amount-box">
    <span>AMOUNT PAID:</span>
    <span>${amt}</span>
  </div>

  <div class="ref">
    Reference: ${data.invoiceNumber}
  </div>

  <div class="spacer"></div>

  <div class="footer">
    <div class="website">${e.website}</div>
    <div>This receipt confirms payment has been made.</div>
  </div>
</div>
</body>
</html>`;
}
