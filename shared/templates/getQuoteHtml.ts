import type { InvoiceStyle } from '../supabase/types';
import type { QuoteTemplateData } from './quoteTemplate';
import { generateQuoteHtml } from './quoteTemplate';
import { generateQuotePremiumDarkHtml } from './quoteTemplatePremiumDark';
import { generateQuoteCleanProfessionalHtml } from './quoteTemplateCleanProfessional';
import { generateQuoteBoldRockHtml } from './quoteTemplateBoldRock';
import { generateQuoteChristmasHtml } from './quoteTemplateChristmas';
import { generateQuoteHalloweenHtml } from './quoteTemplateHalloween';
import { generateQuoteValentineHtml } from './quoteTemplateValentine';

const TEMPLATE_MAP: Record<InvoiceStyle, (data: QuoteTemplateData) => string> = {
  classic: generateQuoteHtml,
  premium: generateQuotePremiumDarkHtml,
  clean: generateQuoteCleanProfessionalHtml,
  bold: generateQuoteBoldRockHtml,
  christmas: generateQuoteChristmasHtml,
  halloween: generateQuoteHalloweenHtml,
  valentine: generateQuoteValentineHtml,
};

export function getQuoteHtml(style: InvoiceStyle, data: QuoteTemplateData): string {
  const generator = TEMPLATE_MAP[style] || TEMPLATE_MAP.classic;
  return generator(data);
}
