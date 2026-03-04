
import { format } from "date-fns";
import { useMutation } from '@tanstack/react-query';

// --- Placeholder for base44 client and PDF generation utility ---
// In a real application, 'base44' would be your actual API client or ORM instance,
// and 'generatePdfFromHtml' would be an actual utility (e.g., using Puppeteer, a cloud PDF service, etc.)
// For this example, these are mocked to make the code functional.
const base44 = {
  entities: {
    SessionPayment: {
      update: async (id, data) => {
        console.log(`Mocking base44.entities.SessionPayment.update(${id}, ${JSON.stringify(data)})`);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 100));
        return { id, ...data };
      },
    },
    FileStorage: {
      create: async (data) => {
        console.log(`Mocking base44.entities.FileStorage.create(${JSON.stringify(data)})`);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 100));
        return { id: Math.random().toString(36).substring(7), ...data };
      },
    },
  },
};

// This function simulates converting the HTML to a PDF and uploading it, returning a URL.
// In a real application, this would involve a server-side process or a client-side library
// capable of generating a PDF from HTML, then uploading it to storage (e.g., S3, Google Cloud Storage).
async function generatePdfFromHtmlAndUpload(htmlContent, fileName) {
  console.log(`Simulating PDF generation and upload for: ${fileName}`);
  // Simulate delay for PDF generation/upload
  await new Promise(resolve => setTimeout(resolve, 1500));
  const dummyPdfUrl = `https://example.com/invoices/${encodeURIComponent(fileName).replace(/%/g, '')}-${Date.now()}.pdf`;
  console.log(`Simulated PDF uploaded to: ${dummyPdfUrl}`);
  return dummyPdfUrl;
}
// --- End of Placeholder ---

/**
 * Generates the HTML content for a session invoice.
 * This function remains a pure HTML generation utility.
 * @param {object} sessionPayment - The payment details for the session.
 * @param {string} musicianAddress - The address of the musician.
 * @returns {string} The full HTML string of the invoice.
 */
function _generateSessionInvoiceHTML(sessionPayment, musicianAddress) {
  // Use display_name if available, otherwise fall back to full_name
  const musicianName = sessionPayment.musician_display_name || sessionPayment.musician_name;
  
  const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Session Invoice - ${musicianName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      color: #333;
      line-height: 1.6;
      border: 1px solid #eee;
      border-radius: 8px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      border-bottom: 3px solid #10b981;
      padding-bottom: 20px;
    }
    .invoice-number {
      font-size: 24px;
      font-weight: bold;
      color: #10b981;
      margin-bottom: 5px;
    }
    .section-title {
      background: #10b981;
      color: white;
      padding: 10px 15px;
      font-weight: bold;
      margin-top: 25px;
      border-radius: 4px 4px 0 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 15px;
      border-bottom: 1px solid #eee;
    }
    .info-row:last-of-type {
      border-bottom: none;
    }
    .amount-section {
      background: #f0fdf4;
      border: 2px solid #10b981;
      padding: 25px;
      margin-top: 30px;
      text-align: right;
      border-radius: 8px;
    }
    .total-amount {
      font-size: 32px;
      font-weight: bold;
      color: #10b981;
      margin-top: 10px;
    }
    .address-block {
      margin-top: 10px;
      font-size: 14px;
      line-height: 1.5;
    }
    .detail-label {
      font-weight: bold;
      color: #555;
    }
    .detail-value {
      text-align: right;
    }
    .invoice-details-block {
      padding: 0 15px;
      background: #f9fafb;
      border: 1px solid #eee;
      border-top: none;
      border-radius: 0 0 8px 8px;
      font-size: 14px;
    }
    @media print {
      body {
        margin: 0;
        border: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h2 style="margin: 0; color: #10b981;">Session Musician Invoice</h2>
      <div class="address-block">
        <strong>${musicianName}</strong><br>
        Session Musician<br>
        Email: ${sessionPayment.musician_email}
        ${sessionPayment.musician_phone ? `<br>Phone: ${sessionPayment.musician_phone}` : ''}
        ${musicianAddress ? `<br>${musicianAddress}` : ''}
      </div>
    </div>
    <div style="text-align: right;">
      <div class="invoice-number">SESS-${sessionPayment.musician_email.split('@')[0].toUpperCase().substring(0, 4)}-${format(new Date(sessionPayment.event_date), 'yyyyMMdd')}</div>
      <div style="margin-top: 10px; font-size: 14px;">
        <span class="detail-label">Date:</span> <span>${format(new Date(sessionPayment.event_date), 'dd/MM/yyyy')}</span><br>
        <span class="detail-label">Tax Year:</span> <span>${sessionPayment.tax_year}</span>
      </div>
    </div>
  </div>

  <div class="section-title">INVOICE TO</div>
  <div class="invoice-details-block" style="padding: 15px;">
    <strong>The Green Tangerine</strong><br>
    Band Contractor<br>
    <em>For payment of session musician services</em>
  </div>

  <div class="section-title">SESSION DETAILS</div>
  <div class="invoice-details-block">
    <div class="info-row">
      <span class="detail-label">Performance Date:</span>
      <span class="detail-value">${format(new Date(sessionPayment.event_date), 'EEEE, MMMM d, yyyy')}</span>
    </div>
    <div class="info-row">
      <span class="detail-label">Venue:</span>
      <span class="detail-value">${sessionPayment.venue_name}</span>
    </div>
    <div class="info-row">
      <span class="detail-label">Service:</span>
      <span class="detail-value">Session Musician Performance (1/4 Share)</span>
    </div>
    ${sessionPayment.notes ? `
    <div class="info-row" style="border-bottom: none;">
      <span class="detail-label">Notes:</span>
      <span class="detail-value">${sessionPayment.notes}</span>
    </div>
    ` : ''}
  </div>

  <div class="amount-section">
    <div style="margin-bottom: 10px; font-size: 16px; color: #666;">Total Amount Due:</div>
    <div class="total-amount">£${sessionPayment.amount.toFixed(2)}</div>
    <div style="font-size: 12px; color: #888; margin-top: 15px;">
      Payment terms: Due upon receipt<br>
      This invoice represents your taxable income for the tax year ${sessionPayment.tax_year}
    </div>
  </div>

  <div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #666;">
    <strong>Tax Information:</strong><br>
    • This is your income as a self-employed session musician<br>
    • Include this amount in your Self Assessment tax return<br>
    • Keep this invoice for your records<br>
    • You may deduct allowable expenses (mileage, equipment, etc.) from this income
  </div>
</body>
</html>
  `;

  return invoiceHTML;
}

/**
 * A React hook to handle the generation, upload, and database recording of session invoices.
 * This hook encapsulates the `useMutation` logic as described in the requirements.
 * It uses the `_generateSessionInvoiceHTML` helper to create the invoice content.
 */
export function useGenerateSessionInvoicePDF() {
  const generatePDFMutation = useMutation({
    mutationFn: async ({ payment, musicianAddress }) => {
      // 1. Generate the HTML content for the PDF
      const invoiceHTML = _generateSessionInvoiceHTML(payment, musicianAddress);

      // Determine the file name for the PDF
      const musicianNameForFile = payment.musician_display_name || payment.musician_name;
      const fileName = `Session Invoice - ${musicianNameForFile} - ${format(new Date(payment.event_date), 'yyyy-MM-dd')}.pdf`;
      
      // 2. Convert HTML to PDF and get its URL (simulated)
      const pdfUrl = await generatePdfFromHtmlAndUpload(invoiceHTML, fileName);

      if (pdfUrl) {
        // 3. Update the SessionPayment record with the PDF URL
        await base44.entities.SessionPayment.update(payment.id, {
          session_invoice_pdf_url: pdfUrl
        });

        // 4. Create FileStorage record
        try {
          await base44.entities.FileStorage.create({
            file_name: fileName,
            file_url: pdfUrl,
            file_type: 'pdf',
            category: 'invoices',
            subcategory: 'session_invoice',
            uploaded_by_email: payment.musician_email,
            uploaded_by_name: musicianNameForFile, // Use the same logic as for HTML generation
            related_entity: 'SessionPayment',
            related_entity_id: payment.id,
            description: `Session musician invoice for ${payment.venue_name}`,
            tags: ['invoice', 'session', musicianNameForFile, payment.venue_name],
            visible_to_all: true
          });
        } catch (error) {
          console.warn('Could not create FileStorage record:', error);
          // Depending on requirements, you might want to rethrow the error or handle it gracefully
        }

        return { ...payment, session_invoice_pdf_url: pdfUrl };
      }
      
      // If pdfUrl is not generated, return the original payment without changes
      console.warn('PDF URL was not generated. No updates made.');
      return payment; 
    },
    onSuccess: (data) => {
        console.log('PDF generation and record updates successful!', data);
        // Example: Add a toast notification, invalidate relevant queries, etc.
    },
    onError: (error) => {
        console.error('Error in PDF generation or record updates:', error);
        // Example: Show an error message to the user
    },
  });

  return generatePDFMutation;
}

// For backward compatibility or if the original export was intended as a standalone utility,
// we can re-export the HTML generation function. However, the primary
// functionality described in the changes is now within the hook.
// If the original file was strictly meant to export the HTML generation function,
// and not a React hook, then the use of 'useMutation' would indicate
// that the requested changes are for a *different* file.
// Assuming this single file is being updated to encompass the new requirements:
export { _generateSessionInvoiceHTML as generateSessionInvoicePDF }; // Re-export for compatibility if needed, or remove if the hook is the new primary interface.
