import { InvoiceStyle } from './invoiceStyles';
import { InvoiceTemplateData, generateInvoiceHtml } from './invoiceTemplate';
import { generatePremiumDarkHtml } from './invoiceTemplatePremiumDark';
import { generateCleanProfessionalHtml } from './invoiceTemplateCleanProfessional';
import { generateBoldRockHtml } from './invoiceTemplateBoldRock';
import { generateChristmasHtml } from './invoiceTemplateChristmas';
import { generateHalloweenHtml } from './invoiceTemplateHalloween';
import { generateValentineHtml } from './invoiceTemplateValentine';

const TEMPLATE_MAP: Record<InvoiceStyle, (data: InvoiceTemplateData) => string> = {
  classic: generateInvoiceHtml,
  premium: generatePremiumDarkHtml,
  clean: generateCleanProfessionalHtml,
  bold: generateBoldRockHtml,
  christmas: generateChristmasHtml,
  halloween: generateHalloweenHtml,
  valentine: generateValentineHtml,
};

export function getInvoiceHtml(style: InvoiceStyle, data: InvoiceTemplateData): string {
  const generator = TEMPLATE_MAP[style] || TEMPLATE_MAP.classic;
  return generator(data);
}
