import React from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from "date-fns";
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";

const WorkHourCalendar = ({ shifts = [], currentMonth, onMonthChange, onDateClick, selectedDate }) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getShiftsForDay = (day) => {
    return shifts.filter(shift => {
      let dateObj;
      if (shift.startTime?.toDate) dateObj = shift.startTime.toDate();
      else if (shift.startTime) dateObj = new Date(shift.startTime);
      else if (shift.date) dateObj = new Date(shift.date);

      if (!dateObj || isNaN(dateObj.getTime())) return false;
      return isSameDay(dateObj, day);
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Calendar Header */}
      <div className="p-4 md:p-6 flex items-center justify-between border-b border-gray-100">
        <h2 className="text-lg md:text-xl font-bold text-gray-900">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            className="p-1.5 md:p-2 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="p-1.5 md:p-2 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 bg-gray-50/50 border-b border-gray-100">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-2 md:py-3 text-center text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">
            <span className="hidden md:inline">{day}</span>
            <span className="md:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayShifts = getShiftsForDay(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasUnvalidatedShift = dayShifts.some(s => !s.isValidated && s.status === "completed");
          const hasValidatedShift = dayShifts.some(s => s.isValidated);

          return (
            <div
              key={day.toString()}
              onClick={() => onDateClick(day)}
              className={`min-h-[60px] md:min-h-[100px] p-1 md:p-2 border-b border-r border-gray-50 cursor-pointer transition-all hover:bg-blue-50/30 relative flex flex-col ${
                !isCurrentMonth ? "bg-gray-50/30 opacity-40" : ""
              } ${isSelected ? "bg-blue-50 ring-2 ring-inset ring-blue-500 z-10" : ""}`}
            >
              <span className={`text-xs md:text-sm font-bold ${isSelected ? "text-blue-600" : "text-gray-700"}`}>
                {format(day, "d")}
              </span>
              
              <div className="mt-1 md:mt-2 space-y-1 flex-1">
                {/* Desktop view: Show shift details */}
                <div className="hidden md:block space-y-1">
                  {dayShifts.map((shift, sIdx) => (
                    <div 
                      key={shift.id || sIdx}
                      className={`text-[9px] px-1.5 py-0.5 rounded flex items-center justify-between ${
                        shift.isValidated === true 
                          ? "bg-green-100 text-green-700" 
                          : shift.status === "completed"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      <span className="font-bold truncate">
                        {shift.durationMinutes ? `${Math.floor(shift.durationMinutes / 60)}h` : "Act"}
                      </span>
                      {shift.isValidated === true ? (
                        <CheckCircle2 size={8} strokeWidth={3} />
                      ) : shift.status === "completed" ? (
                        <AlertCircle size={8} strokeWidth={3} />
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Mobile view: Show simple indicators */}
                <div className="md:hidden flex flex-wrap gap-1 mt-auto">
                  {dayShifts.slice(0, 3).map((shift, sIdx) => (
                    <div 
                      key={shift.id || sIdx}
                      className={`w-1.5 h-1.5 rounded-full ${
                        shift.isValidated === true ? "bg-green-500" : 
                        shift.status === "completed" ? "bg-amber-500" : "bg-blue-500"
                      }`}
                    />
                  ))}
                  {dayShifts.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkHourCalendar;
