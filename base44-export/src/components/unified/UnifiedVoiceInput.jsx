import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX, Loader2, Check, X, RefreshCw, Sparkles, Calendar, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function UnifiedVoiceInput({ onClose }) {
  const queryClient = useQueryClient();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState(null);
  const [conversation, setConversation] = useState([]);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Fetch learning data
  const { data: allBookings = [] } = useQuery({
    queryKey: ['all-bookings-voice'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const { data: allUnavailability = [] } = useQuery({
    queryKey: ['unavailability-voice'],
    queryFn: () => base44.entities.Unavailability.list('-start_date'),
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
      speak("I'm listening. Tell me about a booking or member availability.");
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
    }
  };

  const processVoiceInput = async (text) => {
    setAnalyzing(true);
    setConversation(prev => [...prev, { role: 'user', text }]);

    try {
      // Build learning contexts (same as UnifiedQuickInput)
      const venuePatterns = allBookings.reduce((acc, booking) => {
        const venue = booking.venue_name?.toLowerCase();
        if (venue) {
          if (!acc[venue]) {
            acc[venue] = { original_name: booking.venue_name, fees: [], times: [], addresses: [], payment_methods: [], event_types: [], clients: [], total_bookings: 0 };
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
        }));

      const memberPatterns = allUnavailability.reduce((acc, record) => {
        const member = record.member_name?.toLowerCase();
        if (member) {
          if (!acc[member]) {
            acc[member] = { original_name: record.member_name, emails: [], total_records: 0 };
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
        }));

      const currentYear = new Date().getFullYear();

      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this voice input: "${text}"

LEARNED PATTERNS:
Venues (${allBookings.length} bookings): ${JSON.stringify(venueLearning, null, 2)}
Members (${allUnavailability.length} records): ${JSON.stringify(memberLearning, null, 2)}

Previous conversation: ${JSON.stringify(conversation)}

Determine if this is a BOOKING or MEMBER AVAILABILITY entry, then extract all details.

For BOOKING: venue_name, client_name, event_date, event_time, fee, venue_address, event_type, payment_method
For AVAILABILITY: member_name, member_email, start_date, end_date

Use learned patterns to fill in missing details intelligently.
Current year: ${currentYear}

Return:
{
  "type": "booking" or "availability",
  "data": {...extracted fields...},
  "missing_fields": [...],
  "response_message": "friendly confirmation or request for missing info",
  "is_complete": boolean
}`,
        response_json_schema: {
          type: "object",
          properties: {
            type: { type: "string" },
            data: { type: "object" },
            missing_fields: { type: "array", items: { type: "string" } },
            response_message: { type: "string" },
            is_complete: { type: "boolean" }
          }
        }
      });

      setConversation(prev => [...prev, { role: 'assistant', text: aiResult.response_message }]);
      
      // Update result
      const currentResult = result || { type: aiResult.type, data: {} };
      currentResult.data = { ...currentResult.data, ...aiResult.data };
      
      // Auto-fill client_name with venue_name if booking
      if (currentResult.type === "booking" && currentResult.data.venue_name && !currentResult.data.client_name) {
        currentResult.data.client_name = currentResult.data.venue_name;
      }

      setResult({ ...currentResult, missing_fields: aiResult.missing_fields, is_complete: aiResult.is_complete });

      // Speak response
      await speak(aiResult.response_message);

      // If not complete, prompt for more info
      if (!aiResult.is_complete && aiResult.missing_fields.length > 0) {
        setAnalyzing(false);
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

  const createBookingMutation = useMutation({
    mutationFn: (bookingData) => base44.entities.Booking.create(bookingData),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['all-bookings-voice'] });
      await speak("Booking created successfully!");
      setTimeout(() => onClose(), 2000);
    },
  });

  const createAvailabilityMutation = useMutation({
    mutationFn: (data) => base44.entities.Unavailability.create(data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['unavailability'] });
      queryClient.invalidateQueries({ queryKey: ['unavailability-voice'] });
      await speak("Availability record created successfully!");
      setTimeout(() => onClose(), 2000);
    },
  });

  const handleConfirm = async () => {
    await speak("Creating now...");
    
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

  const handleRetry = () => {
    setResult(null);
    setConversation([]);
    setTranscript("");
    startListening();
  };

  const typeIcons = {
    booking: Calendar,
    availability: Users
  };

  return (
    <Card className="bg-gradient-to-br from-green-500/10 to-blue-500/10 backdrop-blur-sm border-green-500/30 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Mic className="w-5 h-5 mr-2 text-green-400" />
          Voice Input - Bookings & Availability
          <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Speak naturally to add bookings or member availability. I'll extract the details and ask for anything missing.
        </p>
        {(allBookings.length > 0 || allUnavailability.length > 0) && (
          <p className="text-xs text-green-400 mt-1">
            🧠 AI learned from {allBookings.length} bookings & {allUnavailability.length} availability records
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voice Controls */}
        <div className="flex gap-3 justify-center">
          {!isListening && !result && (
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

        {/* Result Preview */}
        <AnimatePresence>
          {result && !analyzing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  {React.createElement(typeIcons[result.type], { className: `w-5 h-5 ${result.type === 'booking' ? 'text-purple-400' : 'text-orange-400'}` })}
                  <span className="font-semibold text-white">
                    {result.type === 'booking' ? 'Booking Details' : 'Availability Details'}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  {Object.entries(result.data).filter(([k, v]) => v).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs text-gray-400 mb-1 capitalize">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-white font-medium">{value.toString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {result.missing_fields && result.missing_fields.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-sm text-yellow-400">
                    Missing: {result.missing_fields.join(', ')}
                  </p>
                </div>
              )}

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
                  disabled={!result.is_complete || createBookingMutation.isPending || createAvailabilityMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600"
                >
                  {(createBookingMutation.isPending || createAvailabilityMutation.isPending) ? (
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
        {!isListening && !result && !analyzing && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
              <p className="text-xs text-purple-300 font-semibold mb-2">Booking Example:</p>
              <p className="text-xs text-gray-400">
                "We have a gig at Foundry Social on December 25th at 8:30 PM for £550"
              </p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
              <p className="text-xs text-orange-300 font-semibold mb-2">Availability Example:</p>
              <p className="text-xs text-gray-400">
                "Neil is away from April 6th to 9th"
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}