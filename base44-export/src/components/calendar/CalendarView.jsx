
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isAfter, startOfWeek, endOfWeek, getDay, isFriday, isSaturday, isSunday } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Clock, Trash2, Pencil, PoundSterling, Navigation, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function CalendarView({ bookings, onEdit, onDelete, onEventClick, onCreateForDate, initialMonth }) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth || new Date());
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Update current month if initialMonth prop changes
  useEffect(() => {
    if (initialMonth) {
      setCurrentMonth(initialMonth);
    }
  }, [initialMonth]);

  const { data: unavailability = [] } = useQuery({
    queryKey: ['unavailability'],
    queryFn: () => base44.entities.Unavailability.list('-start_date'),
    initialData: [],
  });

  // Fetch all gigs to filter out rehearsals
  const { data: allGigs = [] } = useQuery({
    queryKey: ['gigs-calendar'],
    queryFn: () => base44.entities.Gig.list('date'),
    initialData: [],
  });

  // Filter only rehearsals from all gigs
  const rehearsals = allGigs.filter(gig => gig.type === 'rehearsal');

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      // Swipe left = next month
      setCurrentMonth(addMonths(currentMonth, 1));
    }
    if (isRightSwipe) {
      // Swipe right = previous month
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  // Set week start to Monday (weekStartsOn: 1)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const daysInMonth = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day) => {
    const dayBookings = bookings.filter(booking => isSameDay(new Date(booking.event_date), day));
    const dayRehearsals = rehearsals.filter(rehearsal => isSameDay(new Date(rehearsal.date), day));
    const dayUnavailability = unavailability.filter(item => {
      const start = new Date(item.start_date);
      const end = new Date(item.end_date);
      // Ensure day is within the unavailability period (inclusive start and end)
      return day >= start && day <= end;
    });
    
    return { bookings: dayBookings, rehearsals: dayRehearsals, unavailability: dayUnavailability };
  };

  const eventTypeColors = {
    wedding: "bg-pink-500/20 text-pink-400 border-pink-500/50",
    corporate: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    pub_gig: "bg-green-500/20 text-green-400 border-green-500/50",
    festival: "bg-orange-500/20 text-orange-400 border-orange-500/50",
    private_party: "bg-purple-500/20 text-purple-400 border-purple-500/50",
    other: "bg-gray-500/20 text-gray-400 border-gray-500/50"
  };

  // Modified to auto-fill client name for non-gig/festival events
  const getDisplayText = (booking) => {
    if (booking.event_type === 'pub_gig' || booking.event_type === 'festival') {
      return booking.venue_name;
    }
    // For other event types, use client_name if available, otherwise event_type
    if (booking.client_name) {
      return booking.client_name;
    }
    return booking.event_type.replace('_', ' ');
  };

  const openInMaps = (address) => {
    const encodedAddress = encodeURIComponent(address);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(mapsUrl, '_blank');
  };

  // Get mobile calendar data organized by week
  const getMobileCalendarWeeks = () => {
    // Get all days within the current month
    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const weeks = [];
    let currentWeekSegment = [];

    allDaysInMonth.forEach(day => {
      // getDay() returns 0 for Sunday, 1 for Monday, ..., 6 for Saturday
      const dayOfWeek = getDay(day);

      // Start a new logical week segment if it's Monday and the current segment is not empty
      if (dayOfWeek === 1 && currentWeekSegment.length > 0) {
        weeks.push(currentWeekSegment);
        currentWeekSegment = [];
      }
      currentWeekSegment.push(day);
    });
    // Push the last segment if it's not empty
    if (currentWeekSegment.length > 0) {
      weeks.push(currentWeekSegment);
    }

    return weeks.map(weekSegment => {
      const weekDaysForMobile = [];
      let hasWeekdayBooking = false;
      let firstBookedWeekday = null; // Store the first found weekday with a booking

      const weekendDaysInSegment = [];
      const weekdaysMonToThuInSegment = [];

      weekSegment.forEach(day => {
        const dayOfWeek = getDay(day);
        if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) { // Friday (5), Saturday (6), Sunday (0)
          weekendDaysInSegment.push(day);
        } else if (dayOfWeek >= 1 && dayOfWeek <= 4) { // Monday (1) to Thursday (4)
          weekdaysMonToThuInSegment.push(day);
        }
      });

      // Check for weekday bookings (Mon-Thu) or rehearsals
      for (const day of weekdaysMonToThuInSegment) {
        const { bookings: dayBookings, rehearsals: dayRehearsals } = getEventsForDay(day);
        if (dayBookings.length > 0 || dayRehearsals.length > 0) {
          hasWeekdayBooking = true;
          firstBookedWeekday = day; // Keep the first one found
          break; // Only need one weekday with an event for the "add to start" rule
        }
      }

      // If a weekday has a booking or rehearsal, prepend it
      if (hasWeekdayBooking && firstBookedWeekday) {
        weekDaysForMobile.push(firstBookedWeekday);
      }
      // Add weekend days (Friday, Saturday, Sunday)
      weekDaysForMobile.push(...weekendDaysInSegment);

      // Sort the collected days to ensure they appear in chronological order
      // (e.g., if a booked Monday is prepended to a Friday-Sunday sequence)
      weekDaysForMobile.sort((a, b) => a.getTime() - b.getTime());

      return {
        days: weekDaysForMobile,
        hasWeekdayBooking
      };
    }).filter(week => week.days.length > 0); // Only include weeks that contain days
  };

  const calendarWeeks = getMobileCalendarWeeks();

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="text-white hover:bg-white/10 min-h-[44px] min-w-[44px] flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <CardTitle className="text-lg sm:text-xl md:text-2xl text-white text-center flex-1 px-2">
              {format(currentMonth, 'MMMM yyyy')}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="text-white hover:bg-white/10 min-h-[44px] min-w-[44px] flex-shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Calendar Grid */}
          <div className="hidden md:grid grid-cols-7 gap-2">
            {/* Updated day headers to start from Monday */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-gray-400 py-2">
                {day}
              </div>
            ))}
            {daysInMonth.map(day => {
              const { bookings: dayBookings, rehearsals: dayRehearsals, unavailability: dayUnavailability } = getEventsForDay(day);
              const hasEvents = dayBookings.length > 0 || dayRehearsals.length > 0 || dayUnavailability.length > 0;
              
              return (
                <div
                  key={day.toString()}
                  className={`min-h-24 p-2 rounded-lg border transition-all ${
                    isSameMonth(day, currentMonth)
                      ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-green-500/30 cursor-pointer'
                      : 'bg-white/2 border-white/5 opacity-50'
                  }`}
                  onClick={() => {
                    if (isSameMonth(day, currentMonth) && !hasEvents) {
                      onCreateForDate(format(day, 'yyyy-MM-dd'));
                    }
                  }}
                >
                  <div className="text-sm font-medium text-gray-300 mb-1">
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayBookings.map(booking => (
                      <div
                        key={booking.id}
                        className={`text-xs p-1 rounded border ${eventTypeColors[booking.event_type]} cursor-pointer hover:opacity-80 transition-opacity`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(booking);
                        }}
                      >
                        {getDisplayText(booking)}
                      </div>
                    ))}
                    {dayRehearsals.map(rehearsal => (
                      <div
                        key={`rehearsal-${rehearsal.id}`}
                        className="text-xs p-1 rounded border bg-cyan-500/20 text-cyan-400 border-cyan-500/50 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                        title={`${rehearsal.venue} - ${rehearsal.time}`}
                      >
                        🎸 {rehearsal.venue} {rehearsal.time ? `- ${rehearsal.time}` : ''}
                      </div>
                    ))}
                    {dayUnavailability.map(item => (
                      <div
                        key={item.id}
                        className="text-xs p-1 rounded border bg-red-500/20 text-red-400 border-red-500/50 flex items-center gap-1"
                        title={`${item.member_name} unavailable`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Users className="w-3 h-3" />
                        {item.member_name.split(' ')[0]}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Weekend Calendar with Swipe Support */}
          <div 
            className="md:hidden space-y-2"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="text-center text-xs text-gray-400 mb-3">
              <span>Swipe or use arrows to change month</span>
            </div>
            {calendarWeeks.map((week, weekIdx) => (
              <div 
                key={weekIdx} 
                className={`grid gap-2 ${week.hasWeekdayBooking ? 'grid-cols-4' : 'grid-cols-3'}`}
              >
                {week.days.map(day => {
                  const { bookings: dayBookings, rehearsals: dayRehearsals, unavailability: dayUnavailability } = getEventsForDay(day);
                  const dayOfWeek = getDay(day);
                  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0; // Fri, Sat, Sun
                  const hasBooking = dayBookings.length > 0;
                  const hasRehearsal = dayRehearsals.length > 0;
                  const hasUnavailability = dayUnavailability.length > 0;
                  
                  return (
                    <div
                      key={day.toString()}
                      className={`p-2 rounded-lg border min-h-[100px] ${
                        hasBooking
                          ? 'bg-green-500/10 border-green-500/50'
                          : hasRehearsal
                          ? 'bg-cyan-500/10 border-cyan-500/50'
                          : hasUnavailability
                          ? 'bg-red-500/10 border-red-500/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer active:bg-white/15'
                      }`}
                      onClick={() => {
                        if (!hasBooking && !hasRehearsal && !hasUnavailability) {
                          onCreateForDate(format(day, 'yyyy-MM-dd'));
                        }
                      }}
                    >
                      <div className="text-center mb-2">
                        <div className="text-[10px] text-gray-400 font-medium">{format(day, 'EEE')}</div>
                        <div className="font-bold text-white text-xl">{format(day, 'd')}</div>
                      </div>
                      
                      {hasBooking && (
                        <div className="space-y-1">
                          {dayBookings.map(booking => (
                            <div
                              key={booking.id}
                              className="text-[10px] p-1.5 rounded bg-green-500/20 text-green-400 cursor-pointer hover:bg-green-500/30 transition-colors active:bg-green-500/40"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick(booking);
                              }}
                            >
                              <div className="font-medium truncate leading-tight">{getDisplayText(booking)}</div>
                              {booking.event_time && (
                                <div className="text-[9px] text-gray-400 mt-0.5">{booking.event_time}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {hasRehearsal && (
                        <div className={`space-y-1 ${hasBooking ? 'mt-1' : ''}`}>
                          {dayRehearsals.map(rehearsal => (
                            <div
                              key={`rehearsal-${rehearsal.id}`}
                              className="text-[10px] p-1.5 rounded bg-cyan-500/20 text-cyan-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="font-medium truncate leading-tight">🎸 {rehearsal.venue}</div>
                              {rehearsal.time && (
                                <div className="text-[9px] text-gray-400 mt-0.5">{rehearsal.time}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {hasUnavailability && (
                        <div className={`space-y-1 ${hasBooking || hasRehearsal ? 'mt-1' : ''}`}>
                          {dayUnavailability.map(item => (
                            <div
                              key={item.id}
                              className="text-[9px] p-1 rounded bg-red-500/20 text-red-400 flex items-center gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Users className="w-2 h-2" />
                              <span className="truncate">{item.member_name.split(' ')[0]}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!hasBooking && !hasRehearsal && !hasUnavailability && (
                        <div className="text-center text-[10px] text-gray-500 mt-2">
                          Tap to add
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
