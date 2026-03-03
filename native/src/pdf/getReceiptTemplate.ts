import { InvoiceStyle } from './invoiceStyles';
import { ReceiptTemplateData, generateReceiptHtml } from './receiptTemplate';
import { generateReceiptPremiumDarkHtml } from './receiptTemplatePremiumDark';
import { generateReceiptCleanProfessionalHtml } from './receiptTemplateCleanProfessional';
import { generateReceiptBoldRockHtml } from './receiptTemplateBoldRock';
import { generateReceiptChristmasHtml } from './receiptTemplateChristmas';
import { generateReceiptHalloweenHtml } from './receiptTemplateHalloween';
import { generateReceiptValentineHtml } from './receiptTemplateValentine';

const TEMPLATE_MAP: Record<InvoiceStyle, (data: ReceiptTemplateData) => string> = {
  classic: generateReceiptHtml,
  premium: generateReceiptPremiumDarkHtml,
  clean: generateReceiptCleanProfessionalHtml,
  bold: generateReceiptBoldRockHtml,
  christmas: generateReceiptChristmasHtml,
  halloween: generateReceiptHalloweenHtml,
  valentine: generateReceiptValentineHtml,
};

export function getReceiptHtml(style: InvoiceStyle, data: ReceiptTemplateData): string {
  const generator = TEMPLATE_MAP[style] || TEMPLATE_MAP.classic;
  return generator(data);
}
