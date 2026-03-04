
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Calendar, MapPin, Mail, Phone, PoundSterling, FileText, Pencil, Trash2, User, Zap, Search, X } from "lucide-react";
import BookingForm from "./BookingForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function BookingList({ bookings, invoices, editingBooking, onEdit, onDelete, onGenerateInvoice, onSubmitEdit, onCancelEdit, shouldAutoScroll }) {
  const nextGigRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);

  const paymentStatusColors = {
    unpaid: "bg-red-500/20 text-red-400",
    deposit_paid: "bg-yellow-500/20 text-yellow-400",
    paid_in_full: "bg-green-500/20 text-green-400"
  };

  const statusColors = {
    pending: "bg-yellow-500/20 text-yellow-400",
    confirmed: "bg-green-500/20 text-green-400",
    completed: "bg-blue-500/20 text-blue-400",
    cancelled: "bg-red-500/20 text-red-400"
  };

  const paymentMethodColors = {
    invoice: "bg-blue-500/20 text-blue-400",
    cash: "bg-green-500/20 text-green-400"
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter bookings based on search
  const filteredBookings = bookings.filter(booking => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      booking.venue_name?.toLowerCase().includes(search) ||
      booking.client_name?.toLowerCase().includes(search) ||
      booking.venue_address?.toLowerCase().includes(search) ||
      format(new Date(booking.event_date), 'MMM d, yyyy').toLowerCase().includes(search)
    );
  });

  const sortedBookings = [...filteredBookings].sort((a, b) => {
    const dateA = new Date(a.event_date);
    const dateB = new Date(b.event_date);
    return dateA - dateB;
  });

  const nextGigIndex = sortedBookings.findIndex(booking => {
    const bookingDate = new Date(booking.event_date);
    bookingDate.setHours(0, 0, 0, 0);
    return bookingDate >= today;
  });

  // Debug: Log invoices to see what we have
  React.useEffect(() => {
    if (invoices && invoices.length > 0) {
      console.log('📄 Invoices available in BookingList:', invoices.length);
      console.log('Sample invoice:', invoices[0]);
    }
  }, [invoices]);

  useEffect(() => {
    if (shouldAutoScroll && nextGigRef.current) {
      setTimeout(() => {
        nextGigRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300);
    }
  }, [shouldAutoScroll]);

  const handleDeleteClick = (booking) => {
    setBookingToDelete(booking);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (bookingToDelete) {
      onDelete(bookingToDelete.id);
    }
    setDeleteDialogOpen(false);
    setBookingToDelete(null);
  };

  return (
    <>
      <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-white">All Bookings</CardTitle>
              <p className="text-sm text-gray-400 mt-1">
                {sortedBookings.length} booking{sortedBookings.length !== 1 ? 's' : ''} • Next gig highlighted
              </p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search bookings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/5 border-white/10 text-white pl-10 pr-10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedBookings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-2">
                {searchTerm ? 'No bookings found' : 'No bookings yet'}
              </p>
              <p className="text-gray-500 text-sm">
                {searchTerm ? 'Try a different search term' : 'Create your first booking to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedBookings.map((booking, index) => {
                const isNextGig = index === nextGigIndex;
                const bookingDate = new Date(booking.event_date);
                bookingDate.setHours(0, 0, 0, 0);
                const isPast = bookingDate < today;
                const isBeingEdited = editingBooking?.id === booking.id;
                const hasInvoice = booking.invoice_generated;

                return (
                  <React.Fragment key={booking.id}>
                    <div
                      ref={isNextGig ? nextGigRef : null}
                      id={`booking-${booking.id}`}
                      className={`p-4 rounded-lg transition-all relative ${
                        isNextGig
                          ? "bg-gradient-to-br from-green-500/20 to-orange-500/20 border-2 border-green-500 shadow-lg shadow-green-500/20"
                          : isPast
                          ? "bg-white/5 border border-white/10 opacity-60"
                          : "bg-white/5 border border-white/10"
                      }`}
                    >
                      {isNextGig && (
                        <div className="absolute -top-3 left-4 px-3 py-1 bg-gradient-to-r from-green-500 to-orange-500 rounded-full flex items-center gap-2 shadow-lg">
                          <Zap className="w-4 h-4 text-white animate-pulse" />
                          <span className="text-white font-bold text-sm uppercase tracking-wider">Next Gig</span>
                        </div>
                      )}

                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-3 gap-3">
                        <div className="flex-1 w-full md:w-auto">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-2 flex-wrap">
                            <h4 className={`font-semibold text-lg ${isNextGig ? 'text-green-400' : 'text-white'}`}>
                              {booking.venue_name}
                            </h4>
                            <div className="flex gap-2 flex-wrap">
                              <Badge className={statusColors[booking.status]}>
                                {booking.status}
                              </Badge>
                              <Badge className={paymentStatusColors[booking.payment_status]}>
                                {booking.payment_status.replace('_', ' ')}
                              </Badge>
                              <Badge className={paymentMethodColors[booking.payment_method || 'invoice']}>
                                {booking.payment_method || 'invoice'}
                              </Badge>
                              {booking.invoice_generated && (() => {
                                const invoice = invoices.find(inv => inv.booking_id === booking.id);
                                console.log(`🔍 Booking ${booking.id} - Looking for invoice:`, invoice);
                                if (invoice) {
                                  console.log(`📄 Invoice found: ${invoice.id}, PDF URL: ${invoice.pdf_url}`);
                                }
                                
                                if (invoice && invoice.pdf_url) {
                                  return (
                                    <a 
                                      href={invoice.pdf_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        console.log('📄 Opening PDF:', invoice.pdf_url);
                                      }}
                                      className="inline-block"
                                    >
                                      <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 cursor-pointer">
                                        <FileText className="w-3 h-3 mr-1" />
                                        View Invoice PDF
                                      </Badge>
                                    </a>
                                  );
                                } else if (invoice) {
                                  return (
                                    <Badge className="bg-orange-500/20 text-orange-400">
                                      <FileText className="w-3 h-3 mr-1" />
                                      Invoice (No PDF)
                                    </Badge>
                                  );
                                } else {
                                  return (
                                    <Badge className="bg-red-500/20 text-red-400">
                                      <FileText className="w-3 h-3 mr-1" />
                                      Invoice Missing
                                    </Badge>
                                  );
                                }
                              })()}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-400 mb-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 flex-shrink-0" />
                              <span className={isNextGig ? 'font-semibold text-orange-400' : ''}>
                                {format(new Date(booking.event_date), 'MMM d, yyyy')}
                                {booking.event_time && ` at ${booking.event_time}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 flex-shrink-0" />
                              {booking.client_name}
                            </div>
                            {booking.venue_address && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{booking.venue_address}</span>
                              </div>
                            )}
                            {booking.client_email && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{booking.client_email}</span>
                              </div>
                            )}
                            {booking.client_phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 flex-shrink-0" />
                                {booking.client_phone}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div className={`flex items-center gap-2 font-medium ${isNextGig ? 'text-green-400 font-bold' : 'text-green-400'}`}>
                              <PoundSterling className="w-4 h-4" />
                              Fee: £{booking.fee}
                            </div>
                            {booking.deposit_paid > 0 && (
                              <div className="text-gray-400">
                                Deposit: £{booking.deposit_paid}
                              </div>
                            )}
                            {booking.balance_due > 0 && (
                              <div className="text-orange-400">
                                Balance: £{booking.balance_due}
                              </div>
                            )}
                          </div>

                          {booking.notes && (
                            <p className="text-sm text-gray-400 mt-2">{booking.notes}</p>
                          )}
                        </div>

                        <div className="flex flex-col md:flex-row gap-2 mt-2 md:mt-0 items-end md:items-center w-full md:w-auto">
                          {/* Show invoice generation button for ALL invoice-method bookings */}
                          {booking.payment_method === 'invoice' && (
                            <Button
                              size="sm"
                              onClick={() => onGenerateInvoice(booking)}
                              className={`w-full md:w-auto min-h-[44px] ${
                                hasInvoice 
                                  ? 'bg-purple-600 hover:bg-purple-700' 
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              {hasInvoice ? 'Regenerate Invoice' : 'Generate Invoice'}
                            </Button>
                          )}
                          <div className="flex gap-2 w-full md:w-auto justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(booking)}
                              className="text-gray-400 hover:text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
                              title="Edit booking"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(booking)}
                              className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]"
                              title="Delete booking"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isBeingEdited && (
                      <div className="ml-0 md:ml-4 mr-0 md:mr-4">
                        <BookingForm
                          booking={editingBooking}
                          onSubmit={onSubmitEdit}
                          onCancel={onCancelEdit}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-red-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Booking?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete the booking at <strong className="text-white">{bookingToDelete?.venue_name}</strong> on{' '}
              <strong className="text-white">
                {bookingToDelete && format(new Date(bookingToDelete.event_date), 'MMM d, yyyy')}
              </strong>?
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
