import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, X, MapPin, User, Calendar, CheckCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, isAfter, isBefore } from "date-fns";

export default function MissingInfoChecker() {
  const [showModal, setShowModal] = useState(false);
  const [user, setUser] = useState(null);
  const [validatingAddresses, setValidatingAddresses] = useState(false);
  const [addressValidation, setAddressValidation] = useState({});

  React.useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-missing-info'],
    queryFn: () => base44.entities.Booking.list('-event_date'),
    initialData: [],
  });

  const { data: mileageRecords = [] } = useQuery({
    queryKey: ['mileage-records-check', user?.email],
    queryFn: () => base44.entities.MileageRecord.filter({ member_email: user?.email }),
    initialData: [],
    enabled: !!user?.email,
  });

  // Get current tax year dates
  const getCurrentTaxYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const taxYearStart = new Date(currentYear, 3, 6);
    return now >= taxYearStart ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;
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

  // Validate address using AI
  const validateAddress = async (address, type = 'user') => {
    if (!address) return { valid: false, reason: 'Address is empty' };
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Validate if this is a real, properly formatted UK address that can be used for GPS navigation and distance calculations: "${address}"
        
        Check:
        1. Is it a complete UK address with street, city, and postcode?
        2. Does the postcode format look valid (e.g., CF10 1AA)?
        3. Can this address be used to calculate driving directions?
        
        Return JSON:
        {
          "is_valid": boolean,
          "reason": "brief explanation of what's wrong or 'Valid address'",
          "suggestions": "if invalid, what needs to be added/fixed"
        }`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            is_valid: { type: "boolean" },
            reason: { type: "string" },
            suggestions: { type: "string" }
          }
        }
      });

      return {
        valid: result.is_valid,
        reason: result.reason,
        suggestions: result.suggestions
      };
    } catch (error) {
      return { valid: false, reason: 'Could not validate address' };
    }
  };

  // Validate all addresses when modal opens
  useEffect(() => {
    if (showModal && user && Object.keys(addressValidation).length === 0) {
      validateAllAddresses();
    }
  }, [showModal, user]);

  const validateAllAddresses = async () => {
    setValidatingAddresses(true);
    const validation = {};

    // Validate user address
    if (user?.address_line1 && user?.city && user?.postcode) {
      const userAddress = `${user.address_line1}, ${user.city}, ${user.postcode}`;
      validation.user = await validateAddress(userAddress, 'user');
    }

    // Validate venue addresses for past invoice bookings
    const pastInvoiceBookings = bookings.filter(booking => {
      const eventDate = new Date(booking.event_date);
      eventDate.setHours(23, 59, 59, 999);
      const now = new Date();
      return booking.payment_method === 'invoice' &&
             isAfter(eventDate, taxYearDates.start) &&
             isBefore(eventDate, taxYearDates.end) &&
             isBefore(eventDate, now);
    });

    for (const booking of pastInvoiceBookings) {
      if (booking.venue_address) {
        validation[`booking_${booking.id}`] = await validateAddress(booking.venue_address, 'venue');
      }
    }

    setAddressValidation(validation);
    setValidatingAddresses(false);
  };

  // Check for missing information
  const missingInfo = [];

  // 1. User profile missing address (needed for mileage calculation)
  const hasUserAddress = user?.address_line1 && user?.city && user?.postcode;
  if (!hasUserAddress) {
    missingInfo.push({
      type: 'profile',
      category: 'Your Profile',
      icon: User,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      title: 'Home Address Missing',
      description: 'Add your home address to calculate mileage for tax purposes',
      link: createPageUrl('Profile'),
      linkText: 'Update Profile'
    });
  } else if (addressValidation.user && !addressValidation.user.valid) {
    // User has address but it's invalid
    missingInfo.push({
      type: 'profile',
      category: 'Your Profile',
      icon: AlertCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      title: 'Home Address Invalid',
      description: `${addressValidation.user.reason}. ${addressValidation.user.suggestions || 'Please update with a complete UK address including postcode.'}`,
      link: createPageUrl('Profile'),
      linkText: 'Fix Address'
    });
  }

  // 2. Past invoice bookings missing venue address (needed for mileage)
  const pastInvoiceBookings = bookings.filter(booking => {
    const eventDate = new Date(booking.event_date);
    eventDate.setHours(23, 59, 59, 999);
    const now = new Date();
    return booking.payment_method === 'invoice' &&
           isAfter(eventDate, taxYearDates.start) &&
           isBefore(eventDate, taxYearDates.end) &&
           isBefore(eventDate, now);
  });

  pastInvoiceBookings.forEach(booking => {
    if (!booking.venue_address) {
      missingInfo.push({
        type: 'booking',
        category: 'Booking Details',
        icon: MapPin,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        title: `${booking.venue_name} - Missing Venue Address`,
        description: `Event on ${format(new Date(booking.event_date), 'MMM d, yyyy')} needs venue address for mileage calculation`,
        link: createPageUrl('Bookings'),
        linkText: 'Add Address'
      });
    } else {
      // Check if address is invalid
      const validation = addressValidation[`booking_${booking.id}`];
      if (validation && !validation.valid) {
        missingInfo.push({
          type: 'booking',
          category: 'Booking Details',
          icon: AlertCircle,
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          title: `${booking.venue_name} - Invalid Venue Address`,
          description: `${validation.reason}. ${validation.suggestions || 'Update with a complete UK address.'}`,
          link: createPageUrl('Bookings'),
          linkText: 'Fix Address'
        });
      }
    }
  });

  // 3. Past invoice bookings with valid address but no mileage calculated yet
  const uncalculatedMileage = pastInvoiceBookings.filter(booking => {
    const validation = addressValidation[`booking_${booking.id}`];
    return booking.venue_address &&
           (!validation || validation.valid) && // Only if address is valid or not checked yet
           !mileageRecords.some(record => record.booking_id === booking.id);
  });

  if (hasUserAddress && addressValidation.user?.valid && uncalculatedMileage.length > 0) {
    missingInfo.push({
      type: 'mileage',
      category: 'Mileage Tracking',
      icon: Calendar,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      title: `${uncalculatedMileage.length} Invoice Gigs Need Mileage Calculation`,
      description: 'Calculate mileage to track your tax-deductible business miles',
      link: createPageUrl('Dashboard'),
      linkText: 'Calculate Mileage'
    });
  }

  const totalIssues = missingInfo.length;

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        variant="outline"
        size="sm"
        className={`border-white/10 ${
          totalIssues > 0
            ? 'text-yellow-400 hover:bg-yellow-500/10'
            : 'text-green-400 hover:bg-green-500/10'
        }`}
      >
        {totalIssues > 0 ? (
          <>
            <AlertCircle className="w-4 h-4 mr-2" />
            {totalIssues} Missing Info
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            All Info Complete
          </>
        )}
      </Button>

      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setShowModal(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl z-50"
            >
              <Card className="bg-gray-900 border-white/20 h-full md:h-auto md:max-h-[80vh] flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      {validatingAddresses ? (
                        <>
                          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                          Validating Addresses...
                        </>
                      ) : totalIssues > 0 ? (
                        <>
                          <AlertCircle className="w-5 h-5 text-yellow-400" />
                          Missing Information ({totalIssues})
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          All Information Complete
                        </>
                      )}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowModal(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    {validatingAddresses
                      ? 'Checking addresses for mileage calculations...'
                      : totalIssues > 0
                      ? 'Complete this information to enable full mileage tracking'
                      : 'All required information is present for mileage calculations'}
                  </p>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto">
                  {validatingAddresses ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
                      <p className="text-gray-400">Validating addresses...</p>
                    </div>
                  ) : totalIssues === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                      <p className="text-xl font-semibold text-white mb-2">
                        You're all set! 🎸
                      </p>
                      <p className="text-gray-400">
                        All information needed for mileage tracking is complete.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {missingInfo.map((item, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                        >
                          <Card className={`${item.bgColor} border-white/10`}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0`}>
                                  <item.icon className={`w-5 h-5 ${item.color}`} />
                                </div>
                                <div className="flex-1">
                                  <Badge className="mb-2 bg-white/10 text-gray-300 text-xs">
                                    {item.category}
                                  </Badge>
                                  <h4 className="font-semibold text-white mb-1">
                                    {item.title}
                                  </h4>
                                  <p className="text-sm text-gray-400 mb-3">
                                    {item.description}
                                  </p>
                                  <Link to={item.link} onClick={() => setShowModal(false)}>
                                    <Button
                                      size="sm"
                                      className="bg-white/10 hover:bg-white/20 text-white"
                                    >
                                      {item.linkText}
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}