
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Sparkles, Loader2, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge"; // Added import for Badge
import { format } from 'date-fns'; // Added import for date-fns format

export default function AIBookingUploader({ onClose }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedBookings, setExtractedBookings] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Fetch all bookings to learn from and for duplicate detection
  const { data: allBookings = [] } = useQuery({
    queryKey: ['all-bookings-for-learning'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setSelectedFiles(files);
    setUploading(true);
    setAnalyzing(false);
    setExtractedBookings([]);
    setProgress({ current: 0, total: files.length });

    try {
      const allExtractedBookings = [];

      // Build learning context from historical bookings
      const venuePatterns = allBookings.reduce((acc, booking) => {
        const venue = booking.venue_name;
        if (venue) {
          if (!acc[venue]) {
            acc[venue] = {
              fees: [],
              times: [],
              addresses: [],
              payment_methods: [],
              event_types: [],
              clients: []
            };
          }
          acc[venue].fees.push(booking.fee);
          if (booking.event_time) acc[venue].times.push(booking.event_time);
          if (booking.venue_address) acc[venue].addresses.push(booking.venue_address);
          if (booking.payment_method) acc[venue].payment_methods.push(booking.payment_method);
          if (booking.event_type) acc[venue].event_types.push(booking.event_type);
          if (booking.client_name) acc[venue].clients.push(booking.client_name);
        }
        return acc;
      }, {});

      const learningContext = Object.entries(venuePatterns).map(([venue, data]) => ({
        venue,
        avg_fee: Math.round(data.fees.reduce((a, b) => a + b, 0) / data.fees.length),
        most_common_time: data.times.length > 0 ? data.times[0] : null,
        address: data.addresses.length > 0 ? data.addresses[0] : null,
        most_common_payment: data.payment_methods.length > 0 ? data.payment_methods[0] : 'cash',
        most_common_event_type: data.event_types.length > 0 ? data.event_types[0] : 'pub_gig',
        total_bookings: data.fees.length
      })).slice(0, 20); // Top 20 venues

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ current: i + 1, total: files.length });

        // Upload the screenshot
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        // Analyze with AI
        setUploading(false);
        setAnalyzing(true);

        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Analyze this screenshot of a booking/gig information. Extract the single booking details.

HISTORICAL BOOKING PATTERNS (learn from these):
${JSON.stringify(learningContext, null, 2)}

IMPORTANT CONTEXT:
- Adam Thomas is NOT a client - he's the band's booking manager. Look for the actual venue or client name.
- Fee notation: "300" or "£300" means £300 fee
- Time notation: "8.30" or "8:30" means 20:30 (8:30 PM in 24-hour format)
- If no specific time is visible, use these defaults based on day of week:
  * Friday/Saturday: 21:00
  * Sunday: 17:00
  * Other days: 20:30
- Most gigs are CASH payment, not invoice
- There is only ONE booking per screenshot
- Use the historical patterns above to help predict fees, times, addresses, and payment methods for known venues

Extract:
- venue_name: The actual venue/location name (NOT "Adam Thomas")
- client_name: The client contact name, or use venue_name if no separate client is visible
- event_date: Date in YYYY-MM-DD format
- event_time: Time in HH:MM 24-hour format (convert times like "8.30" to "20:30")
- fee_amount: Extract numeric fee if visible (e.g., "300" means 300)
- notes: Any additional details, special notes, or context visible

Return a single booking object with these fields.`,
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
              venue_name: { type: "string" },
              client_name: { type: "string" },
              event_date: { type: "string" },
              event_time: { type: "string" },
              fee_amount: { type: "number" },
              notes: { type: "string" }
            }
          }
        });

        // Add booking from this file (only one per screenshot)
        if (result.venue_name && result.event_date) {
          allExtractedBookings.push(result);
        }
      }

      // Remove duplicates within extracted bookings (from different screenshots)
      const uniqueExtracted = [];
      const seenInExtracted = new Set();
      
      for (const booking of allExtractedBookings) {
        const key = `${booking.venue_name?.toLowerCase()}-${booking.event_date}`;
        if (!seenInExtracted.has(key)) {
          seenInExtracted.add(key);
          uniqueExtracted.push(booking);
        }
      }

      // Smart venue-based defaults with learning
      const getVenueDefaults = (venueName) => {
        const venueLower = venueName.toLowerCase();
        
        // First check hardcoded known venues
        if (venueLower.includes('foundry') || venueLower.includes('the foundry social')) {
          return { fee: 550, venue_address: 'The Foundry Social', payment_method: 'invoice' };
        }
        if (venueLower.includes('ludo') || venueLower.includes('ludo bar')) {
          return { fee: 500, venue_address: 'Ludo Bar', payment_method: 'invoice' };
        }
        if (venueLower.includes('gin') && venueLower.includes('juice')) {
          return { fee: 360, venue_address: 'Oyster Wharf, 3 Mumbles Rd, Mumbles, Swansea SA3 4DN', payment_method: 'invoice' };
        }
        
        // Then check learned patterns from historical bookings
        const learnedVenue = venuePatterns[venueName];
        if (learnedVenue && learnedVenue.fees.length > 0) {
          return {
            fee: Math.round(learnedVenue.fees.reduce((a, b) => a + b, 0) / learnedVenue.fees.length),
            venue_address: learnedVenue.addresses[0] || '',
            payment_method: learnedVenue.payment_methods[0] || 'cash'
          };
        }
        
        // Default fallback
        return { fee: 300, venue_address: '', payment_method: 'cash' };
      };

      // Smart time defaults based on day of week and learned patterns
      const getDefaultTime = (dateStr, extractedTime, venueName) => {
        if (extractedTime) return extractedTime;
        
        // Check learned patterns for this venue
        const learnedVenue = venuePatterns[venueName];
        if (learnedVenue && learnedVenue.times.length > 0) {
          return learnedVenue.times[0];
        }
        
        // Fall back to day-based defaults
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay();
        
        if (dayOfWeek === 0) return '17:00'; // Sunday
        if (dayOfWeek === 5 || dayOfWeek === 6) return '21:00'; // Friday/Saturday
        return '20:30'; // Other days
      };

      // Set default values for all extracted bookings with smart detection
      const bookingsWithDefaults = uniqueExtracted.map(booking => {
        const venueDefaults = getVenueDefaults(booking.venue_name || '');
        const finalFee = booking.fee_amount || venueDefaults.fee;
        const finalTime = getDefaultTime(booking.event_date, booking.event_time, booking.venue_name);
        
        // Check if this booking already exists in database
        const existingBooking = allBookings.find(b => 
          b.venue_name?.toLowerCase() === (booking.venue_name?.toLowerCase() || '') &&
          b.event_date === booking.event_date
        );
        
        return {
          venue_name: booking.venue_name,
          client_name: booking.client_name || booking.venue_name,
          event_date: booking.event_date,
          event_time: finalTime,
          client_email: '',
          client_phone: '',
          venue_address: venueDefaults.venue_address,
          event_type: 'pub_gig',
          fee: finalFee,
          deposit_paid: 0,
          balance_due: finalFee,
          payment_method: venueDefaults.payment_method,
          payment_status: 'unpaid',
          status: 'confirmed',
          notes: booking.notes || '',
          isDuplicate: !!existingBooking, // Mark if potential duplicate
          existingBooking: existingBooking, // Store existing booking data if found
          skipDuplicate: false // Default to not skipping
        };
      });

      setExtractedBookings(bookingsWithDefaults);
      setAnalyzing(false);
    } catch (error) {
      console.error("Error analyzing screenshots:", error);
      alert('Error analyzing screenshots. Please try again.');
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const updateBooking = (index, field, value) => {
    const updated = [...extractedBookings];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate balance_due
    if (field === 'fee' || field === 'deposit_paid') {
      updated[index].balance_due = (parseFloat(updated[index].fee) || 0) - (parseFloat(updated[index].deposit_paid) || 0);
    }
    
    setExtractedBookings(updated);
  };

  const removeBooking = (index) => {
    setExtractedBookings(extractedBookings.filter((_, i) => i !== index));
  };

  const createBookingsMutation = useMutation({
    mutationFn: async () => {
      // Filter out bookings marked as duplicates that user wants to skip
      const bookingsToCreate = extractedBookings.filter(b => !b.skipDuplicate);
      
      await base44.entities.Booking.bulkCreate(bookingsToCreate.map(b => ({
        venue_name: b.venue_name,
        client_name: b.client_name,
        event_date: b.event_date,
        event_time: b.event_time,
        client_email: b.client_email,
        client_phone: b.client_phone,
        venue_address: b.venue_address,
        event_type: b.event_type,
        fee: parseFloat(b.fee) || 0,
        deposit_paid: parseFloat(b.deposit_paid) || 0,
        balance_due: parseFloat(b.balance_due) || 0,
        payment_method: b.payment_method,
        payment_status: b.payment_status,
        status: b.status,
        notes: b.notes
      })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      // Invalidate the learning data cache as well to include newly created bookings
      queryClient.invalidateQueries({ queryKey: ['all-bookings-for-learning'] });
      const created = extractedBookings.filter(b => !b.skipDuplicate).length;
      alert(`Successfully created ${created} booking${created !== 1 ? 's' : ''}!`);
      onClose();
    },
  });

  const handleConfirm = () => {
    const duplicatesToCreate = extractedBookings.filter(b => b.isDuplicate && !b.skipDuplicate);
    
    if (duplicatesToCreate.length > 0) {
      const message = `${duplicatesToCreate.length} possible duplicate${duplicatesToCreate.length !== 1 ? 's' : ''} detected that are not marked to skip. Do you want to create them anyway?`;
      if (!window.confirm(message)) {
        return;
      }
    }
    
    createBookingsMutation.mutate();
  };

  const markAsSkip = (index) => {
    const updated = [...extractedBookings];
    updated[index] = { ...updated[index], skipDuplicate: !updated[index].skipDuplicate };
    setExtractedBookings(updated);
  };

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm border-purple-500/30 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          AI Booking Screenshot Uploader
          <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Upload multiple screenshots of your calendar or booking schedule, and AI will extract all the bookings for you to review and edit before saving.
        </p>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-3">
          <p className="text-xs text-blue-300">
            ✨ <strong>Smart Defaults:</strong> The Foundry Social (£550), Ludo Bar (£500), Gin & Juice (£360) will be auto-detected and filled in.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {/* Upload Section */}
        {!extractedBookings.length && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-purple-500/30 rounded-lg p-8 text-center">
              <input
                id="screenshot-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading || analyzing}
              />
              <label
                htmlFor="screenshot-upload"
                className="cursor-pointer"
              >
                {uploading ? (
                  <div className="space-y-3">
                    <Loader2 className="w-12 h-12 text-purple-400 mx-auto animate-spin" />
                    <p className="text-gray-300">Uploading screenshots...</p>
                    <p className="text-sm text-gray-500">File {progress.current} of {progress.total}</p>
                  </div>
                ) : analyzing ? (
                  <div className="space-y-3">
                    <Sparkles className="w-12 h-12 text-purple-400 mx-auto animate-pulse" />
                    <p className="text-gray-300">AI is analyzing your bookings...</p>
                    <p className="text-sm text-gray-500">Processing file {progress.current} of {progress.total}</p>
                    <p className="text-xs text-gray-600">Learning from {allBookings.length} historical bookings</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-12 h-12 text-purple-400 mx-auto" />
                    <div>
                      <p className="text-gray-300 font-medium">Click to upload screenshots</p>
                      <p className="text-sm text-gray-500 mt-1">PNG, JPG up to 10MB each</p>
                      <p className="text-xs text-purple-400 mt-2">✨ You can select multiple files at once</p>
                      {allBookings.length > 0 && (
                        <p className="text-xs text-green-400 mt-1">🧠 AI has learned from {allBookings.length} previous bookings</p>
                      )}
                    </div>
                  </div>
                )}
              </label>
            </div>

            {selectedFiles.length > 0 && !analyzing && !extractedBookings.length && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400 font-medium">Selected files:</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 rounded p-2">
                      <Check className="w-3 h-3 text-green-400" />
                      <span className="truncate">{file.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Extracted Bookings Review */}
        <AnimatePresence>
          {extractedBookings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">Found {extractedBookings.length} booking{extractedBookings.length !== 1 ? 's' : ''} from {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}!</span>
                </div>
                {extractedBookings.some(b => b.isDuplicate) && (
                  <p className="text-sm text-yellow-400">
                    ⚠️ {extractedBookings.filter(b => b.isDuplicate).length} possible duplicate{extractedBookings.filter(b => b.isDuplicate).length !== 1 ? 's' : ''} detected. Review details.
                  </p>
                )}
                <p className="text-sm text-gray-400">
                  Review and edit the details below, then click "Create Bookings" to save them.
                </p>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {extractedBookings.map((booking, index) => (
                  <Card 
                    key={index} 
                    className={`border ${
                      booking.skipDuplicate 
                        ? 'bg-white/5 border-white/10 opacity-50' 
                        : booking.isDuplicate 
                        ? 'bg-red-500/10 border-red-500/30' 
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                          Booking #{index + 1}
                          {booking.isDuplicate && !booking.skipDuplicate && (
                            <Badge className="bg-red-500/20 text-red-400">Possible Duplicate</Badge>
                          )}
                          {booking.skipDuplicate && (
                            <Badge className="bg-gray-500/20 text-gray-400">Skipped</Badge>
                          )}
                        </CardTitle>
                        <div className="flex gap-2">
                          {booking.isDuplicate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsSkip(index)}
                              className="text-yellow-400 hover:text-yellow-300 text-xs"
                            >
                              {booking.skipDuplicate ? 'Include' : 'Skip'}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeBooking(index)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {booking.isDuplicate && !booking.skipDuplicate && booking.existingBooking && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded p-2 mt-2">
                          <p className="text-xs text-red-400 font-semibold mb-1">Existing booking found:</p>
                          <p className="text-xs text-gray-400">
                            {booking.existingBooking.venue_name} on {format(new Date(booking.existingBooking.event_date), 'MMM d, yyyy')}
                            {booking.existingBooking.event_time && ` at ${booking.existingBooking.event_time}`}
                          </p>
                          <p className="text-xs text-gray-400">
                            Status: {booking.existingBooking.status} • Fee: £{booking.existingBooking.fee}
                          </p>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Venue Name *</Label>
                          <Input
                            value={booking.venue_name}
                            onChange={(e) => updateBooking(index, 'venue_name', e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm"
                            disabled={booking.skipDuplicate}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Client Name *</Label>
                          <Input
                            value={booking.client_name}
                            onChange={(e) => updateBooking(index, 'client_name', e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm"
                            disabled={booking.skipDuplicate}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Event Date *</Label>
                          <Input
                            type="date"
                            value={booking.event_date}
                            onChange={(e) => updateBooking(index, 'event_date', e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm"
                            disabled={booking.skipDuplicate}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Event Time</Label>
                          <Input
                            type="time"
                            value={booking.event_time}
                            onChange={(e) => updateBooking(index, 'event_time', e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm"
                            disabled={booking.skipDuplicate}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Event Type</Label>
                          <Select
                            value={booking.event_type}
                            onValueChange={(value) => updateBooking(index, 'event_type', value)}
                            disabled={booking.skipDuplicate}
                          >
                            <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pub_gig">Pub Gig</SelectItem>
                              <SelectItem value="wedding">Wedding</SelectItem>
                              <SelectItem value="corporate">Corporate</SelectItem>
                              <SelectItem value="festival">Festival</SelectItem>
                              <SelectItem value="private_party">Private Party</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Fee (£)</Label>
                          <Input
                            type="number"
                            value={booking.fee}
                            onChange={(e) => updateBooking(index, 'fee', e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm"
                            disabled={booking.skipDuplicate}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Payment Method</Label>
                          <Select
                            value={booking.payment_method}
                            onValueChange={(value) => updateBooking(index, 'payment_method', value)}
                            disabled={booking.skipDuplicate}
                          >
                            <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="invoice">Invoice</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Payment Status</Label>
                          <Select
                            value={booking.payment_status}
                            onValueChange={(value) => updateBooking(index, 'payment_status', value)}
                            disabled={booking.skipDuplicate}
                          >
                            <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unpaid">Unpaid</SelectItem>
                              <SelectItem value="deposit_paid">Deposit Paid</SelectItem>
                              <SelectItem value="paid_in_full">Paid in Full</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-400">Venue Address</Label>
                        <Input
                          value={booking.venue_address}
                          onChange={(e) => updateBooking(index, 'venue_address', e.target.value)}
                          className="bg-white/5 border-white/10 text-white text-sm"
                          disabled={booking.skipDuplicate}
                        />
                      </div>
                      {booking.notes && (
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Notes</Label>
                          <Textarea
                            value={booking.notes}
                            onChange={(e) => updateBooking(index, 'notes', e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm h-20"
                            disabled={booking.skipDuplicate}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  onClick={() => {
                    setExtractedBookings([]);
                    setSelectedFiles([]);
                  }}
                  className="flex-1 border-white/10"
                >
                  Start Over
                </Button>
                <Button
                  onClick={handleConfirm} // Use handleConfirm for validation
                  disabled={createBookingsMutation.isPending || extractedBookings.every(b => b.skipDuplicate)}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
                >
                  {createBookingsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Create {extractedBookings.filter(b => !b.skipDuplicate).length} Booking{extractedBookings.filter(b => !b.skipDuplicate).length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
