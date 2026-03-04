
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import BookingList from "../components/bookings/BookingList";
import InvoiceGenerator from "../components/bookings/InvoiceGenerator";
import CalendarView from "../components/calendar/CalendarView";
import { useOfflineManager } from "../components/offline/OfflineManager";
import OfflineIndicator from "../components/offline/OfflineIndicator";
import { motion } from "framer-motion"; // Add framer-motion import

// New imports for additional components
import PaymentReminder from "../components/bookings/PaymentReminder";
import BulkInvoiceGenerator from "../components/bookings/BulkInvoiceGenerator";
import RetroactiveRecordGenerator from "../components/bookings/RetroactiveRecordGenerator";
import RegenerateMissingPDFs from "../components/bookings/RegenerateMissingPDFs";
import DeepTestAnalyzer from "../components/bookings/DeepTestAnalyzer";


export default function BookingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  // Check URL params for calendar view and month
  const urlParams = new URLSearchParams(window.location.search);
  const showCalendarParam = urlParams.get('showCalendar') === 'true';
  const monthParam = urlParams.get('month');

  const [editingBooking, setEditingBooking] = useState(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(null);
  const [showCalendar, setShowCalendar] = useState(showCalendarParam); // Initial state for calendar view from URL
  const [initialMonth, setInitialMonth] = useState(monthParam ? new Date(monthParam) : new Date()); // Initial month from URL
  const [prefilledDate, setPrefilledDate] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [currentUser, setCurrentUser] = useState(null); // State to hold current user info

  const { isOnline, addToOfflineQueue, cacheBookings, getCachedBookings, syncOfflineQueue, queueLength } = useOfflineManager();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        setCurrentUser(null);
      }
    };
    loadUser();
  }, []);

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      try {
        const data = await base44.entities.Booking.list('-event_date');
        cacheBookings(data);
        return data;
      } catch (error) {
        // If offline, return cached data
        const cached = getCachedBookings();
        if (cached) return cached;
        throw error;
      }
    },
    initialData: () => {
      // Try to load cached data initially
      return getCachedBookings() || [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-issue_date'),
    initialData: [],
    enabled: isOnline,
  });

  // Debug logging
  React.useEffect(() => {
    if (invoices && invoices.length > 0) {
      console.log('📄 Total invoices loaded:', invoices.length);
      console.log('Sample invoice data:', invoices[0]);
    }
  }, [invoices]);

  const createBookingMutation = useMutation({
    mutationFn: async (bookingData) => {
      if (!isOnline) {
        // Add to offline queue
        addToOfflineQueue({
          type: 'create',
          data: bookingData
        });

        // Update local cache optimistically
        const currentBookings = queryClient.getQueryData(['bookings']) || [];
        const newBooking = {
          ...bookingData,
          id: `offline_${Date.now()}`, // Temporary ID for offline items
          created_date: new Date().toISOString(), // Add creation date
          _offline: true // Flag to indicate it's an offline creation
        };
        queryClient.setQueryData(['bookings'], [...currentBookings, newBooking]);

        return newBooking; // Return the optimistic update
      }
      return base44.entities.Booking.create(bookingData);
    },
    onSuccess: () => {
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
      }
      setShowForm(false);
      setEditingBooking(null);
      setPrefilledDate(null);
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, bookingData }) => {
      // ALWAYS recalculate balance_due on update
      const fee = parseFloat(bookingData.fee) || 0;
      const depositPaid = parseFloat(bookingData.deposit_paid) || 0;
      const balanceDue = fee - depositPaid;
      
      // Auto-determine payment status
      let paymentStatus = bookingData.payment_status;
      if (balanceDue <= 0 && fee > 0) {
        paymentStatus = 'paid_in_full';
      } else if (depositPaid > 0 && balanceDue > 0) {
        paymentStatus = 'deposit_paid';
      } else if (depositPaid === 0 && fee === 0) { // If fee is 0, it's also considered unpaid until explicitly marked otherwise
        paymentStatus = 'unpaid';
      } else if (depositPaid === 0 && balanceDue > 0) {
        paymentStatus = 'unpaid';
      }
      
      const finalData = {
        ...bookingData,
        balance_due: balanceDue,
        payment_status: paymentStatus
      };
      
      if (!isOnline) {
        addToOfflineQueue({
          type: 'update',
          id,
          data: finalData
        });

        const currentBookings = queryClient.getQueryData(['bookings']) || [];
        const updatedBookings = currentBookings.map(b =>
          b.id === id ? { ...b, ...finalData, _offline: true } : b
        );
        queryClient.setQueryData(['bookings'], updatedBookings);

        return { id, ...finalData };
      }
      return base44.entities.Booking.update(id, finalData);
    },
    onSuccess: () => {
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
      }
      setShowForm(false);
      setEditingBooking(null);
      setPrefilledDate(null);
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (id) => {
      if (!isOnline) {
        // Add to offline queue
        addToOfflineQueue({
          type: 'delete',
          id
        });

        // Update local cache optimistically
        const currentBookings = queryClient.getQueryData(['bookings']) || [];
        queryClient.setQueryData(['bookings'], currentBookings.filter(b => b.id !== id));

        return { id }; // Return the optimistic update
      }
      return base44.entities.Booking.delete(id);
    },
    onSuccess: () => {
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
      }
    },
  });

  const handleSubmit = (bookingData) => {
    // Ensure balance_due and payment_status are calculated here too
    const fee = parseFloat(bookingData.fee) || 0;
    const depositPaid = parseFloat(bookingData.deposit_paid) || 0;
    const balanceDue = fee - depositPaid;
    
    let paymentStatus = bookingData.payment_status;
    if (balanceDue <= 0 && fee > 0) {
      paymentStatus = 'paid_in_full';
    } else if (depositPaid > 0 && balanceDue > 0) {
      paymentStatus = 'deposit_paid';
    } else if (depositPaid === 0 && fee === 0) { // If fee is 0, it's also considered unpaid until explicitly marked otherwise
        paymentStatus = 'unpaid';
    } else if (depositPaid === 0 && balanceDue > 0) {
      paymentStatus = 'unpaid';
    }

    const finalData = { 
      ...bookingData, 
      balance_due: balanceDue,
      payment_status: paymentStatus
    };

    if (editingBooking) {
      updateBookingMutation.mutate({ id: editingBooking.id, bookingData: finalData });
    } else {
      createBookingMutation.mutate(finalData);
    }
  };

  const handleEdit = (booking) => {
    setEditingBooking(booking);
    setShowForm(false); // Don't show form at top when editing, will be shown inline
    setShowCalendar(false);
    setPrefilledDate(null); // Clear pre-filled date when editing
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      deleteBookingMutation.mutate(id);
    }
  };

  const handleGenerateInvoice = (booking) => {
    setGeneratingInvoice(booking);
  };

  const handleCreateForDate = (date) => {
    setPrefilledDate(date);
    setEditingBooking(null);
    setShowForm(true);
    setShowCalendar(false);
    setInitialLoad(false); // Mark as not initial load

    // Scroll to top where form appears
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const handleEventClick = (booking) => {
    setShowCalendar(false);
    setInitialLoad(false); // Mark as not initial load

    setTimeout(() => {
      const element = document.getElementById(`booking-${booking.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-green-500');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-green-500');
        }, 2000);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen"> {/* py-8 removed from here */}
      <OfflineIndicator
        isOnline={isOnline}
        queueLength={queueLength}
        onSync={syncOfflineQueue}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"> {/* py-8 added here */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="text-center sm:text-left mb-4 sm:mb-0">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Bookings & Invoices</h1>
              <p className="text-gray-400 hidden sm:block">Manage client bookings and invoices</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <Button
                onClick={() => setShowCalendar(!showCalendar)}
                variant={showCalendar ? "default" : "outline"}
                className={showCalendar ? "bg-gradient-to-r from-green-500 to-green-600" : "border-green-500/50 text-green-400 hover:bg-green-500/10"}
              >
                <Calendar className="w-5 h-5 mr-2" />
                {showCalendar ? 'List View' : 'Calendar'}
              </Button>
              <Button
                onClick={() => {
                  setEditingBooking(null);
                  setPrefilledDate(null);
                  setShowForm(true);
                  setShowCalendar(false);
                  setInitialLoad(false);
                }}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Booking
              </Button>
            </div>
          </div>

          {currentUser?.is_band_manager && (
            <>
              <RegenerateMissingPDFs />
              <PaymentReminder bookings={bookings} />
              <BulkInvoiceGenerator />
            </>
          )}

          {/* Only show form at top when creating new booking (showForm is true and editingBooking is null) */}
          {showForm && !editingBooking && (
            <BookingForm
              booking={null} // For new booking, pass null
              prefilledDate={prefilledDate} // Pass prefilledDate to the form
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingBooking(null); // Clear editingBooking state as well
                setPrefilledDate(null); // Clear pre-filled date on cancel
              }}
            />
          )}

          {generatingInvoice && (
            <InvoiceGenerator
              booking={generatingInvoice}
              onClose={() => setGeneratingInvoice(null)}
            />
          )}

          {showCalendar ? (
            <CalendarView
              bookings={bookings}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onEventClick={handleEventClick}
              onCreateForDate={handleCreateForDate} // Pass new handler for creating from calendar
              initialMonth={initialMonth}
            />
          ) : (
            <BookingList
              bookings={bookings}
              invoices={invoices}
              editingBooking={editingBooking} // Pass the booking being edited
              onEdit={handleEdit}
              onDelete={handleDelete}
              onGenerateInvoice={handleGenerateInvoice}
              onSubmitEdit={handleSubmit} // Pass submit handler for inline edit form
              onCancelEdit={() => setEditingBooking(null)} // Pass cancel handler for inline edit form
              shouldAutoScroll={initialLoad} // Only auto-scroll on initial load
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
