
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Check, X, Zap, Calendar, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function UnifiedQuickInput({ onClose }) {
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Fetch learning data
  const { data: allBookings = [] } = useQuery({
    queryKey: ['all-bookings-unified'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const { data: allUnavailability = [] } = useQuery({
    queryKey: ['unavailability-unified'],
    queryFn: () => base44.entities.Unavailability.list('-start_date'),
    initialData: [],
  });

  const handleProcess = async () => {
    if (!inputText.trim()) return;

    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Build learning patterns for bookings
      const venuePatterns = allBookings.reduce((acc, booking) => {
        const venue = booking.venue_name?.toLowerCase();
        if (venue) {
          if (!acc[venue]) {
            acc[venue] = {
              original_name: booking.venue_name,
              fees: [],
              times: [],
              addresses: [],
              payment_methods: [],
              event_types: [],
              clients: [],
              total_bookings: 0
            };
          }
          acc[venue].fees.push(booking.fee);
          acc[venue].total_bookings++;
          if (booking.event_time) acc[venue].times.push(booking.event_time);
          if (booking.venue_address) acc[venue].addresses.push(booking.venue_address);
          if (booking.payment_method) acc[venue].payment_methods.push(booking.payment_method);
          if (booking.event_type) acc[venue].event_types.push(booking.event_type);
          if (booking.client_name && booking.client_name !== booking.venue_name) {
            acc[venue].clients.push(booking.client_name);
          }
        }
        return acc;
      }, {});

      const venueLearning = Object.entries(venuePatterns)
        .sort((a, b) => b[1].total_bookings - a[1].total_bookings)
        .slice(0, 30)
        .map(([venueKey, data]) => ({
          venue_name: data.original_name,
          avg_fee: Math.round(data.fees.reduce((a, b) => a + b, 0) / data.fees.length),
          most_common_time: data.times.length > 0 ? data.times.sort((a, b) => 
            data.times.filter(t => t === b).length - data.times.filter(t => t === a).length
          )[0] : null,
          address: data.addresses.length > 0 ? data.addresses[0] : null,
          most_common_payment: data.payment_methods.length > 0 ? data.payment_methods.sort((a, b) => 
            data.payment_methods.filter(p => p === b).length - data.payment_methods.filter(p => p === a).length
          )[0] : 'cash',
          total_bookings: data.total_bookings
        }));

      const memberPatterns = allUnavailability.reduce((acc, record) => {
        const member = record.member_name?.toLowerCase();
        if (member) {
          if (!acc[member]) {
            acc[member] = {
              original_name: record.member_name,
              emails: [],
              total_records: 0
            };
          }
          acc[member].total_records++;
          if (record.member_email) acc[member].emails.push(record.member_email);
        }
        return acc;
      }, {});

      const memberLearning = Object.entries(memberPatterns)
        .sort((a, b) => b[1].total_records - a[1].total_records)
        .slice(0, 20)
        .map(([memberKey, data]) => ({
          member_name: data.original_name,
          email: data.emails.length > 0 ? data.emails[0] : null,
          total_records: data.total_records
        }));

      const currentYear = new Date().getFullYear();

      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this input and determine if it's a BOOKING or MEMBER AVAILABILITY entry: "${inputText}"

LEARNED VENUE PATTERNS (${allBookings.length} bookings):
${JSON.stringify(venueLearning, null, 2)}

LEARNED MEMBER PATTERNS (${allUnavailability.length} records):
${JSON.stringify(memberLearning, null, 2)}

DETECTION RULES:
- If mentions band member names (from member patterns) + dates = AVAILABILITY
- If mentions venues/gigs/events (from venue patterns) + dates = BOOKING
- Keywords for availability: "away", "unavailable", "holiday", "off", member names
- Keywords for booking: venue names, "gig", "booking", fees (£ or numbers like 300)

Current date: ${new Date().toISOString().split('T')[0]}
Current year: ${currentYear}

PARSING INSTRUCTIONS:
For BOOKING:
- Match venue names (use learned patterns)
- Extract date (flexible: "12th aug", "12/8", "friday")
- Extract fee (or use learned average)
- Extract client name (or use venue name)
- Use learned time/payment/address if available
- Check for duplicates

For AVAILABILITY:
- Match member name (use learned patterns)
- Extract date range
- Use learned email if available
- Check for overlaps

Return JSON:
{
  "type": "booking" or "availability",
  "confidence": "high/medium/low",
  "data": {
    // For booking:
    "venue_name": "...",
    "client_name": "...",
    "event_date": "YYYY-MM-DD",
    "event_time": "HH:MM",
    "fee": number,
    "venue_address": "...",
    "event_type": "pub_gig/wedding/etc",
    "payment_method": "cash/invoice",
    "notes": "original input"
    
    // OR for availability:
    "member_name": "...",
    "member_email": "...",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD"
  },
  "assumptions_made": ["list"],
  "potential_issue": "duplicate/overlap" or null
}`,
        response_json_schema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["booking", "availability"] },
            confidence: { type: "string" },
            data: { type: "object" },
            assumptions_made: { type: "array", items: { type: "string" } },
            potential_issue: { type: "string" }
          }
        }
      });

      // Check for duplicates/overlaps
      if (aiResult.type === "booking" && aiResult.data.venue_name && aiResult.data.event_date) {
        const duplicate = allBookings.find(b => 
          b.venue_name.toLowerCase() === aiResult.data.venue_name.toLowerCase() &&
          b.event_date === aiResult.data.event_date
        );
        if (duplicate) {
          aiResult.potential_issue = "duplicate";
          aiResult.duplicate_details = duplicate;
        }
      } else if (aiResult.type === "availability" && aiResult.data.member_name && aiResult.data.start_date && aiResult.data.end_date) {
        const overlaps = allUnavailability.filter(record => {
          if (record.member_name?.toLowerCase() !== aiResult.data.member_name.toLowerCase()) return false;
          const existingStart = new Date(record.start_date);
          const existingEnd = new Date(record.end_date);
          const newStart = new Date(aiResult.data.start_date);
          const newEnd = new Date(aiResult.data.end_date);
          return (
            (newStart >= existingStart && newStart <= existingEnd) ||
            (newEnd >= existingStart && newEnd <= existingEnd) ||
            (newStart <= existingStart && newEnd >= existingEnd)
          );
        });
        if (overlaps.length > 0) {
          aiResult.potential_issue = "overlap";
          aiResult.overlap_details = overlaps;
        }
      }

      setResult(aiResult);
    } catch (err) {
      console.error("Error processing input:", err);
      setError("Failed to process input. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const createBookingMutation = useMutation({
    mutationFn: (bookingData) => base44.entities.Booking.create(bookingData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['all-bookings-unified'] });
      setInputText("");
      setResult(null);
      onClose();
    },
  });

  const createAvailabilityMutation = useMutation({
    mutationFn: (data) => base44.entities.Unavailability.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unavailability'] });
      queryClient.invalidateQueries({ queryKey: ['unavailability-unified'] });
      setInputText("");
      setResult(null);
      onClose();
    },
  });

  const handleConfirm = () => {
    if (result.potential_issue === "duplicate" && result.duplicate_details) {
      if (!window.confirm(`A booking already exists for ${result.data.venue_name} on ${result.data.event_date}. Create anyway?`)) {
        return;
      }
    } else if (result.potential_issue === "overlap" && result.overlap_details) {
      const overlap = result.overlap_details[0];
      if (!window.confirm(`${result.data.member_name} already has unavailability from ${overlap.start_date} to ${overlap.end_date}. Create anyway?`)) {
        return;
      }
    }

    if (result.type === "booking") {
      const bookingData = {
        venue_name: result.data.venue_name,
        client_name: result.data.client_name || result.data.venue_name,
        event_date: result.data.event_date,
        event_time: result.data.event_time || '21:00',
        venue_address: result.data.venue_address || '',
        event_type: result.data.event_type || 'pub_gig',
        fee: parseFloat(result.data.fee) || 300,
        deposit_paid: 0,
        balance_due: parseFloat(result.data.fee) || 300,
        payment_method: result.data.payment_method || 'cash',
        payment_status: 'unpaid',
        status: 'confirmed',
        notes: result.data.notes || '',
        client_email: '',
        client_phone: ''
      };
      createBookingMutation.mutate(bookingData);
    } else {
      const availabilityData = {
        member_name: result.data.member_name,
        member_email: result.data.member_email || '',
        start_date: result.data.start_date,
        end_date: result.data.end_date
      };
      createAvailabilityMutation.mutate(availabilityData);
    }
  };

  const confidenceColors = {
    high: "text-green-400",
    medium: "text-yellow-400",
    low: "text-orange-400"
  };

  const typeIcons = {
    booking: Calendar,
    availability: Users
  };

  const typeColors = {
    booking: "from-purple-500 to-blue-500",
    availability: "from-orange-500 to-purple-500"
  };

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-orange-500/10 backdrop-blur-sm border-purple-500/30 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-400" />
          <span className="text-base sm:text-lg">Quick Add - Bookings & Availability</span>
          <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto min-h-[44px] min-w-[44px]">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Type naturally: <span className="text-purple-400 font-medium">"Murrays 12th aug 360 jenny"</span> or{" "}
          <span className="text-orange-400 font-medium">"neil away 6april-9th"</span>
        </p>
        {(allBookings.length > 0 || allUnavailability.length > 0) && (
          <p className="text-xs text-green-400 mt-1">
            🧠 AI learned from {allBookings.length} bookings & {allUnavailability.length} availability records
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        {!result && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleProcess()}
                placeholder="Foundry 15th Dec 550 | dave 12-20 aug"
                className="bg-white/5 border-purple-500/30 text-white text-base sm:text-lg h-12 sm:h-auto flex-1"
                disabled={processing}
              />
              <Button
                onClick={handleProcess}
                disabled={processing || !inputText.trim()}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-6 min-h-[48px] w-full sm:w-auto text-base"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    AI Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Process
                  </>
                )}
              </Button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 active:bg-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-purple-300 font-semibold">Booking Examples:</p>
                </div>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• "Murrays 12th aug 360 jenny jones"</li>
                  <li>• "Foundry friday 550"</li>
                  <li>• "Ludo 25/12"</li>
                </ul>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 active:bg-orange-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-orange-400" />
                  <p className="text-xs text-orange-300 font-semibold">Availability Examples:</p>
                </div>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• "neil 6april-9th"</li>
                  <li>• "dave away 12-20 aug"</li>
                  <li>• "sarah next week"</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Result Preview */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Issue Warning */}
              {result.potential_issue && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-yellow-400 mb-2">
                        ⚠️ {result.potential_issue === "duplicate" ? "Possible Duplicate" : "Overlapping Dates"}
                      </h4>
                      {result.potential_issue === "duplicate" && result.duplicate_details && (
                        <p className="text-sm text-gray-300">
                          Booking exists for <strong>{result.duplicate_details.venue_name}</strong> on{" "}
                          <strong>{result.duplicate_details.event_date}</strong>
                        </p>
                      )}
                      {result.potential_issue === "overlap" && result.overlap_details && (
                        <p className="text-sm text-gray-300">
                          <strong>{result.data.member_name}</strong> already unavailable during these dates
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted Data */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {React.createElement(typeIcons[result.type], { className: `w-5 h-5 ${result.type === 'booking' ? 'text-purple-400' : 'text-orange-400'}` })}
                    <span className="text-white font-medium">
                      {result.type === 'booking' ? 'Booking Detected' : 'Availability Detected'}
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${confidenceColors[result.confidence]}`}>
                    {result.confidence} confidence
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mb-4">
                  {Object.entries(result.data).map(([key, value]) => {
                    if (!value || key === 'notes') return null;
                    return (
                      <div key={key}>
                        <div className="text-xs text-gray-400 mb-1 capitalize">
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div className="text-white font-medium">{value.toString()}</div>
                      </div>
                    );
                  })}
                </div>

                {result.assumptions_made && result.assumptions_made.length > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <div className="text-xs text-blue-400 font-medium mb-2">AI Assumptions:</div>
                    <ul className="text-xs text-gray-400 space-y-1">
                      {result.assumptions_made.map((assumption, idx) => (
                        <li key={idx}>• {assumption}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setInputText("");
                  }}
                  className="flex-1 border-white/10 min-h-[48px] text-base"
                >
                  Start Over
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={createBookingMutation.isPending || createAvailabilityMutation.isPending}
                  className={`flex-1 bg-gradient-to-r ${typeColors[result.type]} min-h-[48px] text-base`}
                >
                  {(createBookingMutation.isPending || createAvailabilityMutation.isPending) ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Confirm & Create
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
