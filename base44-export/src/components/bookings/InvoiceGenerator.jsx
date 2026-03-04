
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Save, FileText, Loader2 } from "lucide-react";
import { format, addDays, isAfter } from "date-fns";
import { toast } from "sonner";

export default function InvoiceGenerator({ booking, onClose }) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const { data: bandMembers = [] } = useQuery({
    queryKey: ['band-members'],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users;
    },
    initialData: [],
  });

  // Check if invoice already exists
  const { data: existingInvoices = [] } = useQuery({
    queryKey: ['existing-invoice', booking.id],
    queryFn: async () => {
      const invoices = await base44.entities.Invoice.filter({ booking_id: booking.id });
      return invoices;
    },
    initialData: [],
  });

  const existingInvoice = existingInvoices.length > 0 ? existingInvoices[0] : null;
  const isRegeneration = !!existingInvoice;

  const calculateInitialInvoiceAmount = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(booking.event_date);
    eventDate.setHours(0, 0, 0, 0);
    
    if (isAfter(eventDate, today)) {
      if (booking.deposit_paid === 0 && booking.fee > 0) {
        return booking.fee;
      }
      return booking.balance_due > 0 ? booking.balance_due : 0;
    }
    
    if (booking.balance_due > 0) {
      return booking.balance_due;
    } else if (booking.deposit_paid === 0 && booking.fee > 0) {
      return booking.fee;
    } else {
      return 0;
    }
  };

  const initialInvoiceAmount = calculateInitialInvoiceAmount();

  const [invoiceData, setInvoiceData] = useState({
    invoice_number: existingInvoice?.invoice_number || `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    booking_id: booking.id,
    client_name: booking.client_name,
    client_email: booking.client_email,
    issue_date: existingInvoice?.issue_date || format(new Date(), 'yyyy-MM-dd'),
    due_date: existingInvoice?.due_date || format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    amount: existingInvoice?.amount || initialInvoiceAmount,
    tax_year: existingInvoice?.tax_year || `${currentYear}/${currentYear + 1}`,
    items: existingInvoice?.items || [
      {
        description: `Live Performance at ${booking.venue_name} on ${format(new Date(booking.event_date), 'MMM d, yyyy')}`,
        amount: initialInvoiceAmount
      }
    ]
  });

  // User context is not explicitly provided in the original code.
  // Assuming 'user' would come from a global context or hook,
  // for this implementation we'll let `user` be undefined and rely on 'system' fallback,
  // as per the outline's `user?.email || 'system'`
  const user = undefined; 

  const createInvoiceMutation = useMutation({
    mutationFn: async (invoiceData) => {
      console.log('🎯 CREATING/REGENERATING INVOICE WITH BACKEND PDF GENERATION');
      
      let invoice;
      
      if (isRegeneration) {
        invoice = await base44.entities.Invoice.update(existingInvoice.id, invoiceData);
      } else {
        invoice = await base44.entities.Invoice.create(invoiceData);
      }
      
      // Generate PDF using backend function
      console.log('📄 Generating professional invoice PDF via backend...');
      
      try {
        const pdfResult = await base44.functions.invoke('generateInvoicePdf', {
          invoice_id: invoice.id
        });
        
        if (pdfResult.data && pdfResult.data.pdf_url) {
          invoice = await base44.entities.Invoice.update(invoice.id, { 
            pdf_url: pdfResult.data.pdf_url 
          });
          console.log('✅ PDF generated successfully:', pdfResult.data.pdf_url);

          // Create FileStorage record
          try {
            await base44.entities.FileStorage.create({
              file_name: `Invoice ${invoice.invoice_number}.pdf`,
              file_url: invoice.pdf_url,
              file_type: 'pdf',
              category: 'invoices',
              subcategory: 'client_invoice',
              uploaded_by_email: user?.email || 'system',
              uploaded_by_name: user?.full_name || 'System',
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
          console.warn('⚠️ PDF generation completed but no pdf_url was returned.');
          toast.error('PDF generation failed - please try again');
        }
      } catch (error) {
        console.error('❌ PDF generation error:', error);
        toast.error(`Failed to generate PDF: ${error.message || 'Unknown error'}`);
      }
      
      await base44.entities.Booking.update(booking.id, { 
        invoice_generated: true
      });
      
      const eventDate = new Date(booking.event_date);
      const year = eventDate.getFullYear();
      const taxYearStart = new Date(year, 3, 6);
      const taxYear = eventDate >= taxYearStart ? `${year}/${year + 1}` : `${year - 1}/${year}`;

      if (!isRegeneration) {
        const existingBandIncome = await base44.entities.IncomeRecord.filter({ 
          invoice_id: invoice.id,
          member_email: 'band'
        });
        
        if (!existingBandIncome || existingBandIncome.length === 0) {
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
            notes: `Client invoice ${invoice.invoice_number}`
          });
          console.log(`✓ Band income record created: £${invoice.amount}`);
        } else {
          console.log('ℹ️ Band income record already exists for this invoice, skipping creation.');
        }

        const sessionPaymentAmount = bandMembers.length > 0 ? invoice.amount / bandMembers.length : 0;
        const existingSessionPayments = await base44.entities.SessionPayment.filter({ invoice_id: invoice.id });
        
        if (bandMembers.length > 0 && (!existingSessionPayments || existingSessionPayments.length === 0)) {
          const sessionPayments = bandMembers.map(musician => ({
            booking_id: booking.id,
            invoice_id: invoice.id,
            musician_email: musician.email,
            musician_name: musician.full_name,
            musician_display_name: musician.display_name || musician.full_name,
            payment_date: booking.event_date,
            event_date: booking.event_date,
            venue_name: booking.venue_name,
            amount: sessionPaymentAmount,
            tax_year: taxYear,
            paid: false,
            notes: `Session payment for ${booking.venue_name}`
          }));

          await base44.entities.SessionPayment.bulkCreate(sessionPayments);
          console.log(`✓ Created ${bandMembers.length} session payments (£${sessionPaymentAmount.toFixed(2)} each)`);
        } else if (bandMembers.length === 0) {
          console.log('⚠️ No band members found, no session payments created.');
        } else {
          console.log('ℹ️ Session payments already exist for this invoice, skipping creation.');
        }
      } else {
        console.log('ℹ️ Regeneration - skipping income record and session payment creation to avoid duplicates.');
      }

      console.log('✅ INVOICE PROCESS COMPLETE');
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['income-records'] });
      queryClient.invalidateQueries({ queryKey: ['session-payments'] });
      queryClient.invalidateQueries({ queryKey: ['file-storage'] });
      toast.success(isRegeneration ? '✅ Invoice regenerated successfully!' : '✅ Invoice created successfully!');
      onClose();
    },
    onError: (error) => {
      console.error("❌ INVOICE PROCESS FAILED:", error);
      toast.error(error.message || 'Failed to process invoice');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isRegeneration) {
      if (!window.confirm('This will regenerate the invoice and PDF. Existing invoice data will be updated. Continue?')) {
        return;
      }
    }
    createInvoiceMutation.mutate(invoiceData);
  };

  const perMemberPayment = bandMembers.length > 0 ? (invoiceData.amount / bandMembers.length).toFixed(2) : 0;

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-blue-500/20 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {isRegeneration ? 'Regenerate Invoice' : 'Generate Invoice'}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
        {isRegeneration && (
          <p className="text-sm text-orange-400 mt-2">
            ⚠️ This booking already has an invoice. You can regenerate it to update details or create a new PDF.
          </p>
        )}
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <h4 className="font-semibold text-white mb-2">Booking Details</h4>
            <div className="text-sm text-gray-400 space-y-1">
              <p>Client: {booking.client_name}</p>
              <p>Event: {booking.venue_name} on {format(new Date(booking.event_date), 'MMM d, yyyy')}</p>
              <p>Total Fee: £{booking.fee}</p>
              {booking.deposit_paid > 0 && <p>Deposit Paid: £{booking.deposit_paid}</p>}
              {booking.balance_due > 0 && <p className="font-medium text-orange-400">Balance Due: £{booking.balance_due}</p>}
            </div>
          </div>

          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <h4 className="font-semibold text-green-400 mb-2">💼 Payment Flow:</h4>
            <div className="text-sm text-gray-300 space-y-1">
              <p>1. Invoice created for client (£{invoiceData.amount.toFixed(2)})</p>
              <p>2. Band receives payment from client</p>
              <p>3. {bandMembers.length} session payments created (£{perMemberPayment} each)</p>
              <p>4. Mark musicians as PAID when you pay them</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number" className="text-gray-300">Invoice Number *</Label>
              <Input
                id="invoice_number"
                value={invoiceData.invoice_number}
                onChange={(e) => setInvoiceData({...invoiceData, invoice_number: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_year" className="text-gray-300">Tax Year</Label>
              <Input
                id="tax_year"
                value={invoiceData.tax_year}
                onChange={(e) => setInvoiceData({...invoiceData, tax_year: e.target.value})}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue_date" className="text-gray-300">Issue Date *</Label>
              <Input
                id="issue_date"
                type="date"
                value={invoiceData.issue_date}
                onChange={(e) => setInvoiceData({...invoiceData, issue_date: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date" className="text-gray-300">Due Date *</Label>
              <Input
                id="due_date"
                type="date"
                value={invoiceData.due_date}
                onChange={(e) => setInvoiceData({...invoiceData, due_date: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="amount" className="text-gray-300">Invoice Amount (£) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={invoiceData.amount}
                onChange={(e) => setInvoiceData({...invoiceData, amount: parseFloat(e.target.value)})}
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="border-white/10">
            Cancel
          </Button>
          <Button 
            type="submit" 
            className={`${isRegeneration ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'}`}
            disabled={createInvoiceMutation.isPending}
          >
            {createInvoiceMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isRegeneration ? 'Regenerate Invoice' : 'Create Invoice'}
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
