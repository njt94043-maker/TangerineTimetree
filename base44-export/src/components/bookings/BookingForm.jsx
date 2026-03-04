
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Sparkles, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import AddressInput from "../forms/AddressInput";
import { toast } from "sonner";

export default function BookingForm({ booking, prefilledDate, onSubmit, onCancel }) {
  // Get smart defaults based on prefilled date
  const getSmartDefaults = () => {
    if (!prefilledDate) return { event_time: '', fee: '' };
    
    const date = new Date(prefilledDate);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    let defaultTime = '20:30'; // Default for weekdays
    if (dayOfWeek === 0) defaultTime = '17:00'; // Sunday
    else if (dayOfWeek === 5 || dayOfWeek === 6) defaultTime = '21:00'; // Fri/Sat
    
    return {
      event_time: defaultTime,
      fee: '300' // A reasonable default fee
    };
  };

  const smartDefaults = getSmartDefaults();

  const [formData, setFormData] = useState(booking || {
    venue_name: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    event_date: prefilledDate || '',
    event_time: smartDefaults.event_time,
    venue_address: '',
    event_type: 'pub_gig',
    fee: smartDefaults.fee,
    deposit_paid: '0',
    payment_method: 'cash',
    payment_status: 'unpaid',
    status: 'confirmed',
    notes: ''
  });

  const [autoFillSuggestion, setAutoFillSuggestion] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // New state for submission loading

  // Fetch all bookings to learn from and check duplicates
  const { data: allBookings = [] } = useQuery({
    queryKey: ['all-bookings-for-learning'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const [suggestions, setSuggestions] = useState({
    venues: [],
    clients: [],
    addresses: []
  });

  useEffect(() => {
    const saved = localStorage.getItem('booking_suggestions');
    if (saved) {
      setSuggestions(JSON.parse(saved));
    }
  }, []);

  // Check for duplicates whenever venue_name or event_date changes
  useEffect(() => {
    // Only perform this check if creating a new booking (not editing) and required fields are present
    if (!booking && formData.venue_name && formData.event_date) {
      const duplicates = allBookings.filter(b =>
        b.venue_name.toLowerCase() === formData.venue_name.toLowerCase() &&
        b.event_date === formData.event_date
      );

      if (duplicates.length > 0) {
        setDuplicateWarning(duplicates[0]);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      // Clear warning if editing an existing booking or if required fields are empty
      setDuplicateWarning(null);
    }
  }, [formData.venue_name, formData.event_date, allBookings, booking]);

  // Learn from venue selection and update time/fee dynamically
  useEffect(() => {
    if (formData.venue_name && !booking) {
      const venueBookings = allBookings.filter(b => 
        b.venue_name.toLowerCase() === formData.venue_name.toLowerCase()
      );

      if (venueBookings.length > 0) {
        // Find most common patterns for this venue
        const latestBooking = venueBookings[0];
        
        // Calculate average fee for this venue
        const avgFee = Math.round(
          venueBookings.reduce((sum, b) => sum + (b.fee || 0), 0) / venueBookings.length
        );

        // Most common event type for this venue
        const eventTypes = {};
        venueBookings.forEach(b => {
          eventTypes[b.event_type] = (eventTypes[b.event_type] || 0) + 1;
        });
        const commonEventType = Object.entries(eventTypes).sort((a, b) => b[1] - a[1])[0]?.[0];

        // Most common time for this venue
        const times = venueBookings.filter(b => b.event_time).map(b => b.event_time);
        const commonTime = times.length > 0 ? times[0] : '';

        const suggestion = {
          venue_address: latestBooking.venue_address || '',
          event_type: commonEventType || formData.event_type,
          fee: avgFee || '',
          event_time: commonTime || '',
          payment_method: latestBooking.payment_method || 'cash'
        };

        setAutoFillSuggestion(suggestion);

        // Dynamically update fields as venue is typed
        // Only auto-fill if fields are empty to preserve prefilledDate smart defaults or user input
        setFormData(prev => ({
          ...prev,
          venue_address: prev.venue_address || suggestion.venue_address,
          event_type: prev.event_type === 'pub_gig' ? suggestion.event_type : prev.event_type,
          fee: prev.fee || suggestion.fee, // Apply suggestion if current fee is empty
          event_time: prev.event_time || suggestion.event_time, // Apply suggestion if current time is empty
          payment_method: prev.payment_method === 'cash' ? suggestion.payment_method : prev.payment_method
        }));
      }
    }
  }, [formData.venue_name, allBookings, booking]);

  // Learn from client selection
  useEffect(() => {
    if (formData.client_name && !booking) {
      const clientBookings = allBookings.filter(b => 
        b.client_name.toLowerCase() === formData.client_name.toLowerCase()
      );

      if (clientBookings.length > 0) {
        const latestBooking = clientBookings[0];
        
        setFormData(prev => ({
          ...prev,
          client_email: prev.client_email || latestBooking.client_email || '',
          client_phone: prev.client_phone || latestBooking.client_phone || ''
        }));
      }
    }
  }, [formData.client_name, allBookings, booking]);

  // Smart event type suggestions based on venue name
  useEffect(() => {
    if (formData.venue_name && !booking) {
      const venueLower = formData.venue_name.toLowerCase();
      
      // Learn venue type patterns
      if (venueLower.includes('hotel') || venueLower.includes('hall') || venueLower.includes('manor')) {
        if (!formData.event_type || formData.event_type === 'pub_gig') {
          setFormData(prev => ({ ...prev, event_type: 'wedding' }));
        }
      } else if (venueLower.includes('pub') || venueLower.includes('bar') || venueLower.includes('inn')) {
        if (!formData.event_type || formData.event_type === 'wedding' || formData.event_type === 'corporate') {
          setFormData(prev => ({ ...prev, event_type: 'pub_gig' }));
        }
      } else if (venueLower.includes('corporate') || venueLower.includes('office') || venueLower.includes('center')) {
        if (!formData.event_type || formData.event_type === 'pub_gig') {
          setFormData(prev => ({ ...prev, event_type: 'corporate' }));
        }
      }
    }
  }, [formData.venue_name, booking]);

  // Auto-fill client name with venue name if left empty for new bookings
  useEffect(() => {
    if (formData.venue_name && !formData.client_name && !booking) {
      setFormData(prev => ({
        ...prev,
        client_name: formData.venue_name
      }));
    }
  }, [formData.venue_name, booking, formData.client_name]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.venue_name?.trim()) {
      toast.error('Venue name is required');
      return;
    }
    if (!formData.event_date) {
      toast.error('Event date is required');
      return;
    }
    if (parseFloat(formData.fee) <= 0) {
      toast.error('Fee must be greater than 0');
      return;
    }
    
    // Final duplicate check before submission
    if (duplicateWarning && !booking) {
      if (!window.confirm(`A booking already exists for ${formData.venue_name} on ${formData.event_date}. Create anyway?`)) {
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      const newSuggestions = { ...suggestions };
      
      if (formData.venue_name && !newSuggestions.venues.includes(formData.venue_name)) {
        newSuggestions.venues = [...newSuggestions.venues, formData.venue_name].slice(-20);
      }
      
      if (formData.client_name && !newSuggestions.clients.includes(formData.client_name)) {
        newSuggestions.clients = [...newSuggestions.clients, formData.client_name].slice(-20);
      }
      
      if (formData.venue_address && !newSuggestions.addresses.includes(formData.venue_address)) {
        newSuggestions.addresses = [...newSuggestions.addresses, formData.venue_address].slice(-20);
      }
      
      localStorage.setItem('booking_suggestions', JSON.stringify(newSuggestions));
      
      const finalClientName = formData.client_name?.trim() || formData.venue_name;
      
      // Calculate correct balance_due and payment_status
      const fee = parseFloat(formData.fee) || 0;
      const depositPaid = parseFloat(formData.deposit_paid) || 0;
      const balanceDue = fee - depositPaid;
      
      // Auto-determine payment status based on amounts
      let paymentStatus = formData.payment_status;
      if (balanceDue <= 0 && fee > 0) { // If balance is zero or less, and there was a fee to begin with
        paymentStatus = 'paid_in_full';
      } else if (depositPaid > 0 && balanceDue > 0) { // If a deposit was paid but balance still remains
        paymentStatus = 'deposit_paid';
      } else if (depositPaid === 0 && balanceDue > 0) { // If no deposit paid and balance remains
        paymentStatus = 'unpaid';
      }
      
      await onSubmit({
        ...formData,
        client_name: finalClientName,
        fee: fee,
        deposit_paid: depositPaid,
        balance_due: balanceDue,
        payment_status: paymentStatus
      });
      
      toast.success(booking ? 'Booking updated!' : 'Booking created!');
    } catch (error) {
      console.error('Error submitting booking:', error);
      toast.error('Failed to save booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            {booking 
              ? 'Edit Booking' 
              : prefilledDate 
                ? `New Booking for ${format(new Date(prefilledDate), 'MMM d, yyyy')}` 
                : 'New Booking'}
            {autoFillSuggestion && !booking && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Smart auto-fill active
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-400">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Duplicate Warning */}
          {duplicateWarning && !booking && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <X className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-red-400 mb-2">⚠️ Possible Duplicate Detected</h4>
                  <p className="text-sm text-gray-300 mb-2">
                    A booking already exists for <strong>{duplicateWarning.venue_name}</strong> on{' '}
                    <strong>{format(new Date(duplicateWarning.event_date), 'MMM d, yyyy')}</strong>
                  </p>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>Client: {duplicateWarning.client_name}</p>
                    {duplicateWarning.event_time && <p>Time: {duplicateWarning.event_time}</p>}
                    <p>Fee: £{duplicateWarning.fee}</p>
                    <p>Status: {duplicateWarning.status}</p>
                  </div>
                  <p className="text-sm text-red-400 mt-2">
                    Please check if this is the same booking before proceeding.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Top Row: Venue Name and Client Name */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="venue_name" className="text-gray-300">Venue Name *</Label>
              <Input
                id="venue_name"
                list="venue-suggestions"
                value={formData.venue_name}
                onChange={(e) => setFormData({...formData, venue_name: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
                placeholder="Start typing venue name..."
              />
              <datalist id="venue-suggestions">
                {suggestions.venues.map((venue, idx) => (
                  <option key={idx} value={venue} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_name" className="text-gray-300">
                Client Name {!formData.client_name && formData.venue_name && (
                  <span className="text-xs text-gray-500">(defaults to venue name)</span>
                )}
              </Label>
              <Input
                id="client_name"
                list="client-suggestions"
                value={formData.client_name}
                onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                className="bg-white/5 border-white/10 text-white"
                placeholder={formData.venue_name || "Auto-fills from venue name"}
              />
              <datalist id="client-suggestions">
                {suggestions.clients.map((client, idx) => (
                  <option key={idx} value={client} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_email" className="text-gray-300">Client Email</Label>
              <Input
                id="client_email"
                type="email"
                value={formData.client_email}
                onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_phone" className="text-gray-300">Client Phone</Label>
              <Input
                id="client_phone"
                value={formData.client_phone}
                onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_type" className="text-gray-300">Event Type</Label>
              <Select value={formData.event_type} onValueChange={(value) => setFormData({...formData, event_type: value})}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wedding">Wedding</SelectItem>
                  <SelectItem value="corporate">Corporate Event</SelectItem>
                  <SelectItem value="pub_gig">Pub Gig</SelectItem>
                  <SelectItem value="festival">Festival</SelectItem>
                  <SelectItem value="private_party">Private Party</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_date" className="text-gray-300">Event Date *</Label>
              <Input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData({...formData, event_date: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_time" className="text-gray-300">Event Time</Label>
              <Input
                id="event_time"
                type="time"
                value={formData.event_time}
                onChange={(e) => setFormData({...formData, event_time: e.target.value})}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fee" className="text-gray-300">Fee (£) *</Label>
              <Input
                id="fee"
                type="number"
                step="0.01"
                value={formData.fee}
                onChange={(e) => setFormData({...formData, fee: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method" className="text-gray-300">Payment Method *</Label>
              <Select value={formData.payment_method} onValueChange={(value) => setFormData({...formData, payment_method: value})}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit_paid" className="text-gray-300">Deposit Paid (£)</Label>
              <Input
                id="deposit_paid"
                type="number"
                step="0.01"
                value={formData.deposit_paid}
                onChange={(e) => setFormData({...formData, deposit_paid: e.target.value})}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_status" className="text-gray-300">Payment Status</Label>
              <Select value={formData.payment_status} onValueChange={(value) => setFormData({...formData, payment_status: value})}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="payment_pending">Payment Pending</SelectItem>
                  <SelectItem value="deposit_paid">Deposit Paid</SelectItem>
                  <SelectItem value="paid_in_full">Paid in Full</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-gray-300">Booking Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue_address" className="text-gray-300">Venue Address (for mileage calculation)</Label>
            <div className="space-y-2">
              <Input
                id="venue_address"
                list="address-suggestions"
                value={formData.venue_address}
                onChange={(e) => setFormData({...formData, venue_address: e.target.value})}
                className="bg-white/5 border-white/10 text-white"
                placeholder="Full address for GPS navigation and mileage"
              />
              <datalist id="address-suggestions">
                {suggestions.addresses.map((address, idx) => (
                  <option key={idx} value={address} />
                ))}
              </datalist>
              <p className="text-xs text-gray-500">
                💡 Tip: Enter full address including postcode for accurate mileage calculation
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-gray-300">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="bg-white/5 border-white/10 text-white h-24"
            />
          </div>

          {autoFillSuggestion && !booking && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm text-green-400">
              <Sparkles className="w-4 h-4 inline mr-2" />
              Smart suggestions applied based on {allBookings.filter(b => b.venue_name.toLowerCase() === formData.venue_name.toLowerCase()).length} previous bookings at this venue
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            disabled={isSubmitting}
            className="border-white/10 min-h-[44px]"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-gradient-to-r from-orange-500 to-orange-600 min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {booking ? 'Update' : 'Create'} Booking
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
