import type { InvoiceStyle } from '../supabase/types';
import type { FormalInvoiceTemplateData } from './formalInvoiceTemplate';
import { generateFormalInvoiceHtml } from './formalInvoiceTemplate';
import { generateFormalInvoicePremiumDarkHtml } from './formalInvoiceTemplatePremiumDark';
import { generateFormalInvoiceCleanProfessionalHtml } from './formalInvoiceTemplateCleanProfessional';
import { generateFormalInvoiceBoldRockHtml } from './formalInvoiceTemplateBoldRock';
import { generateFormalInvoiceChristmasHtml } from './formalInvoiceTemplateChristmas';
import { generateFormalInvoiceHalloweenHtml } from './formalInvoiceTemplateHalloween';
import { generateFormalInvoiceValentineHtml } from './formalInvoiceTemplateValentine';

const TEMPLATE_MAP: Record<InvoiceStyle, (data: FormalInvoiceTemplateData) => string> = {
  classic: generateFormalInvoiceHtml,
  premium: generateFormalInvoicePremiumDarkHtml,
  clean: generateFormalInvoiceCleanProfessionalHtml,
  bold: generateFormalInvoiceBoldRockHtml,
  christmas: generateFormalInvoiceChristmasHtml,
  halloween: generateFormalInvoiceHalloweenHtml,
  valentine: generateFormalInvoiceValentineHtml,
};

export function getFormalInvoiceHtml(style: InvoiceStyle, data: FormalInvoiceTemplateData): string {
  const generator = TEMPLATE_MAP[style] || TEMPLATE_MAP.classic;
  return generator(data);
}
