import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Check, X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function QuickBookingInput({ onClose }) {
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [extractedBooking, setExtractedBooking] = useState(null);
  const [error, setError] = useState(null);

  // Fetch all bookings for learning context
  const { data: allBookings = [] } = useQuery({
    queryKey: ['all-bookings-for-quick-input'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const handleProcess = async () => {
    if (!inputText.trim()) return;

    setProcessing(true);
    setError(null);
    setExtractedBooking(null);

    try {
      // Build comprehensive learning context
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

      // Create learning patterns sorted by frequency
      const learningPatterns = Object.entries(venuePatterns)
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
          most_common_event_type: data.event_types.length > 0 ? data.event_types.sort((a, b) => 
            data.event_types.filter(e => e === b).length - data.event_types.filter(e => e === a).length
          )[0] : 'pub_gig',
          common_clients: data.clients.slice(0, 3),
          total_bookings: data.total_bookings
        }));

      // Get current year for smart date parsing
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Parse this quick booking text and extract booking details: "${inputText}"

HISTORICAL VENUE PATTERNS (${allBookings.length} total bookings learned):
${JSON.stringify(learningPatterns, null, 2)}

PARSING RULES:
1. Venue Name Recognition:
   - Match venue names from historical data (case-insensitive, partial matches OK)
   - Common nicknames: "Murrays" = "Murray's Bar", "Foundry" = "The Foundry Social", "Ludo" = "Ludo Bar"
   - If venue found in history, use exact historical name

2. Date Parsing:
   - Current date: ${new Date().toISOString().split('T')[0]}
   - Current year: ${currentYear}
   - "12th aug" or "aug 12" = August 12, ${currentYear}
   - "12/8" = August 12, ${currentYear}
   - If month has passed this year, assume next year
   - "next friday" = calculate next Friday's date
   - "friday" alone = next Friday

3. Fee Recognition:
   - "360" or "£360" = £360 fee
   - If no fee mentioned and venue is in history, use learned average fee
   - Default: £300 if unknown venue

4. Client Name:
   - Look for person names (e.g., "jenny jones", "john smith")
   - If client name found in venue's history, confirm it's correct
   - If no client name mentioned, use venue name as client name

5. Time Defaults (use learned patterns for known venues):
   - Friday/Saturday: 21:00
   - Sunday: 17:00  
   - Other days: 20:30
   - Override with learned venue time if available

6. Payment Method (use learned patterns):
   - Known invoice venues: "The Foundry Social", "Ludo Bar" = invoice
   - Most venues: cash
   - Use learned payment method if available

7. Check for Duplicates:
   - Check if booking already exists for this venue and date
   - Flag as potential duplicate if found

EXAMPLES:
- "Murrays 12th aug 360 jenny jones" → Murray's Bar, Aug 12 ${currentYear}, £360, client: Jenny Jones
- "foundry 25/12 550" → The Foundry Social, Dec 25 ${currentYear}, £550, invoice
- "ludo friday 500" → Ludo Bar, [next Friday's date], £500, invoice

Return JSON with:
{
  "venue_name": "exact venue name (use historical if recognized)",
  "client_name": "client name or venue name",
  "event_date": "YYYY-MM-DD",
  "event_time": "HH:MM in 24hr format",
  "fee": number,
  "venue_address": "from history if available",
  "event_type": "pub_gig/wedding/corporate/etc",
  "payment_method": "cash or invoice",
  "payment_status": "unpaid",
  "status": "confirmed",
  "notes": "original input: [input text]",
  "confidence": "high/medium/low",
  "assumptions_made": ["list of assumptions"],
  "potential_duplicate": boolean
}`,
        response_json_schema: {
          type: "object",
          properties: {
            venue_name: { type: "string" },
            client_name: { type: "string" },
            event_date: { type: "string" },
            event_time: { type: "string" },
            fee: { type: "number" },
            venue_address: { type: "string" },
            event_type: { type: "string" },
            payment_method: { type: "string" },
            payment_status: { type: "string" },
            status: { type: "string" },
            notes: { type: "string" },
            confidence: { type: "string" },
            assumptions_made: { type: "array", items: { type: "string" } },
            potential_duplicate: { type: "boolean" }
          }
        }
      });

      // Check for actual duplicates in database
      const duplicate = allBookings.find(b => 
        b.venue_name?.toLowerCase() === result.venue_name?.toLowerCase() &&
        b.event_date === result.event_date
      );

      if (duplicate) {
        result.potential_duplicate = true;
        result.duplicate_details = duplicate;
      }

      setExtractedBooking(result);
    } catch (err) {
      console.error("Error processing quick input:", err);
      setError("Failed to process booking. Please try again or use the full booking form.");
    } finally {
      setProcessing(false);
    }
  };

  const createBookingMutation = useMutation({
    mutationFn: (bookingData) => base44.entities.Booking.create(bookingData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['all-bookings-for-quick-input'] });
      queryClient.invalidateQueries({ queryKey: ['all-bookings-for-learning'] });
      setInputText("");
      setExtractedBooking(null);
      onClose();
    },
  });

  const handleConfirm = () => {
    if (extractedBooking.potential_duplicate && extractedBooking.duplicate_details) {
      if (!window.confirm(`A booking already exists for ${extractedBooking.venue_name} on ${extractedBooking.event_date}. Create anyway?`)) {
        return;
      }
    }

    const bookingData = {
      venue_name: extractedBooking.venue_name,
      client_name: extractedBooking.client_name || extractedBooking.venue_name,
      event_date: extractedBooking.event_date,
      event_time: extractedBooking.event_time,
      venue_address: extractedBooking.venue_address || '',
      event_type: extractedBooking.event_type || 'pub_gig',
      fee: extractedBooking.fee || 300,
      deposit_paid: 0,
      balance_due: extractedBooking.fee || 300,
      payment_method: extractedBooking.payment_method || 'cash',
      payment_status: 'unpaid',
      status: 'confirmed',
      notes: extractedBooking.notes || '',
      client_email: '',
      client_phone: ''
    };

    createBookingMutation.mutate(bookingData);
  };

  const confidenceColors = {
    high: "text-green-400",
    medium: "text-yellow-400",
    low: "text-orange-400"
  };

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm border-purple-500/30 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-400" />
          Quick Booking Entry
          <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Type natural language like: <span className="text-purple-400 font-medium">"Murrays 12th aug 360 jenny jones"</span>
        </p>
        {allBookings.length > 0 && (
          <p className="text-xs text-green-400 mt-1">
            🧠 AI has learned from {allBookings.length} previous bookings
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        {!extractedBooking && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleProcess()}
                placeholder="e.g., Foundry 15th Dec 550, Murrays friday 360 john smith"
                className="bg-white/5 border-purple-500/30 text-white text-lg flex-1"
                disabled={processing}
              />
              <Button
                onClick={handleProcess}
                disabled={processing || !inputText.trim()}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-6"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
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

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-xs text-blue-300 mb-2">
                <strong>Smart Recognition:</strong>
              </p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Venue names (learns from {allBookings.filter((v, i, a) => a.findIndex(t => t.venue_name === v.venue_name) === i).length} known venues)</li>
                <li>• Dates (flexible formats: "12th aug", "12/8", "friday", etc.)</li>
                <li>• Fees (£ symbol optional)</li>
                <li>• Client names (auto-detects or uses venue name)</li>
                <li>• Times & payment methods (learned from patterns)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Extracted Booking Preview */}
        <AnimatePresence>
          {extractedBooking && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Duplicate Warning */}
              {extractedBooking.potential_duplicate && extractedBooking.duplicate_details && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <X className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-400 mb-2">⚠️ Possible Duplicate</h4>
                      <p className="text-sm text-gray-300 mb-2">
                        Booking exists: <strong>{extractedBooking.duplicate_details.venue_name}</strong> on{' '}
                        <strong>{extractedBooking.duplicate_details.event_date}</strong>
                      </p>
                      <div className="text-xs text-gray-400">
                        Fee: £{extractedBooking.duplicate_details.fee} • Status: {extractedBooking.duplicate_details.status}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Confidence & Assumptions */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-white font-medium">AI Analysis Complete</span>
                  </div>
                  <span className={`text-sm font-medium ${confidenceColors[extractedBooking.confidence]}`}>
                    {extractedBooking.confidence} confidence
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Venue</div>
                    <div className="text-white font-medium">{extractedBooking.venue_name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Client</div>
                    <div className="text-white font-medium">{extractedBooking.client_name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Date & Time</div>
                    <div className="text-white font-medium">
                      {extractedBooking.event_date} at {extractedBooking.event_time}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Fee</div>
                    <div className="text-green-400 font-bold">£{extractedBooking.fee}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Payment Method</div>
                    <div className="text-white font-medium">{extractedBooking.payment_method}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Event Type</div>
                    <div className="text-white font-medium">{extractedBooking.event_type.replace('_', ' ')}</div>
                  </div>
                </div>

                {extractedBooking.venue_address && (
                  <div className="mb-4">
                    <div className="text-xs text-gray-400 mb-1">Address</div>
                    <div className="text-white text-sm">{extractedBooking.venue_address}</div>
                  </div>
                )}

                {extractedBooking.assumptions_made && extractedBooking.assumptions_made.length > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <div className="text-xs text-blue-400 font-medium mb-2">AI Assumptions:</div>
                    <ul className="text-xs text-gray-400 space-y-1">
                      {extractedBooking.assumptions_made.map((assumption, idx) => (
                        <li key={idx}>• {assumption}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setExtractedBooking(null);
                    setInputText("");
                  }}
                  className="flex-1 border-white/10"
                >
                  Start Over
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={createBookingMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600"
                >
                  {createBookingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
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