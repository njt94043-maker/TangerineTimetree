
import React, { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function MiniCalendar({ bookings = [], unavailability = [] }) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

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
      setCurrentMonth(addMonths(currentMonth, 1));
    }
    if (isRightSwipe) {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const daysInMonth = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const hasBooking = (day) => {
    return bookings.some(booking => isSameDay(new Date(booking.event_date), day));
  };

  const hasUnavailability = (day) => {
    return unavailability.some(item => {
      const start = new Date(item.start_date);
      const end = new Date(item.end_date);
      return day >= start && day <= end;
    });
  };

  const handleCalendarClick = (e) => {
    // Only navigate if clicking the background, not the navigation buttons
    if (e.target.closest('button')) return;
    navigate(createPageUrl("Bookings") + `?showCalendar=true&month=${currentMonth.toISOString()}`);
  };

  return (
    <div 
      className="bg-white/5 backdrop-blur-sm border border-white/10 hover:border-green-500/50 transition-all cursor-pointer rounded-lg p-6 h-full flex flex-col"
      onClick={handleCalendarClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Month Header with Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentMonth(subMonths(currentMonth, 1));
          }}
          className="text-white hover:text-green-400 transition-colors p-2"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h3 className="text-xl font-bold text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentMonth(addMonths(currentMonth, 1));
          }}
          className="text-white hover:text-green-400 transition-colors p-2"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col">
        <div className="grid grid-cols-7 gap-2 mb-3">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
            <div key={idx} className="text-center text-sm font-semibold text-gray-400">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2 flex-1">
          {daysInMonth.map(day => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const hasEvent = hasBooking(day);
            const isUnavailable = hasUnavailability(day);
            
            return (
              <div
                key={day.toString()}
                className={`aspect-square flex items-center justify-center text-base rounded-lg transition-colors ${
                  !isCurrentMonth
                    ? 'text-gray-600'
                    : hasEvent
                    ? 'bg-green-500 text-white font-bold'
                    : isUnavailable
                    ? 'bg-red-500 text-white font-bold'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
