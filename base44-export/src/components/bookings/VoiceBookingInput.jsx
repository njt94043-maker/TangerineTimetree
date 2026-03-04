
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, Volume2, VolumeX, Loader2, Check, X, RefreshCw, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from 'date-fns'; // Import date-fns for date formatting

export default function VoiceBookingInput({ onClose }) {
  const queryClient = useQueryClient();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [extractedBooking, setExtractedBooking] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [conversation, setConversation] = useState([]);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Fetch all bookings for learning context (and displaying count)
  const { data: allBookingsForLearningDisplay = [] } = useQuery({
    queryKey: ['all-bookings-for-voice-learning'],
    queryFn: () => base44.entities.Booking.list('-event_date'), // Sorted by event_date descending
    initialData: [],
  });

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setTranscript(transcriptText);
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current.start();
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      synthRef.current.cancel();
    };
  }, [isListening]);

  const speak = (text) => {
    return new Promise((resolve) => {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
        resolve();
      };
      
      synthRef.current.speak(utterance);
    });
  };

  const stopSpeaking = () => {
    synthRef.current.cancel();
    setSpeaking(false);
  };

  const startListening = () => {
    if (recognitionRef.current) {
      setTranscript("");
      setIsListening(true);
      recognitionRef.current.start();
      speak("I'm listening. Please tell me about the booking.");
    } else {
      alert("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
    }
  };

  const stopListening = async () => {
    if (recognitionRef.current) {
      setIsListening(false);
      recognitionRef.current.stop();
      
      if (transcript.trim()) {
        await processVoiceInput(transcript);
      }
    };
  };

  const processVoiceInput = async (text) => {
    setAnalyzing(true);
    setConversation(prev => [...prev, { role: 'user', text }]);

    try {
      // Fetch all bookings for duplicate checking and learning context
      const allBookings = await base44.entities.Booking.list('-event_date');

      // Build learning context from historical bookings
      const venuePatterns = allBookings.reduce((acc, booking) => {
        const venue = booking.venue_name;
        if (venue) {
          if (!acc[venue]) {
            acc[venue] = { fees: [], times: [], addresses: [], payment_methods: [], clients: [] };
          }
          if (booking.fee) acc[venue].fees.push(booking.fee);
          if (booking.event_time) acc[venue].times.push(booking.event_time);
          if (booking.venue_address) acc[venue].addresses.push(booking.venue_address);
          if (booking.payment_method) acc[venue].payment_methods.push(booking.payment_method);
          if (booking.client_name && booking.client_name !== booking.venue_name) {
            acc[venue].clients.push(booking.client_name);
          }
        }
        return acc;
      }, {});

      const learningContext = Object.entries(venuePatterns).slice(0, 15).map(([venue, data]) => ({
        venue,
        avg_fee: data.fees.length > 0 ? Math.round(data.fees.reduce((a, b) => a + b, 0) / data.fees.length) : undefined,
        common_time: data.times.length > 0 ? data.times[0] : undefined,
        address: data.addresses.length > 0 ? data.addresses[0] : undefined,
        payment_method: data.payment_methods.length > 0 ? data.payment_methods[0] : 'cash',
        client_name: data.clients.length > 0 ? data.clients[0] : undefined
      }));

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a helpful assistant helping a band member add booking information via voice input.

HISTORICAL BOOKING PATTERNS (learned from ${allBookings.length} bookings):
${JSON.stringify(learningContext, null, 2)}

Previous conversation: ${JSON.stringify(conversation)}

User just said: "${text}"

Extract booking information and identify missing required fields:
- venue_name (REQUIRED)
- client_name (if not mentioned, use venue_name OR learned client_name for known venues)
- event_date (REQUIRED - format YYYY-MM-DD)
- event_time (use smart defaults: Fri/Sat=21:00, Sun=17:00, other=20:30, OR use learned time)
- event_type (default: pub_gig)
- fee (extract from text, OR use learned avg_fee, otherwise default 300)
- payment_method (default: cash, OR use learned payment_method)
- venue_address (use learned address if available)
- notes (any other details mentioned)

IMPORTANT CONTEXT:
- "Adam Thomas" is the booking manager, NOT a client
- Fee like "300" means £300
- Time like "8.30" means 20:30
- Most gigs are cash payment
- The Foundry Social = £550 invoice
- Ludo Bar = £500 invoice
- If no client name mentioned, use venue_name as client_name
- Use historical patterns to intelligently fill in missing details

Return:
1. extracted_data: object with all fields (use learned patterns)
2. missing_required: array of missing required field names
3. response_message: friendly message confirming details or asking for missing info
4. is_complete: boolean if all required fields present`,
        response_json_schema: {
          type: "object",
          properties: {
            extracted_data: {
              type: "object",
              properties: {
                venue_name: { type: "string" },
                client_name: { type: "string" },
                event_date: { type: "string" },
                event_time: { type: "string" },
                event_type: { type: "string" },
                fee: { type: "number" },
                payment_method: { type: "string" },
                venue_address: { type: "string" },
                notes: { type: "string" }
              }
            },
            missing_required: { type: "array", items: { type: "string" } },
            response_message: { type: "string" },
            is_complete: { type: "boolean" }
          }
        }
      });

      setConversation(prev => [...prev, { role: 'assistant', text: result.response_message }]);
      
      // Update extracted booking
      const currentBooking = extractedBooking || {};
      let updatedBooking = { ...currentBooking, ...result.extracted_data };
      
      // If no client name, use venue name
      if (updatedBooking.venue_name && !updatedBooking.client_name) {
        updatedBooking.client_name = updatedBooking.venue_name;
      }
      
      // Check for duplicates
      if (updatedBooking.venue_name && updatedBooking.event_date) {
        const duplicate = allBookings.find(b => 
          b.venue_name.toLowerCase() === updatedBooking.venue_name.toLowerCase() &&
          b.event_date === updatedBooking.event_date
        );
        
        if (duplicate) {
          updatedBooking.isDuplicate = true;
          updatedBooking.existingBooking = duplicate;
          const warningMsg = `Warning: A booking already exists for ${duplicate.venue_name} on ${format(new Date(duplicate.event_date), 'MMM d, yyyy')}. Status: ${duplicate.status}, Fee: £${duplicate.fee}. Do you want to create it anyway?`;
          await speak(warningMsg);
          setConversation(prev => [...prev, { role: 'assistant', text: warningMsg }]);
        }
      }
      
      setExtractedBooking(updatedBooking);
      setMissingFields(result.missing_required);

      // Speak the response
      await speak(result.response_message);

      // If not complete, prompt for more info
      if (!result.is_complete && result.missing_required.length > 0) {
        setAnalyzing(false);
        // Auto start listening again for missing info
        setTimeout(() => {
          startListening();
        }, 500);
      } else {
        setAnalyzing(false);
      }

    } catch (error) {
      console.error("Error processing voice input:", error);
      const errorMsg = "Sorry, I had trouble processing that. Please try again.";
      speak(errorMsg);
      setConversation(prev => [...prev, { role: 'assistant', text: errorMsg }]);
      setAnalyzing(false);
    }
  };

  const updateBookingField = (field, value) => {
    setExtractedBooking(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const createBookingMutation = useMutation({
    mutationFn: async () => {
      const bookingData = {
        venue_name: extractedBooking.venue_name,
        client_name: extractedBooking.client_name || extractedBooking.venue_name, // Ensure client_name fallback here too
        event_date: extractedBooking.event_date,
        event_time: extractedBooking.event_time || '21:00',
        event_type: extractedBooking.event_type || 'pub_gig',
        fee: parseFloat(extractedBooking.fee) || 300,
        deposit_paid: 0,
        balance_due: parseFloat(extractedBooking.fee) || 300,
        payment_method: extractedBooking.payment_method || 'cash',
        payment_status: 'unpaid',
        status: 'confirmed',
        venue_address: extractedBooking.venue_address || '',
        notes: extractedBooking.notes || '',
        client_email: '',
        client_phone: ''
      };
      
      await base44.entities.Booking.create(bookingData);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['all-bookings-for-voice-learning'] }); // Invalidate learning cache
      await speak("Booking created successfully!");
      setTimeout(() => {
        onClose();
      }, 2000);
    },
  });

  const handleConfirm = async () => {
    if (extractedBooking.isDuplicate) {
      const confirmed = window.confirm(`A booking already exists for ${extractedBooking.existingBooking.venue_name} on ${format(new Date(extractedBooking.existingBooking.event_date), 'MMM d, yyyy')}. Status: ${extractedBooking.existingBooking.status}, Fee: £${extractedBooking.existingBooking.fee}. Do you want to create it anyway?`);
      if (!confirmed) return;
    }
    
    await speak("Creating booking now...");
    createBookingMutation.mutate();
  };

  const handleRetry = () => {
    setExtractedBooking(null);
    setMissingFields([]);
    setConversation([]);
    setTranscript("");
    startListening();
  };

  return (
    <Card className="bg-gradient-to-br from-green-500/10 to-blue-500/10 backdrop-blur-sm border-green-500/30 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Mic className="w-5 h-5 mr-2 text-green-400" />
          Voice Booking Input
          <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Speak naturally to add a booking. I'll extract the details and ask for anything missing.
        </p>
        {allBookingsForLearningDisplay.length > 0 && (
          <p className="text-xs text-green-400 mt-1">
            🧠 AI has learned from {allBookingsForLearningDisplay.length} previous bookings.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice Controls */}
        <div className="flex gap-3 justify-center">
          {!isListening && !extractedBooking && (
            <Button
              onClick={startListening}
              disabled={analyzing || speaking}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              size="lg"
            >
              <Mic className="w-5 h-5 mr-2" />
              Start Speaking
            </Button>
          )}

          {isListening && (
            <Button
              onClick={stopListening}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 animate-pulse"
              size="lg"
            >
              <MicOff className="w-5 h-5 mr-2" />
              Stop & Process
            </Button>
          )}

          {speaking && (
            <Button
              onClick={stopSpeaking}
              variant="outline"
              className="border-orange-500/50"
              size="lg"
            >
              <VolumeX className="w-5 h-5 mr-2" />
              Stop Speaking
            </Button>
          )}
        </div>

        {/* Live Transcript */}
        {isListening && transcript && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 rounded-lg p-4 border border-green-500/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-green-400 animate-pulse" />
              <span className="text-sm font-medium text-gray-400">You're saying:</span>
            </div>
            <p className="text-white">{transcript}</p>
          </motion.div>
        )}

        {/* Conversation History */}
        {conversation.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-500/10 border border-blue-500/20 ml-8'
                    : 'bg-green-500/10 border border-green-500/20 mr-8'
                }`}
              >
                <div className="text-xs text-gray-400 mb-1">
                  {msg.role === 'user' ? 'You' : 'AI Assistant'}
                </div>
                <p className="text-white text-sm">{msg.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Processing Indicator */}
        {analyzing && (
          <div className="flex items-center justify-center gap-3 py-4">
            <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
            <span className="text-gray-400">Analyzing your input...</span>
          </div>
        )}

        {/* Extracted Booking Preview */}
        <AnimatePresence>
          {extractedBooking && !analyzing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Duplicate Warning */}
              {extractedBooking.isDuplicate && extractedBooking.existingBooking && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <X className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-400 mb-2">⚠️ Possible Duplicate</h4>
                      <p className="text-sm text-gray-300 mb-2">
                        A booking already exists for <strong>{extractedBooking.existingBooking.venue_name}</strong> on{' '}
                        <strong>{format(new Date(extractedBooking.existingBooking.event_date), 'MMM d, yyyy')}</strong>
                      </p>
                      <div className="text-xs text-gray-400">
                        <p>Status: {extractedBooking.existingBooking.status}</p>
                        <p>Fee: £{extractedBooking.existingBooking.fee}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-white">Extracted Booking Details</span>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Venue Name *</Label>
                    <Input
                      value={extractedBooking.venue_name || ''}
                      onChange={(e) => updateBookingField('venue_name', e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm"
                      placeholder="Required"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Client Name</Label>
                    <Input
                      value={extractedBooking.client_name || ''}
                      onChange={(e) => updateBookingField('client_name', e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Event Date *</Label>
                    <Input
                      type="date"
                      value={extractedBooking.event_date || ''}
                      onChange={(e) => updateBookingField('event_date', e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm"
                      placeholder="Required"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Event Time</Label>
                    <Input
                      type="time"
                      value={extractedBooking.event_time || ''}
                      onChange={(e) => updateBookingField('event_time', e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Fee (£)</Label>
                    <Input
                      type="number"
                      value={extractedBooking.fee || ''}
                      onChange={(e) => updateBookingField('fee', e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Payment Method</Label>
                    <Input
                      value={extractedBooking.payment_method || 'cash'}
                      onChange={(e) => updateBookingField('payment_method', e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm"
                    />
                  </div>
                </div>

                {extractedBooking.notes && (
                  <div className="mt-3 space-y-1">
                    <Label className="text-xs text-gray-400">Notes</Label>
                    <Input
                      value={extractedBooking.notes}
                      onChange={(e) => updateBookingField('notes', e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Missing Fields Warning */}
              {missingFields.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-sm text-yellow-400">
                    Missing required: {missingFields.join(', ')}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="flex-1 border-white/10"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Start Over
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={missingFields.length > 0 || createBookingMutation.isPending}
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

        {/* Help Text */}
        {!isListening && !extractedBooking && !analyzing && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-sm text-blue-300 mb-2">
              <strong>Example:</strong> "We have a gig at The Foundry Social on December 25th at 8:30 PM"
            </p>
            <p className="text-xs text-gray-400">
              I'll understand natural language and ask for any missing details!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
