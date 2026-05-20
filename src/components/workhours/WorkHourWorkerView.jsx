import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useShift } from "../../contexts/ShiftContext";
import { useShifts } from "../../hooks/useShifts";
import { useDailyLogs } from "../../hooks/useDailyLogs";
import WorkHourCalendar from "./WorkHourCalendar";
import { format } from "date-fns";
import { Clock, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import ErrorDisplay from "../shared/ErrorDisplay";
import { validateShiftsForUser } from "../../utils/shiftValidation";
import { useEffect } from "react";

const WorkHourWorkerView = () => {
  const { currentUser } = useAuth();
  const { reconciliationError } = useShift();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const { shifts, loading: shiftsLoading, error: shiftsError } = useShifts(currentUser?.uid, currentMonth);
  const { logs, loading: logsLoading, error: logsError } = useDailyLogs(currentUser?.uid, selectedDate);

  const selectedDateShifts = shifts?.filter(s => {
    let dateObj;
    if (s.startTime?.toDate) dateObj = s.startTime.toDate();
    else if (s.startTime) dateObj = new Date(s.startTime);
    else if (s.date) dateObj = new Date(s.date);
    if (!dateObj || isNaN(dateObj.getTime())) return false;
    return format(dateObj, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
  }) || [];

  // Bulletproof Force-Write validation effect
  useEffect(() => {
    if (!shifts || shifts.length === 0 || !currentUser) return;

    const runValidationScan = async () => {
      console.log("Starting Persistent Validation Scan...");
      await validateShiftsForUser(currentUser.uid, shifts);
    };

    runValidationScan();
  }, [shifts, currentUser]);

  return (
    <div className="space-y-6">
      <ErrorDisplay error={shiftsError || logsError || reconciliationError} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <WorkHourCalendar 
          shifts={shifts}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onDateClick={setSelectedDate}
          selectedDate={selectedDate}
        />
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-blue-600" />
            Shifts for {format(selectedDate, "MMM d, yyyy")}
          </h3>
          
          <div className="space-y-3">
            {shiftsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-20 bg-gray-100 rounded-xl"></div>
              </div>
            ) : selectedDateShifts?.length > 0 ? selectedDateShifts.map(shift => (
              <div key={shift.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    shift.status === "completed" ? "bg-green-100 text-green-700" : 
                    shift.status === "expired" ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {shift.status}
                  </span>
                  <span className="text-xs font-bold text-gray-500">
                    {(() => {
                      let dateObj;
                      if (shift.startTime?.toDate) dateObj = shift.startTime.toDate();
                      else if (shift.startTime) dateObj = new Date(shift.startTime);
                      
                      if (!dateObj || isNaN(dateObj.getTime())) return "--:--";
                      return format(dateObj, "hh:mm a");
                    })()}
                  </span>
                </div>
                <p className="text-lg font-black text-gray-900">
                  {shift.status === "active" 
                    ? "Active..." 
                    : `${Math.floor((shift.durationMinutes || 0) / 60)}h ${(shift.durationMinutes || 0) % 60}m`
                  }
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  {shift.isValidated === true ? (
                    <div className="flex items-center gap-1 text-green-600 font-bold">
                      <CheckCircle2 size={14} /> Validated (Work Log Found)
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600 font-bold">
                      <AlertCircle size={14} /> Unvalidated (Missing Work Log)
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-400 italic">No shifts recorded for this day.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" />
            Work Logs for {format(selectedDate, "MMM d, yyyy")}
          </h3>
          
          <div className="space-y-3">
            {logsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-10 bg-gray-100 rounded-lg"></div>
                <div className="h-10 bg-gray-100 rounded-lg"></div>
              </div>
            ) : logs?.length > 0 ? logs.map(log => (
              <div key={log.id} className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-tight">
                    {log.projectName || "Project Log"}
                  </span>
                  <span className="text-[10px] text-blue-400">
                    {(() => {
                      let dateObj;
                      if (log.createdAt?.toDate) dateObj = log.createdAt.toDate();
                      else if (log.createdAt) dateObj = new Date(log.createdAt);
                      
                      if (!dateObj || isNaN(dateObj.getTime())) return "";
                      return format(dateObj, "hh:mm a");
                    })()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-2">{log.description || log.content}</p>
              </div>
            )) : (
              <p className="text-sm text-gray-400 italic">No work logs submitted for this day.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

export default WorkHourWorkerView;
