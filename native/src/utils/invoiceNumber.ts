export function formatInvoiceNumber(num: number): string {
  return `INV-${String(num).padStart(3, '0')}`;
}
