export type InvoiceStyle = 'classic' | 'premium' | 'clean' | 'bold' | 'christmas' | 'halloween' | 'valentine';

export interface InvoiceStyleMeta {
  id: InvoiceStyle;
  name: string;
  description: string;
  accentColor: string;
}

export const INVOICE_STYLES: InvoiceStyleMeta[] = [
  { id: 'classic', name: 'Classic', description: 'Clean teal & orange', accentColor: '#1abc9c' },
  { id: 'premium', name: 'Premium Dark', description: 'Upscale venues', accentColor: '#FF8C00' },
  { id: 'clean', name: 'Clean Professional', description: 'Weddings & formal', accentColor: '#2D5016' },
  { id: 'bold', name: 'Bold Rock', description: 'Pubs & casual gigs', accentColor: '#FF8C00' },
  { id: 'christmas', name: 'Christmas', description: 'Festive season gigs', accentColor: '#c9a84c' },
  { id: 'halloween', name: 'Halloween', description: 'Spooky season gigs', accentColor: '#e8940a' },
  { id: 'valentine', name: "Valentine's", description: 'Romantic evening gigs', accentColor: '#b45064' },
];

export const DEFAULT_INVOICE_STYLE: InvoiceStyle = 'classic';
