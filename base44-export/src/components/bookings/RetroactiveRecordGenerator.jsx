import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { format, isBefore } from "date-fns";
import { toast } from "sonner";
import { generateSessionInvoicePDF } from '../expenses/SessionInvoiceGenerator';

export default function RetroactiveRecordGenerator() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-retroactive'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const { data: bandMembers = [] } = useQuery({
    queryKey: ['band-members-retroactive'],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users;
    },
    initialData: [],
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-retroactive'],
    queryFn: () => base44.auth.me(),
  });

  const { data: existingIncomeRecords = [] } = useQuery({
    queryKey: ['existing-income-records'],
    queryFn: () => base44.entities.IncomeRecord.list(),
    initialData: [],
  });

  const { data: existingSessionPayments = [] } = useQuery({
    queryKey: ['existing-session-payments'],
    queryFn: () => base44.entities.SessionPayment.list(),
    initialData: [],
  });

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const completedBookings = bookings.filter(booking => {
    const eventDate = new Date(booking.event_date);
    eventDate.setHours(23, 59, 59, 999);
    
    return booking.payment_method === 'invoice' && 
           booking.payment_status === 'paid_in_full' &&
           isBefore(eventDate, today);
  });

  const bookingsNeedingRecords = completedBookings.filter(booking => {
    const hasIncomeRecord = existingIncomeRecords.some(
      r => r.booking_id === booking.id && r.record_type === 'band_total'
    );
    const hasSessionPayments = existingSessionPayments.some(
      p => p.booking_id === booking.id
    );
    
    return !hasIncomeRecord || !hasSessionPayments;
  });

  if (bookingsNeedingRecords.length === 0 || !currentUser?.is_band_manager) {
    return null;
  }

  const generateAllRecords = async () => {
    if (bookingsNeedingRecords.length === 0) return;

    setGenerating(true);
    setProgress({ current: 0, total: bookingsNeedingRecords.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < bookingsNeedingRecords.length; i++) {
      const booking = bookingsNeedingRecords[i];
      setProgress({ current: i + 1, total: bookingsNeedingRecords.length });

      try {
        const eventDate = new Date(booking.event_date);
        const year = eventDate.getFullYear();
        const taxYearStart = new Date(year, 3, 6);
        const taxYear = eventDate >= taxYearStart ? `${year}-${year + 1}` : `${year - 1}-${year}`;

        const invoices = await base44.entities.Invoice.filter({ booking_id: booking.id });
        let invoice = invoices[0];

        if (!invoice) {
          invoice = await base44.entities.Invoice.create({
            invoice_number: `INV-${booking.id.substring(0, 8)}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            booking_id: booking.id,
            client_name: booking.client_name,
            client_email: booking.client_email,
            issue_date: format(new Date(booking.event_date), 'yyyy-MM-dd'),
            due_date: format(new Date(booking.event_date), 'yyyy-MM-dd'),
            amount: booking.fee,
            tax_year: taxYear,
            paid: true,
            paid_date: format(new Date(booking.event_date), 'yyyy-MM-dd'),
            items: [{
              description: `Live Performance at ${booking.venue_name} on ${format(new Date(booking.event_date), 'MMM d, yyyy')}`,
              amount: booking.fee
            }]
          });

          // Generate PDF using backend function
          try {
            console.log(`📄 Generating PDF for invoice ${invoice.id}...`);
            const pdfResult = await base44.functions.invoke('generateInvoicePdf', {
              invoice_id: invoice.id
            });
            
            if (pdfResult.data && pdfResult.data.pdf_url) {
              invoice = await base44.entities.Invoice.update(invoice.id, { 
                pdf_url: pdfResult.data.pdf_url 
              });
              console.log(`✅ PDF generated: ${pdfResult.data.pdf_url}`);

              // Create FileStorage record for the PDF
              try {
                await base44.entities.FileStorage.create({
                  file_name: `Invoice ${invoice.invoice_number}.pdf`,
                  file_url: pdfResult.data.pdf_url,
                  file_type: 'pdf',
                  category: 'invoices',
                  subcategory: 'client_invoice',
                  uploaded_by_email: currentUser?.email || 'system',
                  uploaded_by_name: currentUser?.full_name || 'System',
                  related_entity: 'Invoice',
                  related_entity_id: invoice.id,
                  description: `Client invoice for ${booking.client_name} - ${booking.venue_name}`,
                  tags: ['invoice', 'client', invoice.invoice_number, booking.venue_name],
                  visible_to_all: true
                });
                console.log('✓ FileStorage record created');
              } catch (error) {
                console.warn('Could not create FileStorage record:', error);
              }
            } else {
              console.warn(`⚠️ PDF generation completed but no pdf_url returned for invoice ${invoice.id}`);
            }
          } catch (pdfError) {
            console.error(`❌ Failed to generate PDF for invoice ${invoice.id}:`, pdfError);
          }

          await base44.entities.Booking.update(booking.id, { invoice_generated: true });
        }

        const hasBandIncome = existingIncomeRecords.some(
          r => r.booking_id === booking.id && r.record_type === 'band_total'
        );

        if (!hasBandIncome) {
          await base44.entities.IncomeRecord.create({
            invoice_id: invoice.id,
            booking_id: booking.id,
            member_email: 'band',
            member_name: 'The Green Tangerine',
            income_date: booking.event_date,
            client_name: booking.client_name,
            venue_name: booking.venue_name,
            amount: booking.fee,
            tax_year: taxYear,
            record_type: 'band_total',
            notes: `Band income from ${booking.venue_name} - Invoice ${invoice.invoice_number}`
          });
        }

        const hasSessionPayments = existingSessionPayments.some(
          p => p.booking_id === booking.id
        );

        if (!hasSessionPayments) {
          const sessionPaymentAmount = booking.fee / 4;
          const sessionPayments = [];

          for (const member of bandMembers) {
            const sessionPaymentData = {
              booking_id: booking.id,
              invoice_id: invoice.id,
              musician_email: member.email,
              musician_name: member.full_name,
              musician_display_name: member.display_name || member.full_name,
              payment_date: booking.event_date,
              event_date: booking.event_date,
              venue_name: booking.venue_name,
              amount: sessionPaymentAmount,
              tax_year: taxYear,
              paid: false,
              notes: `Session payment for ${booking.venue_name} (Retroactive - mark as paid when ready)`
            };

            sessionPayments.push(sessionPaymentData);
          }

          if (sessionPayments.length > 0) {
            await base44.entities.SessionPayment.bulkCreate(sessionPayments);
          }
        }

        successCount++;

      } catch (error) {
        console.error(`Failed to create records for booking ${booking.id}:`, error);
        failCount++;
      }
    }

    setGenerating(false);
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['income-records'] });
    queryClient.invalidateQueries({ queryKey: ['session-payments'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['file-storage'] });

    if (successCount > 0) {
      toast.success(`Generated records for ${successCount} past booking${successCount !== 1 ? 's' : ''}! Invoices, PDFs, and session payment records created.`);
    }
    if (failCount > 0) {
      toast.error(`Failed to generate records for ${failCount} booking${failCount !== 1 ? 's' : ''}`);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm border-cyan-500/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-cyan-400" />
            Update Past Bookings
          </div>
          <Badge className="bg-cyan-500/20 text-cyan-400">
            {bookingsNeedingRecords.length} need records
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Generate income and session payment records for past completed gigs
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="text-cyan-300 font-medium">📊 What this will do:</p>
              <ul className="text-gray-300 space-y-1 list-disc list-inside">
                <li>Create invoices & PDF files ({bookingsNeedingRecords.length} gig{bookingsNeedingRecords.length !== 1 ? 's' : ''})</li>
                <li>Create band income records (full amount)</li>
                <li>Create session payment records (4 per gig = {bookingsNeedingRecords.length * 4} total)</li>
                <li>All files saved to Files page</li>
                <li>Ready for HMRC export when you pay the musicians</li>
              </ul>
            </div>
          </div>
        </div>

        {generating && (
          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Generating records...</span>
              <span className="text-sm text-cyan-400 font-medium">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {bookingsNeedingRecords.slice(0, 10).map(booking => (
            <div key={booking.id} className="p-3 bg-white/5 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{booking.venue_name}</p>
                <p className="text-xs text-gray-400">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {format(new Date(booking.event_date), 'MMM d, yyyy')} • £{booking.fee}
                </p>
              </div>
              <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">
                Needs Records
              </Badge>
            </div>
          ))}
          {bookingsNeedingRecords.length > 10 && (
            <p className="text-xs text-gray-500 text-center py-2">
              ...and {bookingsNeedingRecords.length - 10} more
            </p>
          )}
        </div>

        <Button
          onClick={generateAllRecords}
          disabled={generating}
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 h-12"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating {progress.current}/{progress.total}...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5 mr-2" />
              Generate All Records + PDFs for Past Gigs
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}