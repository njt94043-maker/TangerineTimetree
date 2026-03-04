
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { format, isBefore } from "date-fns";
import { toast } from "sonner";

export default function BulkInvoiceGenerator() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-bulk-invoice'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const { data: bandMembers = [] } = useQuery({
    queryKey: ['band-members-bulk'],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users;
    },
    initialData: [],
  });

  // Find all past invoice bookings without invoices
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const eligibleBookings = bookings.filter(booking => {
    const eventDate = new Date(booking.event_date);
    eventDate.setHours(23, 59, 59, 999);
    
    return booking.payment_method === 'invoice' && 
           !booking.invoice_generated &&
           isBefore(eventDate, today);
  });

  // Don't render if no invoices are needed
  if (eligibleBookings.length === 0) {
    return null;
  }

  const generateAllInvoices = async () => {
    if (eligibleBookings.length === 0) {
      toast.error('No eligible bookings found to generate invoices for.');
      return;
    }

    console.log('🚀 STARTING BULK INVOICE GENERATION');
    console.log(`Eligible bookings to process: ${eligibleBookings.length}`);

    setGenerating(true);
    setProgress({ current: 0, total: eligibleBookings.length });

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (let i = 0; i < eligibleBookings.length; i++) {
      const booking = eligibleBookings[i];
      setProgress({ current: i + 1, total: eligibleBookings.length });

      console.log(`\n--- Processing booking ${i + 1}/${eligibleBookings.length}: "${booking.venue_name}" (ID: ${booking.id}) ---`);

      try {
        // Calculate tax year
        const eventDate = new Date(booking.event_date);
        const year = eventDate.getFullYear();
        const taxYearStart = new Date(year, 3, 6); // April 6th
        const taxYear = eventDate >= taxYearStart ? `${year}-${year + 1}` : `${year - 1}-${year}`;
        console.log(`Calculated tax year: ${taxYear} for event date ${format(eventDate, 'yyyy-MM-dd')}`);

        // 1. Create Invoice
        console.log('📝 Creating invoice...');
        let invoice = await base44.entities.Invoice.create({
          invoice_number: `INV-${booking.id.substring(0, 8)}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          booking_id: booking.id,
          client_name: booking.client_name,
          client_email: booking.client_email,
          issue_date: format(new Date(), 'yyyy-MM-dd'),
          due_date: format(new Date(booking.event_date), 'yyyy-MM-dd'),
          amount: booking.balance_due > 0 ? booking.balance_due : booking.fee,
          tax_year: taxYear,
          items: [{
            description: `Live Performance at ${booking.venue_name} on ${format(new Date(booking.event_date), 'MMM d, yyyy')}`,
            amount: booking.balance_due > 0 ? booking.balance_due : booking.fee
          }]
        });
        console.log(`✓ Invoice created successfully (ID: ${invoice.id}, Number: ${invoice.invoice_number})`);

        // 2. Generate PDF and update invoice with URL
        try {
          console.log('📄 Attempting to generate PDF...');
          if (typeof base44.entities.Invoice.generatePdf === 'function') {
            const pdfResult = await base44.entities.Invoice.generatePdf(invoice.id);
            console.log('   PDF generation raw result:', pdfResult);
            
            const pdfUrl = pdfResult?.pdf_url || pdfResult?.pdfUrl || pdfResult?.url; // Fallback for different field names
            if (pdfUrl) {
              invoice = await base44.entities.Invoice.update(invoice.id, { 
                pdf_url: pdfUrl 
              });
              console.log(`✓ PDF URL saved to invoice (URL: ${pdfUrl})`);
            } else {
              console.warn('⚠️ PDF generation completed, but no PDF URL found in the result. Invoice PDF URL might be missing.');
              errors.push({ booking: booking.venue_name, type: 'PDF URL Missing', invoiceId: invoice.id });
            }
          } else {
            console.warn('⚠️ `base44.entities.Invoice.generatePdf` method is not available. Skipping PDF generation.');
            errors.push({ booking: booking.venue_name, type: 'PDF Method Unavailable', invoiceId: invoice.id });
          }
        } catch (pdfError) {
          console.error(`❌ PDF generation failed for invoice ${invoice.id}:`, pdfError.message, pdfError.stack);
          errors.push({ booking: booking.venue_name, type: 'PDF Generation Error', invoiceId: invoice.id, error: pdfError.message });
        }

        // 3. Update booking to mark invoice as generated
        await base44.entities.Booking.update(booking.id, { invoice_generated: true });
        console.log('✓ Booking updated to invoice_generated: true');

        // 4. Create income records for the band
        await base44.entities.IncomeRecord.create({
          invoice_id: invoice.id,
          booking_id: booking.id,
          member_email: 'band',
          member_name: 'The Green Tangerine',
          income_date: booking.event_date,
          client_name: booking.client_name,
          venue_name: booking.venue_name,
          amount: invoice.amount,
          tax_year: taxYear,
          record_type: 'band_total',
          notes: `Bulk generated invoice ${invoice.invoice_number}`
        });
        console.log('✓ Band income record created');

        // 5. Create session payment records for band members
        if (bandMembers.length > 0) {
          const sessionAmount = invoice.amount / bandMembers.length;
          const sessionPayments = bandMembers.map(member => ({
            booking_id: booking.id,
            invoice_id: invoice.id,
            musician_email: member.email,
            musician_name: member.full_name,
            musician_display_name: member.display_name || member.full_name,
            payment_date: booking.event_date,
            event_date: booking.event_date,
            venue_name: booking.venue_name,
            amount: sessionAmount,
            tax_year: taxYear,
            paid: false,
            notes: `Bulk generated - Session payment for ${booking.venue_name}`
          }));

          await base44.entities.SessionPayment.bulkCreate(sessionPayments);
          console.log(`✓ Created ${sessionPayments.length} session payment records for band members`);
        } else {
          console.warn('⚠️ No band members found to create session payments for.');
        }

        successCount++;
        console.log(`✅ Successfully processed booking "${booking.venue_name}"`);

      } catch (error) {
        console.error(`❌ Failed to process booking "${booking.venue_name}" (ID: ${booking.id}):`, error);
        console.error('   Error details:', error.message, error.stack);
        failCount++;
        errors.push({ booking: booking.venue_name, bookingId: booking.id, type: 'Processing Error', error: error.message });
      }
    }

    setGenerating(false);
    
    console.log('\n📊 BULK GENERATION COMPLETE SUMMARY');
    console.log(`   Successful invoices: ${successCount}`);
    console.log(`   Failed invoices: ${failCount}`);
    if (errors.length > 0) {
      console.log('   Encountered errors:', errors);
      toast.error(`Completed with ${failCount} failure(s). Check console for details.`);
    } else {
      console.log('   No errors reported.');
    }

    // Invalidate queries to refetch updated data across the app
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['income-records'] });
    queryClient.invalidateQueries({ queryKey: ['session-payments'] }); // Invalidate new query key

    if (successCount > 0) {
      toast.success(`Generated ${successCount} invoice${successCount !== 1 ? 's' : ''} and associated records!`);
    }
    // If there were only failures, the error toast is already shown above due to `errors.length > 0`
    if (successCount === 0 && failCount > 0) {
      toast.error(`Failed to generate any invoices. Please check the console for errors.`);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-sm border-blue-500/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Bulk Invoice Generation
          </div>
          <Badge className="bg-blue-500/20 text-blue-400">
            {eligibleBookings.length} pending
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Generate invoices for all past gigs and create income records for tax tracking
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="text-blue-300 font-medium">📋 What this will do:</p>
              <ul className="text-gray-300 space-y-1 list-disc list-inside">
                <li>Generate invoices for {eligibleBookings.length} past gig{eligibleBookings.length !== 1 ? 's' : ''}</li>
                <li>Create band income record (full amount)</li>
                <li>Create {bandMembers.length} member session payment records (1/{bandMembers.length > 0 ? bandMembers.length : 'N/A'} share each)</li>
                <li>All records will appear in Expenses page for tax purposes</li>
              </ul>
            </div>
          </div>
        </div>

        {generating && (
          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Generating invoices...</span>
              <span className="text-sm text-blue-400 font-medium">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {eligibleBookings.map(booking => (
            <div key={booking.id} className="p-3 bg-white/5 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{booking.venue_name}</p>
                <p className="text-xs text-gray-400">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {format(new Date(booking.event_date), 'MMM d, yyyy')} • £{booking.fee}
                </p>
              </div>
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                Pending
              </Badge>
            </div>
          ))}
        </div>

        <Button
          onClick={generateAllInvoices}
          disabled={generating}
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 h-12"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating {progress.current}/{progress.total}...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5 mr-2" />
              Generate All {eligibleBookings.length} Invoices & Income Records
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
