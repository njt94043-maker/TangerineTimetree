
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Check, X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function QuickAvailabilityInput({ onClose }) {
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [extractedAvailability, setExtractedAvailability] = useState(null);
  const [error, setError] = useState(null);

  // Fetch all unavailability records for learning context
  const { data: allUnavailability = [] } = useQuery({
    queryKey: ['unavailability-for-quick-input'],
    queryFn: () => base44.entities.Unavailability.list('-start_date'),
    initialData: [],
  });

  const handleProcess = async () => {
    if (!inputText.trim()) return;

    setProcessing(true);
    setError(null);
    setExtractedAvailability(null);

    try {
      // Build learning context from historical unavailability records
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

      const learningPatterns = Object.entries(memberPatterns)
        .sort((a, b) => b[1].total_records - a[1].total_records)
        .slice(0, 20)
        .map(([memberKey, data]) => ({
          member_name: data.original_name,
          email: data.emails.length > 0 ? data.emails[0] : null,
          total_records: data.total_records
        }));

      const currentYear = new Date().getFullYear();

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Parse this quick unavailability text and extract member unavailability details: "${inputText}"

HISTORICAL MEMBER PATTERNS (${allUnavailability.length} total records learned):
${JSON.stringify(learningPatterns, null, 2)}

PARSING RULES:
1. Member Name Recognition:
   - Match member names from historical data (case-insensitive, partial matches OK)
   - Common variations: "neil" = "Neil", "dave" = "Dave", etc.
   - If member found in history, use exact historical name

2. Date Parsing:
   - Current date: ${new Date().toISOString().split('T')[0]}
   - Current year: ${currentYear}
   - "6april-9th" = April 6 to April 9, ${currentYear}
   - "6/4-9/4" = April 6 to April 9, ${currentYear}
   - "next week" = calculate dates for next week
   - "monday-friday" = calculate next Mon-Fri dates
   - If month has passed this year, assume next year

3. Email Recognition:
   - If member is known, use learned email if available
   - Extract email if mentioned in text

4. Check for Overlaps:
   - Check if member already has unavailability for these dates
   - Flag as potential overlap if found

EXAMPLES:
- "neil 6april-9th" → Neil, Apr 6-9 ${currentYear}
- "dave 12/8-20/8" → Dave, Aug 12-20 ${currentYear}
- "sarah next week" → Sarah, [next week dates]

Return JSON with:
{
  "member_name": "exact member name (use historical if recognized)",
  "member_email": "from history if available",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "notes": "original input: [input text]",
  "confidence": "high/medium/low",
  "assumptions_made": ["list of assumptions"],
  "potential_overlap": boolean
}`,
        response_json_schema: {
          type: "object",
          properties: {
            member_name: { type: "string" },
            member_email: { type: "string" },
            start_date: { type: "string" },
            end_date: { type: "string" },
            notes: { type: "string" },
            confidence: { type: "string" },
            assumptions_made: { type: "array", items: { type: "string" } },
            potential_overlap: { type: "boolean" }
          }
        }
      });

      // Check for actual overlaps in database
      const overlaps = allUnavailability.filter(record => {
        if (record.member_name?.toLowerCase() !== result.member_name?.toLowerCase()) return false;
        
        const existingStart = new Date(record.start_date);
        const existingEnd = new Date(record.end_date);
        const newStart = new Date(result.start_date);
        const newEnd = new Date(result.end_date);
        
        return (
          (newStart >= existingStart && newStart <= existingEnd) ||
          (newEnd >= existingStart && newEnd <= existingEnd) ||
          (newStart <= existingStart && newEnd >= existingEnd)
        );
      });

      if (overlaps.length > 0) {
        result.potential_overlap = true;
        result.overlap_details = overlaps;
      }

      setExtractedAvailability(result);
    } catch (err) {
      console.error("Error processing quick input:", err);
      setError("Failed to process unavailability. Please try again or use the full form.");
    } finally {
      setProcessing(false);
    }
  };

  const createUnavailabilityMutation = useMutation({
    mutationFn: (data) => base44.entities.Unavailability.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unavailability'] });
      queryClient.invalidateQueries({ queryKey: ['unavailability-for-quick-input'] });
      setInputText("");
      setExtractedAvailability(null);
      onClose();
    },
  });

  const handleConfirm = () => {
    if (extractedAvailability.potential_overlap && extractedAvailability.overlap_details) {
      const overlap = extractedAvailability.overlap_details[0];
      if (!window.confirm(`${extractedAvailability.member_name} already has unavailability from ${overlap.start_date} to ${overlap.end_date}. Create anyway?`)) {
        return;
      }
    }

    const availabilityData = {
      member_name: extractedAvailability.member_name,
      member_email: extractedAvailability.member_email || '',
      start_date: extractedAvailability.start_date,
      end_date: extractedAvailability.end_date,
      // Removed 'reason' field
    };

    createUnavailabilityMutation.mutate(availabilityData);
  };

  const confidenceColors = {
    high: "text-green-400",
    medium: "text-yellow-400",
    low: "text-orange-400"
  };

  return (
    <Card className="bg-gradient-to-br from-orange-500/10 to-purple-500/10 backdrop-blur-sm border-orange-500/30 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-400" />
          Quick Availability Entry
          <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Type natural language like: <span className="text-orange-400 font-medium">"neil 6april-9th"</span>
        </p>
        {allUnavailability.length > 0 && (
          <p className="text-xs text-green-400 mt-1">
            🧠 AI has learned from {allUnavailability.length} previous records
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        {!extractedAvailability && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleProcess()}
                placeholder="e.g., dave 12-20 aug, sarah next week"
                className="bg-white/5 border-orange-500/30 text-white text-lg flex-1"
                disabled={processing}
              />
              <Button
                onClick={handleProcess}
                disabled={processing || !inputText.trim()}
                className="bg-gradient-to-r from-orange-500 to-purple-500 hover:from-orange-600 hover:to-purple-600 px-6"
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
                <li>• Member names (learns from {[...new Set(allUnavailability.map(r => r.member_name))].length} known members)</li>
                <li>• Date ranges (flexible formats: "6april-9th", "12-20 aug", "next week")</li>
                <li>• Email addresses (remembered from previous entries)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Extracted Availability Preview */}
        <AnimatePresence>
          {extractedAvailability && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Overlap Warning */}
              {extractedAvailability.potential_overlap && extractedAvailability.overlap_details && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-yellow-400 mb-2">⚠️ Overlapping Dates</h4>
                      <p className="text-sm text-gray-300 mb-2">
                        <strong>{extractedAvailability.member_name}</strong> already has unavailability during these dates
                      </p>
                      {extractedAvailability.overlap_details.map((overlap, idx) => (
                        <div key={idx} className="text-xs text-gray-400 mb-1">
                          {overlap.start_date} to {overlap.end_date}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    <span className="text-white font-medium">AI Analysis Complete</span>
                  </div>
                  <span className={`text-sm font-medium ${confidenceColors[extractedAvailability.confidence]}`}>
                    {extractedAvailability.confidence} confidence
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Member Name</div>
                    <div className="text-white font-medium">{extractedAvailability.member_name}</div>
                  </div>
                  {extractedAvailability.member_email && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Email</div>
                      <div className="text-white font-medium">{extractedAvailability.member_email}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Start Date</div>
                    <div className="text-white font-medium">{extractedAvailability.start_date}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">End Date</div>
                    <div className="text-white font-medium">{extractedAvailability.end_date}</div>
                  </div>
                  {/* Removed 'Reason' display block */}
                </div>

                {extractedAvailability.assumptions_made && extractedAvailability.assumptions_made.length > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <div className="text-xs text-blue-400 font-medium mb-2">AI Assumptions:</div>
                    <ul className="text-xs text-gray-400 space-y-1">
                      {extractedAvailability.assumptions_made.map((assumption, idx) => (
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
                    setExtractedAvailability(null);
                    setInputText("");
                  }}
                  className="flex-1 border-white/10"
                >
                  Start Over
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={createUnavailabilityMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600"
                >
                  {createUnavailabilityMutation.isPending ? (
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
