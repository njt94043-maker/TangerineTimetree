import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, Calculator, Loader2, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { toast } from "sonner";

export default function PracticeSessionTracker() {
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
    queryKey: ['practice-mileage-records', user?.email],
    queryFn: () => base44.entities.MileageRecord.filter({ 
      member_email: user?.email,
      tax_year: currentTaxYear,
      record_type: 'practice_session'
    }),
    initialData: [],
    enabled: !!user?.email,
  });

  const { data: rehearsals = [] } = useQuery({
    queryKey: ['rehearsals-mileage'],
    queryFn: async () => {
      const gigs = await base44.entities.Gig.list('date');
      return gigs.filter(g => g.type === 'rehearsal');
    },
    initialData: [],
  });

  const createMileageRecordMutation = useMutation({
    mutationFn: (recordData) => base44.entities.MileageRecord.create(recordData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-mileage-records'] });
      toast.success('Practice session mileage calculated!');
    },
  });

  // Filter practice sessions that have already happened
  const taxYearRehearsals = rehearsals.filter(rehearsal => {
    const eventDate = new Date(rehearsal.date);
    eventDate.setHours(23, 59, 59, 999);
    const now = new Date();
    
    return isAfter(eventDate, taxYearDates.start) && 
           isBefore(eventDate, taxYearDates.end) &&
           isBefore(eventDate, now);
  });

  const uncalculatedRehearsals = taxYearRehearsals.filter(rehearsal => 
    !mileageRecords.some(record => record.rehearsal_id === rehearsal.id)
  );

  const hasAddress = user?.address_line1 && user?.city && user?.postcode;
  const userAddress = hasAddress 
    ? `${user.address_line1}, ${user.city}, ${user.postcode}`.trim()
    : null;

  const calculateMileage = async (rehearsal) => {
    if (!userAddress || !rehearsal.address) {
      toast.error('Missing address information');
      return;
    }

    setCalculating(rehearsal.id);
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate the ACTUAL DRIVING DISTANCE (not straight line) in miles from "${userAddress}" to "${rehearsal.address}". 
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
        rehearsal_id: rehearsal.id,
        member_email: user.email,
        member_name: user.full_name,
        venue_name: rehearsal.venue,
        event_date: rehearsal.date,
        distance_miles: oneWayDistance,
        return_distance_miles: returnDistance,
        from_address: userAddress,
        to_address: rehearsal.address,
        tax_year: currentTaxYear,
        mileage_rate: mileageRate,
        total_claim: totalClaim,
        record_type: 'practice_session'
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
    <Card className="bg-white/5 backdrop-blur-sm border-cyan-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-cyan-500" />
            Practice Sessions Mileage
          </CardTitle>
          <Badge className="bg-cyan-500/20 text-cyan-400">
            Tax Year {currentTaxYear}
          </Badge>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Track mileage for band rehearsals
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
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Music className="w-4 h-4 text-cyan-400" />
              <p className="text-xs text-gray-400">Total Miles</p>
            </div>
            <p className="text-2xl font-bold text-white">{totalMiles.toFixed(1)}</p>
            <p className="text-xs text-gray-500 mt-1">{mileageRecords.length} sessions</p>
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

        {uncalculatedRehearsals.length > 0 && hasAddress && (
          <div>
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Calculate Mileage ({uncalculatedRehearsals.length} sessions)
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {uncalculatedRehearsals.map((rehearsal) => (
                <div 
                  key={rehearsal.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{rehearsal.venue}</p>
                    <p className="text-xs text-gray-400">{format(new Date(rehearsal.date), 'MMM d, yyyy')}</p>
                    {!rehearsal.address && (
                      <p className="text-xs text-red-400 mt-1">⚠️ No venue address</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => calculateMileage(rehearsal)}
                    disabled={calculating === rehearsal.id || !rehearsal.address}
                    className="bg-cyan-600 hover:bg-cyan-700 h-8 ml-2"
                  >
                    {calculating === rehearsal.id ? (
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
            <h4 className="text-sm font-semibold text-white mb-3">Recent Sessions</h4>
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
                      <Badge className="bg-cyan-500/20 text-cyan-400">
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

        {uncalculatedRehearsals.length === 0 && mileageRecords.length === 0 && (
          <div className="text-center py-8">
            <Music className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No practice sessions in current tax year yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}