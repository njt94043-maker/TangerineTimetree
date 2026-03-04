import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Loader2, Calculator } from "lucide-react";
import { format, isAfter } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function MileageCalculator({ bookings }) {
  const [user, setUser] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [distances, setDistances] = useState({});
  const [expandedBooking, setExpandedBooking] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const today = new Date();
  const upcomingBookings = bookings
    .filter(booking => isAfter(new Date(booking.event_date), today))
    .slice(0, 5);

  const hasAddress = user?.address_line1 && user?.city && user?.postcode;
  const userAddress = hasAddress 
    ? `${user.address_line1}, ${user.city}, ${user.postcode}`.trim()
    : null;

  const calculateDistance = async (booking) => {
    if (!userAddress || !booking.venue_address) {
      toast.error('Address information missing');
      return;
    }

    setCalculating(booking.id);
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate the driving distance in miles from "${userAddress}" to "${booking.venue_address}". 
        Return ONLY a JSON object with this exact format: {"distance_miles": number, "duration_minutes": number}
        Example: {"distance_miles": 12.5, "duration_minutes": 25}`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            distance_miles: { type: "number" },
            duration_minutes: { type: "number" }
          }
        }
      });

      setDistances(prev => ({
        ...prev,
        [booking.id]: result
      }));
      
      setExpandedBooking(booking.id);
    } catch (error) {
      toast.error('Failed to calculate distance');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Navigation className="w-5 h-5 text-green-500" />
          Mileage Calculator
        </CardTitle>
        {!hasAddress && (
          <p className="text-sm text-yellow-400 mt-2">
            ⚠️ Add your home address in your profile to calculate distances
          </p>
        )}
      </CardHeader>
      <CardContent>
        {upcomingBookings.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No upcoming gigs scheduled</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map((booking) => {
              const distance = distances[booking.id];
              const isExpanded = expandedBooking === booking.id;

              return (
                <div 
                  key={booking.id} 
                  className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white text-sm">{booking.venue_name}</h4>
                      <p className="text-xs text-gray-400 mt-1">{booking.venue_address || 'No address'}</p>
                      <p className="text-xs text-green-400 mt-1">
                        {format(new Date(booking.event_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    
                    {hasAddress && booking.venue_address && (
                      <Button
                        size="sm"
                        onClick={() => calculateDistance(booking)}
                        disabled={calculating === booking.id}
                        className="bg-green-600 hover:bg-green-700 h-8"
                      >
                        {calculating === booking.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Calculator className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>

                  {distance && isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs">Distance</p>
                          <p className="text-white font-semibold">
                            {distance.distance_miles.toFixed(1)} miles
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Travel Time</p>
                          <p className="text-white font-semibold">
                            {Math.round(distance.duration_minutes)} mins
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 p-2 bg-blue-500/10 rounded text-xs text-blue-300">
                        💡 Mileage rate: £0.45/mile = £{(distance.distance_miles * 0.45).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}