
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, PoundSterling, Calendar, Users, Loader2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { generateSessionInvoicePDF } from './SessionInvoiceGenerator';

export default function SessionPaymentTracker() {
  const queryClient = useQueryClient();
  const [processingPayment, setProcessingPayment] = useState(null);
  const [processingGig, setProcessingGig] = useState(null);
  const [expandedGigs, setExpandedGigs] = useState(new Set());

  const { data: sessionPayments = [] } = useQuery({
    queryKey: ['session-payments-tracker'],
    queryFn: () => base44.entities.SessionPayment.list('-event_date'),
    initialData: [],
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-tracker'],
    queryFn: () => base44.auth.me(),
  });

  const unpaidPayments = sessionPayments.filter(sp => !sp.paid);
  const paidPayments = sessionPayments.filter(sp => sp.paid);
  const totalUnpaid = unpaidPayments.reduce((sum, sp) => sum + sp.amount, 0);
  const totalPaid = paidPayments.reduce((sum, sp) => sum + sp.amount, 0);

  // Group unpaid payments by booking
  const gigGroups = unpaidPayments.reduce((acc, payment) => {
    const key = payment.booking_id;
    if (!acc[key]) {
      acc[key] = {
        booking_id: payment.booking_id,
        venue_name: payment.venue_name,
        event_date: payment.event_date,
        invoice_id: payment.invoice_id,
        tax_year: payment.tax_year,
        payments: []
      };
    }
    acc[key].payments.push(payment);
    return acc;
  }, {});

  const gigGroupsArray = Object.values(gigGroups);

  const markAsPaidMutation = useMutation({
    mutationFn: async (sessionPayment) => {
      console.log('💰 MARKING SESSION PAYMENT AS PAID - CREATING EXPENSE & INCOME');
      
      // 1. Generate session invoice PDF first
      console.log('📄 Generating session invoice PDF...');
      const pdfResult = await base44.functions.invoke('generateSessionInvoicePdf', {
        session_payment_id: sessionPayment.id
      });
      
      const sessionInvoicePdfUrl = pdfResult.data?.pdf_url;
      console.log(`✓ Session invoice generated: ${sessionInvoicePdfUrl}`);
      
      // 2. Mark payment as paid
      await base44.entities.SessionPayment.update(sessionPayment.id, {
        paid: true,
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        session_invoice_pdf_url: sessionInvoicePdfUrl
      });
      console.log(`✓ Session payment ${sessionPayment.id} marked as PAID`);

      // 3. Create band expense (with link to session invoice)
      const expenseData = {
        invoice_id: sessionPayment.invoice_id,
        member_email: 'band',
        member_name: 'The Green Tangerine',
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        category: 'session_payment',
        description: `Session payment to ${sessionPayment.musician_display_name || sessionPayment.musician_name} for ${sessionPayment.venue_name}`,
        amount: sessionPayment.amount,
        tax_year: sessionPayment.tax_year,
        notes: `Payment for booking ${sessionPayment.booking_id}. Session invoice: ${sessionInvoicePdfUrl}`,
        expense_type: 'band',
        receipt_url: sessionInvoicePdfUrl // Link to session invoice
      };
      
      await base44.entities.Expense.create(expenseData);
      console.log(`✓ Band expense created: £${sessionPayment.amount} to ${sessionPayment.musician_display_name}`);

      // 4. Create member income
      const incomeData = {
        invoice_id: sessionPayment.invoice_id,
        booking_id: sessionPayment.booking_id,
        member_email: sessionPayment.musician_email,
        member_name: sessionPayment.musician_name,
        income_date: sessionPayment.event_date,
        client_name: 'The Green Tangerine (Band)',
        venue_name: sessionPayment.venue_name,
        amount: sessionPayment.amount,
        tax_year: sessionPayment.tax_year,
        record_type: 'member_share',
        notes: `Session musician payment for ${sessionPayment.venue_name}. Invoice: ${sessionInvoicePdfUrl}`
      };
      
      await base44.entities.IncomeRecord.create(incomeData);
      console.log(`✓ Member income created: £${sessionPayment.amount} for ${sessionPayment.musician_email}`);

      return sessionPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-payments-tracker'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['income-records'] });
      queryClient.invalidateQueries({ queryKey: ['band-expenses-finances'] });
      queryClient.invalidateQueries({ queryKey: ['band-income-finances'] });
      toast.success('✅ Payment marked as paid! Expense and income records created.');
      setProcessingPayment(null);
    },
    onError: (error) => {
      console.error('Error marking payment as paid:', error);
      toast.error(`Failed to process payment: ${error.message}`);
      setProcessingPayment(null);
    }
  });

  const payAllForGigMutation = useMutation({
    mutationFn: async (gigGroup) => {
      console.log(`💰 PAYING ALL MUSICIANS FOR GIG: ${gigGroup.venue_name}`);
      
      for (const payment of gigGroup.payments) {
        // Generate session invoice
        console.log(`📄 Generating session invoice PDF for payment ${payment.id}...`);
        const pdfResult = await base44.functions.invoke('generateSessionInvoicePdf', {
          session_payment_id: payment.id
        });
        
        const sessionInvoicePdfUrl = pdfResult.data?.pdf_url;
        console.log(`✓ Session invoice generated: ${sessionInvoicePdfUrl}`);

        // Update session payment
        await base44.entities.SessionPayment.update(payment.id, {
          paid: true,
          payment_date: format(new Date(), 'yyyy-MM-dd'),
          session_invoice_pdf_url: sessionInvoicePdfUrl
        });

        // Create band expense
        await base44.entities.Expense.create({
          invoice_id: payment.invoice_id,
          member_email: 'band',
          member_name: 'The Green Tangerine',
          expense_date: format(new Date(), 'yyyy-MM-dd'),
          category: 'session_payment',
          description: `Session payment to ${payment.musician_display_name || payment.musician_name} for ${payment.venue_name}`,
          amount: payment.amount,
          tax_year: payment.tax_year,
          notes: `Payment for booking ${payment.booking_id}. Session invoice: ${sessionInvoicePdfUrl}`,
          expense_type: 'band',
          receipt_url: sessionInvoicePdfUrl
        });

        // Create member income
        await base44.entities.IncomeRecord.create({
          invoice_id: payment.invoice_id,
          booking_id: payment.booking_id,
          member_email: payment.musician_email,
          member_name: payment.musician_name,
          income_date: payment.event_date,
          client_name: 'The Green Tangerine (Band)',
          venue_name: payment.venue_name,
          amount: payment.amount,
          tax_year: payment.tax_year,
          record_type: 'member_share',
          notes: `Session musician payment for ${payment.venue_name}. Invoice: ${sessionInvoicePdfUrl}`
        });
      }

      return gigGroup;
    },
    onSuccess: (gigGroup) => {
      queryClient.invalidateQueries({ queryKey: ['session-payments-tracker'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['income-records'] });
      queryClient.invalidateQueries({ queryKey: ['band-expenses-finances'] });
      queryClient.invalidateQueries({ queryKey: ['band-income-finances'] });
      toast.success(`✅ All musicians paid for ${gigGroup.venue_name}!`);
      setProcessingGig(null);
    },
    onError: (error) => {
      console.error('Error paying all musicians:', error);
      toast.error(`Failed to process payments: ${error.message}`);
      setProcessingGig(null);
    }
  });

  const handleMarkPaid = async (sessionPayment) => {
    if (!window.confirm(
      `Mark payment as PAID?\n\n` +
      `Musician: ${sessionPayment.musician_display_name || sessionPayment.musician_name}\n` +
      `Amount: £${sessionPayment.amount.toFixed(2)}\n` +
      `Event: ${sessionPayment.venue_name}\n\n` +
      `This will:\n` +
      `1. Generate session invoice PDF\n` +
      `2. Create band expense (£${sessionPayment.amount.toFixed(2)})\n` +
      `3. Create musician income (£${sessionPayment.amount.toFixed(2)})\n` +
      `4. Mark payment as paid`
    )) {
      return;
    }

    setProcessingPayment(sessionPayment.id);
    markAsPaidMutation.mutate(sessionPayment);
  };

  const handlePayAllForGig = async (gigGroup) => {
    const totalAmount = gigGroup.payments.reduce((sum, p) => sum + p.amount, 0);
    
    if (!window.confirm(
      `Pay ALL musicians for this gig?\n\n` +
      `Event: ${gigGroup.venue_name}\n` +
      `Date: ${format(new Date(gigGroup.event_date), 'MMM d, yyyy')}\n` +
      `Musicians: ${gigGroup.payments.length}\n` +
      `Total: £${totalAmount.toFixed(2)}\n\n` +
      `This will generate a session invoice for each payment, mark all ${gigGroup.payments.length} payments as paid and create all expense/income records.`
    )) {
      return;
    }

    setProcessingGig(gigGroup.booking_id);
    payAllForGigMutation.mutate(gigGroup);
  };

  const toggleGigExpanded = (bookingId) => {
    const newExpanded = new Set(expandedGigs);
    if (newExpanded.has(bookingId)) {
      newExpanded.delete(bookingId);
    } else {
      newExpanded.add(bookingId);
    }
    setExpandedGigs(newExpanded);
  };

  if (!currentUser?.is_band_manager) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm border-green-500/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-400" />
            Session Musician Payments
          </div>
          <div className="flex gap-2">
            <Badge className="bg-orange-500/20 text-orange-400">
              {unpaidPayments.length} unpaid
            </Badge>
            <Badge className="bg-green-500/20 text-green-400">
              {paidPayments.length} paid
            </Badge>
          </div>
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Track subcontractor payments to session musicians
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="bg-white/5 border-orange-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Total Unpaid</p>
                  <p className="text-2xl font-bold text-orange-400">£{totalUnpaid.toFixed(2)}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-400" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {gigGroupsArray.length} gig{gigGroupsArray.length !== 1 ? 's' : ''}, {unpaidPayments.length} payment{unpaidPayments.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-green-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Total Paid</p>
                  <p className="text-2xl font-bold text-green-400">£{totalPaid.toFixed(2)}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {paidPayments.length} payment{paidPayments.length !== 1 ? 's' : ''} completed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Payments - Grouped by Gig */}
        {gigGroupsArray.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-orange-400 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Payments by Gig
            </h3>
            <div className="space-y-3">
              {gigGroupsArray.map(gigGroup => {
                const gigTotal = gigGroup.payments.reduce((sum, p) => sum + p.amount, 0);
                const isExpanded = expandedGigs.has(gigGroup.booking_id);
                const isProcessing = processingGig === gigGroup.booking_id;

                return (
                  <Card key={gigGroup.booking_id} className="bg-white/5 border-orange-500/20">
                    <CardContent className="p-4">
                      {/* Gig Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleGigExpanded(gigGroup.booking_id)}
                              className="text-left flex-1"
                            >
                              <h4 className="font-semibold text-white text-base flex items-center gap-2">
                                {gigGroup.venue_name}
                                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </h4>
                              <div className="flex flex-wrap gap-2 mt-1 text-xs">
                                <Badge variant="outline" className="border-gray-500 text-gray-300">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {format(new Date(gigGroup.event_date), 'MMM d, yyyy')}
                                </Badge>
                                <Badge className="bg-blue-500/20 text-blue-400">
                                  {gigGroup.payments.length} musician{gigGroup.payments.length !== 1 ? 's' : ''}
                                </Badge>
                                <Badge className="bg-green-500/20 text-green-400">
                                  <PoundSterling className="w-3 h-3 mr-1" />
                                  {gigTotal.toFixed(2)} total
                                </Badge>
                              </div>
                            </button>
                          </div>
                        </div>
                        <Button
                          onClick={() => handlePayAllForGig(gigGroup)}
                          disabled={isProcessing}
                          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 whitespace-nowrap ml-4"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Pay All
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Individual Payments (Expanded) */}
                      {isExpanded && (
                        <div className="space-y-2 pl-4 border-l-2 border-orange-500/30">
                          {gigGroup.payments.map(payment => (
                            <div key={payment.id} className="p-3 bg-white/5 rounded-lg flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">
                                  {payment.musician_display_name || payment.musician_name}
                                </p>
                                <p className="text-xs text-gray-400">{payment.musician_email}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge className="bg-green-500/20 text-green-400">
                                  £{payment.amount.toFixed(2)}
                                </Badge>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkPaid(payment)}
                                    disabled={processingPayment === payment.id}
                                    variant="outline"
                                    className="border-green-500/30 text-green-400"
                                  >
                                    {processingPayment === payment.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <CheckCircle className="w-3 h-3" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => generateSessionInvoicePDF(payment, currentUser)}
                                    className="border-blue-500/30 text-blue-400"
                                  >
                                    Invoice
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Paid Payments */}
        {paidPayments.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Completed Payments
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {paidPayments.slice(0, 10).map(payment => (
                <div key={payment.id} className="p-3 bg-white/5 rounded-lg border border-green-500/20 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {payment.musician_display_name || payment.musician_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {payment.venue_name} • {format(new Date(payment.event_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-400">£{payment.amount.toFixed(2)}</p>
                    <Badge className="bg-green-500/20 text-green-400 text-xs">Paid</Badge>
                  </div>
                </div>
              ))}
              {paidPayments.length > 10 && (
                <p className="text-xs text-gray-500 text-center py-2">
                  ...and {paidPayments.length - 10} more
                </p>
              )}
            </div>
          </div>
        )}

        {sessionPayments.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No session payments to track</p>
            <p className="text-sm text-gray-500 mt-1">Create invoices for bookings to generate session payments</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
