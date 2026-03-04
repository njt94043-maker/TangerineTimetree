import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigation, Calculator, Loader2, TrendingUp, Calendar, AlertCircle, Music } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { toast } from "sonner";

export default function CombinedMileageTracker() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [calculating, setCalculating] = useState(null);
  const [activeTab, setActiveTab] = useState("gigs");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
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
    queryFn: async () => {
      if (!user || !user.email) return [];
      const records = await base44.entities.MileageRecord.list('-event_date');
      return records.filter(r => r.member_email === user.email && r.tax_year === currentTaxYear);
    },
    initialData: [],
    enabled: !!user && !!user.email
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-mileage'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
    enabled: !!user
  });

  const { data: rehearsals = [] } = useQuery({
    queryKey: ['rehearsals-mileage'],
    queryFn: async () => {
      const gigs = await base44.entities.Gig.list('date');
      return gigs.filter(g => g.type === 'rehearsal');
    },
    initialData: [],
    enabled: !!user
  });

  const createMileageRecordMutation = useMutation({
    mutationFn: (recordData) => base44.entities.MileageRecord.create(recordData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mileage-records'] });
      toast.success('Mileage calculated and saved!');
    },
  });

  const calculateMileage = async (event, type) => {
    if (!user || !user.email) {
      toast.error('User information not loaded');
      return;
    }

    const address = type === 'booking' ? event.venue_address : event.address;
    const venueName = type === 'booking' ? event.venue_name : event.venue;
    const eventDate = type === 'booking' ? event.event_date : event.date;
    
    const hasAddress = user?.address_line1 && user?.city && user?.postcode;
    const userAddress = hasAddress 
      ? `${user.address_line1}, ${user.city}, ${user.postcode}`.trim()
      : null;
    
    if (!userAddress || !address) {
      toast.error('Missing address information. Please ensure your home address and the event venue address are set.');
      return;
    }

    setCalculating(event.id);

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate the driving distance in miles between these two UK addresses:
        
From: ${userAddress}
To: ${address}

Return ONLY a JSON object with this structure:
{
  "distance_miles": <number>,
  "notes": "<brief route description>"
}`,
        response_json_schema: {
          type: "object",
          properties: {
            distance_miles: { type: "number" },
            notes: { type: "string" }
          }
        }
      });

      const { distance_miles, notes } = response;
      const returnDistance = distance_miles * 2;
      const mileageRate = 0.45;
      const totalClaim = returnDistance * mileageRate;

      const mileageData = {
        ...(type === 'booking' ? { booking_id: event.id } : { rehearsal_id: event.id }),
        member_email: user.email,
        member_name: user.full_name,
        venue_name: venueName,
        event_date: eventDate,
        distance_miles: distance_miles,
        return_distance_miles: returnDistance,
        from_address: userAddress,
        to_address: address,
        tax_year: currentTaxYear,
        mileage_rate: mileageRate,
        total_claim: totalClaim,
        record_type: type === 'booking' ? 'invoice_gig' : 'practice_session'
      };

      await createMileageRecordMutation.mutateAsync(mileageData);
    } catch (error) {
      toast.error('Failed to calculate mileage');
    } finally {
      setCalculating(null);
    }
  };

  if (!user) {
    return (
      <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const taxYearBookings = bookings.filter(booking => {
    const eventDate = new Date(booking.event_date);
    eventDate.setHours(23, 59, 59, 999);
    const now = new Date();
    
    return booking.payment_method === 'invoice' && 
           isAfter(eventDate, taxYearDates.start) && 
           isBefore(eventDate, taxYearDates.end) &&
           isBefore(eventDate, now);
  });

  const taxYearRehearsals = rehearsals.filter(rehearsal => {
    const eventDate = new Date(rehearsal.date);
    eventDate.setHours(23, 59, 59, 999);
    const now = new Date();
    
    return isAfter(eventDate, taxYearDates.start) && 
           isBefore(eventDate, taxYearDates.end) &&
           isBefore(eventDate, now);
  });

  const uncalculatedBookings = taxYearBookings.filter(booking => 
    !mileageRecords.some(record => record.booking_id === booking.id)
  );

  const uncalculatedRehearsals = taxYearRehearsals.filter(rehearsal => 
    !mileageRecords.some(record => record.rehearsal_id === rehearsal.id)
  );

  const totalMileageClaimed = mileageRecords.reduce((sum, record) => sum + (record.total_claim || 0), 0);
  const totalMilesRecorded = mileageRecords.reduce((sum, record) => sum + (record.return_distance_miles || 0), 0);

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Navigation className="w-5 h-5 text-green-400" />
            Mileage Tracker (Tax Year {currentTaxYear})
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">Total Mileage Claim</p>
              <p className="text-2xl font-bold text-green-400">£{totalMileageClaimed.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Total Miles</p>
              <p className="text-xl font-bold text-white">{totalMilesRecorded.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="gigs">
              Invoice Gigs ({uncalculatedBookings.length})
            </TabsTrigger>
            <TabsTrigger value="rehearsals">
              <Music className="w-4 h-4 mr-2" />
              Rehearsals ({uncalculatedRehearsals.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gigs" className="space-y-4">
            {uncalculatedBookings.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>All invoice gigs in this tax year have mileage calculated!</p>
              </div>
            ) : (
              uncalculatedBookings.map(booking => (
                <div key={booking.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">{booking.venue_name}</h4>
                      <p className="text-sm text-gray-400 mb-2">{booking.client_name}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(booking.event_date), 'MMM d, yyyy')}
                        </div>
                        {booking.venue_address && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <Navigation className="w-4 h-4" />
                            {booking.venue_address.split(',')[0]}
                          </div>
                        )}
                      </div>
                      {!booking.venue_address && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm mt-2">
                          <AlertCircle className="w-4 h-4" />
                          Missing venue address
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => calculateMileage(booking, 'booking')}
                      disabled={calculating === booking.id || !booking.venue_address}
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                    >
                      {calculating === booking.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Calculating...
                        </>
                      ) : (
                        <>
                          <Calculator className="w-4 h-4 mr-2" />
                          Calculate
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="rehearsals" className="space-y-4">
            {uncalculatedRehearsals.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>All rehearsals in this tax year have mileage calculated!</p>
              </div>
            ) : (
              uncalculatedRehearsals.map(rehearsal => (
                <div key={rehearsal.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">{rehearsal.title || rehearsal.venue}</h4>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(rehearsal.date), 'MMM d, yyyy')}
                        </div>
                        {rehearsal.address && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <Navigation className="w-4 h-4" />
                            {rehearsal.address.split(',')[0]}
                          </div>
                        )}
                      </div>
                      {!rehearsal.address && (
                        <div className="flex items-center gap-2 text-orange-400 text-sm mt-2">
                          <AlertCircle className="w-4 h-4" />
                          Missing venue address
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => calculateMileage(rehearsal, 'rehearsal')}
                      disabled={calculating === rehearsal.id || !rehearsal.address}
                      className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                    >
                      {calculating === rehearsal.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Calculating...
                        </>
                      ) : (
                        <>
                          <Calculator className="w-4 h-4 mr-2" />
                          Calculate
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}