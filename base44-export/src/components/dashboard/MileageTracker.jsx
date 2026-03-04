import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navigation, Calculator, Loader2, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { toast } from "sonner";

export default function MileageTracker() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [calculating, setCalculating] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const getCurrentTaxYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const taxYearStart = new Date(currentYear, 3, 6);
    
    if (now >= taxYearStart) {
      return `${currentYear}-${currentYear + 1}`;
    } else {
      return `${currentYear - 1}-${currentYear}`;
    }
  };

  const getTaxYearDates = (taxYear) => {
    const [startYear] = taxYear.split('-').map(Number);
    return {
      start: new Date(startYear, 3, 6),
      end: new Date(startYear + 1, 3, 5, 23, 59, 59)
    };
  };

  const currentTaxYear = getCurrentTaxYear();
  const taxYearDates = getTaxYearDates(currentTaxYear);

  const { data: mileageRecords = [] } = useQuery({
    queryKey: ['mileage-records', user?.email],
    queryFn: () => base44.entities.MileageRecord.filter({ 
      member_email: user?.email,
      tax_year: currentTaxYear,
      record_type: 'invoice_gig'
    }),
    initialData: [],
    enabled: !!user?.email,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-mileage'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const createMileageRecordMutation = useMutation({
    mutationFn: (recordData) => base44.entities.MileageRecord.create(recordData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mileage-records'] });
      toast.success('Mileage calculated and saved!');
    },
  });

  // Filter ONLY INVOICE bookings for current tax year that have ALREADY HAPPENED
  const taxYearBookings = bookings.filter(booking => {
    const eventDate = new Date(booking.event_date);
    eventDate.setHours(23, 59, 59, 999);
    const now = new Date();
    
    return booking.payment_method === 'invoice' && 
           isAfter(eventDate, taxYearDates.start) && 
           isBefore(eventDate, taxYearDates.end) &&
           isBefore(eventDate, now);
  });

  const uncalculatedBookings = taxYearBookings.filter(booking => 
    !mileageRecords.some(record => record.booking_id === booking.id)
  );

  const hasAddress = user?.address_line1 && user?.city && user?.postcode;
  const userAddress = hasAddress 
    ? `${user.address_line1}, ${user.city}, ${user.postcode}`.trim()
    : null;

  const calculateMileage = async (booking) => {
    if (!userAddress || !booking.venue_address) {
      toast.error('Missing address information');
      return;
    }

    setCalculating(booking.id);
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate the ACTUAL DRIVING DISTANCE (not straight line) in miles from "${userAddress}" to "${booking.venue_address}". 
        Use real road routes and driving directions.
        Return ONLY a JSON object with: {"distance_miles": number, "duration_minutes": number}
        Be accurate with the actual driving route distance.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            distance_miles: { type: "number" },
            duration_minutes: { type: "number" }
          }
        }
      });

      const oneWayDistance = result.distance_miles;
      const returnDistance = oneWayDistance * 2;
      const mileageRate = 0.45;
      const totalClaim = returnDistance * mileageRate;

      await createMileageRecordMutation.mutateAsync({
        booking_id: booking.id,
        member_email: user.email,
        member_name: user.full_name,
        venue_name: booking.venue_name,
        event_date: booking.event_date,
        distance_miles: oneWayDistance,
        return_distance_miles: returnDistance,
        from_address: userAddress,
        to_address: booking.venue_address,
        tax_year: currentTaxYear,
        mileage_rate: mileageRate,
        total_claim: totalClaim,
        record_type: 'invoice_gig'
      });

    } catch (error) {
      console.error('Mileage calculation error:', error);
      toast.error('Failed to calculate mileage');
    } finally {
      setCalculating(null);
    }
  };

  const totalMiles = mileageRecords.reduce((sum, record) => sum + record.return_distance_miles, 0);
  const totalClaim = mileageRecords.reduce((sum, record) => sum + record.total_claim, 0);

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Navigation className="w-5 h-5 text-green-500" />
            Invoice Gigs Mileage
          </CardTitle>
          <Badge className="bg-blue-500/20 text-blue-400">
            Tax Year {currentTaxYear}
          </Badge>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Track business mileage for invoice gigs
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAddress && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-400 font-medium">Address Required</p>
              <p className="text-xs text-gray-400 mt-1">
                Add your home address in your Profile to calculate mileage
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="w-4 h-4 text-green-400" />
              <p className="text-xs text-gray-400">Total Miles</p>
            </div>
            <p className="text-2xl font-bold text-white">{totalMiles.toFixed(1)}</p>
            <p className="text-xs text-gray-500 mt-1">{mileageRecords.length} invoice gigs</p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-gray-400">Total Claim</p>
            </div>
            <p className="text-2xl font-bold text-white">£{totalClaim.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">@ £0.45/mile</p>
          </div>
        </div>

        {uncalculatedBookings.length > 0 && hasAddress && (
          <div>
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Calculate Mileage ({uncalculatedBookings.length} invoice gigs)
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {uncalculatedBookings.map((booking) => (
                <div 
                  key={booking.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{booking.venue_name}</p>
                    <p className="text-xs text-gray-400">{format(new Date(booking.event_date), 'MMM d, yyyy')}</p>
                    {!booking.venue_address && (
                      <p className="text-xs text-red-400 mt-1">⚠️ No venue address</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => calculateMileage(booking)}
                    disabled={calculating === booking.id || !booking.venue_address}
                    className="bg-green-600 hover:bg-green-700 h-8 ml-2"
                  >
                    {calculating === booking.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Calculator className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {mileageRecords.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Recent Journeys</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {mileageRecords
                .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
                .slice(0, 10)
                .map((record) => (
                  <div 
                    key={record.id}
                    className="p-3 bg-white/5 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-white text-sm">{record.venue_name}</p>
                        <p className="text-xs text-gray-400">{format(new Date(record.event_date), 'MMM d, yyyy')}</p>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400">
                        £{record.total_claim.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{record.return_distance_miles.toFixed(1)} miles (return)</span>
                      <span>•</span>
                      <span>£{record.mileage_rate}/mile</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {uncalculatedBookings.length === 0 && mileageRecords.length === 0 && (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No invoice gigs in current tax year yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}