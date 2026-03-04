
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, CheckCircle, AlertCircle, Edit, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function AddressUpdater() {
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, venue: '' });
  const [results, setResults] = useState([]);

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-address-update'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const { data: rehearsals = [] } = useQuery({
    queryKey: ['rehearsals-address-check'], // Changed queryKey
    queryFn: async () => {
      const gigs = await base44.entities.Gig.list('date');
      return gigs.filter(g => g.type === 'rehearsal');
    },
    initialData: [],
  });

  // Note: The original implementation in updateAllAddresses directly used base44.entities.Booking.update
  // instead of this mutation. For consistency with the provided outline, the mutation is not used
  // and direct calls to base44.entities.Booking.update and base44.entities.Gig.update are made.
  // This mutation is kept here as it was part of the original file, but is effectively unused
  // if following the direct update pattern.
  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Booking.update(id, data),
  });

  const findVenueAddress = async (venueName, existingAddress) => {
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Find the complete, valid UK address for this venue: "${venueName}"
        ${existingAddress ? `Current address on file: "${existingAddress}"` : ''}
        
        Search for:
        - Official venue website
        - Google Maps listing
        - Business directories
        - Social media pages
        
        Return a complete UK address including:
        - Street address
        - City/Town
        - Postcode
        
        Return JSON:
        {
          "found": boolean,
          "venue_name": "official venue name",
          "address": "complete address with postcode",
          "confidence": "high/medium/low",
          "source": "where you found it"
        }`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            found: { type: "boolean" },
            venue_name: { type: "string" },
            address: { type: "string" },
            confidence: { type: "string" },
            source: { type: "string" }
          }
        }
      });

      return result;
    } catch (error) {
      console.error(`Error finding address for ${venueName}:`, error);
      return { found: false, error: error.message };
    }
  };

  const updateAllAddresses = async () => {
    setUpdating(true);
    setResults([]);
    
    // Only flag INVOICE bookings and PRACTICE SESSIONS
    const invoiceBookingsToUpdate = bookings.filter(b => 
      b.payment_method === 'invoice' && (!b.venue_address || b.venue_address.length < 10)
    );
    
    const rehearsalsToUpdate = rehearsals.filter(r => 
      !r.address || r.address.length < 10
    );
    
    const totalToUpdate = invoiceBookingsToUpdate.length + rehearsalsToUpdate.length;
    setProgress({ current: 0, total: totalToUpdate, venue: '' });

    const updateResults = [];

    // Update invoice bookings
    for (let i = 0; i < invoiceBookingsToUpdate.length; i++) {
      const booking = invoiceBookingsToUpdate[i];
      setProgress({ current: i + 1, total: totalToUpdate, venue: booking.venue_name });

      const addressResult = await findVenueAddress(booking.venue_name, booking.venue_address);
      
      if (addressResult.found && addressResult.confidence !== 'low') {
        try {
          await base44.entities.Booking.update(booking.id, { venue_address: addressResult.address });

          updateResults.push({
            venue: booking.venue_name,
            type: 'Invoice Gig',
            status: 'success',
            address: addressResult.address,
            confidence: addressResult.confidence,
            source: addressResult.source
          });
        } catch (error) {
          updateResults.push({
            venue: booking.venue_name,
            type: 'Invoice Gig',
            status: 'error',
            error: 'Failed to update booking'
          });
        }
      } else {
        updateResults.push({
          venue: booking.venue_name,
          type: 'Invoice Gig',
          status: 'not_found',
          error: addressResult.error || 'Address not found or low confidence'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Update practice sessions
    for (let i = 0; i < rehearsalsToUpdate.length; i++) {
      const rehearsal = rehearsalsToUpdate[i];
      setProgress({ current: invoiceBookingsToUpdate.length + i + 1, total: totalToUpdate, venue: rehearsal.venue });

      const addressResult = await findVenueAddress(rehearsal.venue, rehearsal.address);
      
      if (addressResult.found && addressResult.confidence !== 'low') {
        try {
          // Assuming base44.entities.Gig has an update method and 'address' field
          await base44.entities.Gig.update(rehearsal.id, { address: addressResult.address });

          updateResults.push({
            venue: rehearsal.venue,
            type: 'Practice Session',
            status: 'success',
            address: addressResult.address,
            confidence: addressResult.confidence,
            source: addressResult.source
          });
        } catch (error) {
          updateResults.push({
            venue: rehearsal.venue,
            type: 'Practice Session',
            status: 'error',
            error: 'Failed to update rehearsal'
          });
        }
      } else {
        updateResults.push({
          venue: rehearsal.venue,
          type: 'Practice Session',
          status: 'not_found',
          error: addressResult.error || 'Address not found or low confidence'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setResults(updateResults);
    setUpdating(false);
    // Invalidate relevant queries
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['bookings-address-update'] });
    queryClient.invalidateQueries({ queryKey: ['rehearsals-address-check'] }); // Updated query key
    queryClient.invalidateQueries({ queryKey: ['gigs'] }); // Also invalidate general gigs query if it exists

    const successCount = updateResults.filter(r => r.status === 'success').length;
    toast.success(`Updated ${successCount} out of ${totalToUpdate} venues`);
  };

  // Filter for invoice bookings and practice sessions only
  const invoiceBookingsNeedingAddresses = bookings.filter(b => 
    b.payment_method === 'invoice' && (!b.venue_address || b.venue_address.length < 10)
  );
  
  const rehearsalsNeedingAddresses = rehearsals.filter(r => 
    !r.address || r.address.length < 10
  );

  const totalMissing = invoiceBookingsNeedingAddresses.length + rehearsalsNeedingAddresses.length; // Renamed variable

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-orange-400" />
          Venue Address Updater
        </CardTitle>
        <p className="text-sm text-gray-400 mt-2">
          Find and add missing venue addresses for invoice gigs and practice sessions
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalMissing === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-green-400 font-medium">All venues have addresses!</p>
            <p className="text-gray-500 text-sm mt-2">No missing addresses for invoice gigs or practice sessions</p>
          </div>
        ) : (
          <>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-300 font-medium">Venues Missing Addresses</p>
                <Badge className="bg-orange-500/20 text-orange-400">
                  {totalMissing} total
                </Badge>
              </div>
              <div className="text-sm text-gray-400 space-y-1">
                <p>• {invoiceBookingsNeedingAddresses.length} invoice gig{invoiceBookingsNeedingAddresses.length !== 1 ? 's' : ''}</p>
                <p>• {rehearsalsNeedingAddresses.length} practice session{rehearsalsNeedingAddresses.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {!updating ? (
              <Button
                onClick={updateAllAddresses}
                disabled={totalMissing === 0}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Find All Addresses with AI
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    Processing {progress.current} of {progress.total}...
                  </span>
                  <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-orange-600 h-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">{progress.venue}</p>
              </div>
            )}

            {/* List of bookings needing addresses - clickable */}
            {invoiceBookingsNeedingAddresses.length > 0 && !updating && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <h4 className="text-sm font-semibold text-white mb-2">Invoice Gigs Missing Addresses:</h4>
                {invoiceBookingsNeedingAddresses.map((booking) => (
                  <Link
                    key={booking.id}
                    to={createPageUrl("Bookings")}
                    state={{ scrollToBooking: booking.id }}
                  >
                    <div className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all cursor-pointer group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm group-hover:text-yellow-400 transition-colors">
                            {booking.venue_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(booking.event_date), 'MMM d, yyyy')}
                          </div>
                        </div>
                        <Edit className="w-4 h-4 text-yellow-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Practice Sessions List */}
            {rehearsalsNeedingAddresses.length > 0 && !updating && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <h4 className="text-sm font-semibold text-white mb-2">Practice Sessions Missing Addresses:</h4>
                {rehearsalsNeedingAddresses.map((rehearsal) => (
                  <div
                    key={rehearsal.id}
                    // Note: Direct linking to edit gig not supported yet in `createPageUrl` or `state`
                    // This will remain a static div for now, but could be extended with a specific route
                    className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm group-hover:text-cyan-400 transition-colors">
                          🎸 {rehearsal.venue}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(rehearsal.date), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <Edit className="w-4 h-4 text-cyan-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <h4 className="text-sm font-semibold text-white mb-2">Results:</h4>
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      result.status === 'success'
                        ? 'bg-green-500/10 border-green-500/20'
                        : result.status === 'not_found'
                        ? 'bg-yellow-500/10 border-yellow-500/20'
                        : 'bg-red-500/10 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {result.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium text-sm">{result.venue}</p>
                          <Badge className="bg-white/10 text-xs text-gray-300">{result.type}</Badge>
                        </div>
                        {result.status === 'success' ? (
                          <>
                            <p className="text-xs text-gray-400 mt-1">{result.address}</p>
                            <p className="text-xs text-green-400 mt-1">
                              Confidence: {result.confidence} • Source: {result.source}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">{result.error}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
