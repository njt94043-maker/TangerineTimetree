
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Clock, PoundSterling, Calendar, CreditCard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isBefore } from "date-fns";
import { toast } from "sonner";

export default function PaymentReminder() {
  const queryClient = useQueryClient();
  const [updatingPayment, setUpdatingPayment] = useState(null);

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-payment-reminder'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async (booking) => { // Changed to receive the full booking object
      // Mark booking as fully paid by setting deposit_paid = fee, and updating payment status and balance.
      await base44.entities.Booking.update(booking.id, { 
        deposit_paid: booking.fee, // Ensure deposit_paid covers the full fee
        payment_status: 'paid_in_full',
        balance_due: 0
      });

      // Find and update the associated invoice (if one exists)
      const invoices = await base44.entities.Invoice.filter({ booking_id: booking.id });
      if (invoices.length > 0) {
        await base44.entities.Invoice.update(invoices[0].id, {
          paid: true,
          paid_date: format(new Date(), 'yyyy-MM-dd')
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings-payment-reminder'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] }); // Keep invalidating invoices
      toast.success('✅ Payment marked as received!');
    },
    onError: (error) => {
      toast.error(`Failed to update payment: ${error.message || 'Unknown error'}`);
    }
  });

  const handleMarkAsPaid = async (booking) => {
    setUpdatingPayment(booking.id);
    try {
      await updatePaymentMutation.mutateAsync(booking); // Pass the entire booking object
    } finally {
      setUpdatingPayment(null);
    }
  };

  // Filter for invoice bookings that need payment tracking
  const today = new Date();
  const unpaidInvoiceBookings = bookings.filter(booking => {
    const eventDate = new Date(booking.event_date);
    eventDate.setHours(23, 59, 59, 999);
    
    return booking.payment_method === 'invoice' && 
           booking.payment_status !== 'paid_in_full' &&
           isBefore(eventDate, today);
  });

  if (unpaidInvoiceBookings.length === 0) {
    return null;
  }

  // Separate by urgency
  const overduePayments = unpaidInvoiceBookings.filter(b => {
    const eventDate = new Date(b.event_date);
    const daysSinceEvent = Math.floor((today - eventDate) / (1000 * 60 * 60 * 24));
    return daysSinceEvent > 30;
  });

  const recentPayments = unpaidInvoiceBookings.filter(b => {
    const eventDate = new Date(b.event_date);
    const daysSinceEvent = Math.floor((today - eventDate) / (1000 * 60 * 60 * 24));
    return daysSinceEvent <= 30;
  });

  return (
    <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-sm border-orange-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            Payment Status Reminders
          </CardTitle>
          <Badge className="bg-orange-500/20 text-orange-400">
            {unpaidInvoiceBookings.length} pending
          </Badge>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Mark invoice payments as received
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overdue Payments */}
        {overduePayments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <h4 className="text-sm font-semibold text-red-400">Overdue (30+ days)</h4>
            </div>
            <AnimatePresence>
              {overduePayments.map((booking) => (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">{booking.venue_name}</h4>
                        <Badge className="bg-red-500/20 text-red-400 text-xs">
                          {booking.payment_status === 'deposit_paid' ? 'Balance Due' : 'Unpaid'}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          <span>Event: {format(new Date(booking.event_date), 'MMM d, yyyy')}</span>
                          <span className="text-red-400">
                            ({Math.floor((today - new Date(booking.event_date)) / (1000 * 60 * 60 * 24))} days ago)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <PoundSterling className="w-3 h-3" />
                          <span>Amount due: £{booking.balance_due > 0 ? booking.balance_due.toFixed(2) : booking.fee.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleMarkAsPaid(booking)}
                      disabled={updatingPayment === booking.id}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 min-w-[120px]"
                    >
                      {updatingPayment === booking.id ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Mark as Paid
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Recent Payments */}
        {recentPayments.length > 0 && (
          <div className="space-y-3">
            {overduePayments.length > 0 && <div className="border-t border-white/10 my-4"></div>}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <h4 className="text-sm font-semibold text-orange-400">Recent Events</h4>
            </div>
            <AnimatePresence>
              {recentPayments.map((booking) => (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">{booking.venue_name}</h4>
                        <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                          {booking.payment_status === 'deposit_paid' ? 'Balance Due' : 'Unpaid'}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          <span>Event: {format(new Date(booking.event_date), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <PoundSterling className="w-3 h-3" />
                          <span>Amount due: £{booking.balance_due > 0 ? booking.balance_due.toFixed(2) : booking.fee.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleMarkAsPaid(booking)}
                      disabled={updatingPayment === booking.id}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 min-w-[120px]"
                    >
                      {updatingPayment === booking.id ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Mark as Paid
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
