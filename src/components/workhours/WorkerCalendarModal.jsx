import React, { useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { X, Clock, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { useShifts } from "../../hooks/useShifts";
import { useShift } from "../../contexts/ShiftContext";
import { useDailyLogs } from "../../hooks/useDailyLogs";
import WorkHourCalendar from "./WorkHourCalendar";
import { format } from "date-fns";
import Avatar from "../shared/Avatar";
import ErrorDisplay from "../shared/ErrorDisplay";

const WorkerCalendarModal = ({ isOpen, onClose, worker }) => {
  const { reconciliationError } = useShift();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const { shifts, loading: shiftsLoading, error: shiftsError } = useShifts(worker?.id, currentMonth);
  const { logs, loading: logsLoading, error: logsError } = useDailyLogs(worker?.id, selectedDate);

  const selectedDateShifts = shifts?.filter(s => {
    // Safe date parsing: handle Firestore Timestamps and raw strings
    let dateObj;
    if (s.startTime?.toDate) dateObj = s.startTime.toDate();
    else if (s.startTime) dateObj = new Date(s.startTime);
    else if (s.date) dateObj = new Date(s.date);
    
    // Check for invalid date
    if (!dateObj || isNaN(dateObj.getTime())) return false;
    
    return format(dateObj, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
  }) || [];

  if (!worker) return null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
                {/* Modal Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-4">
                    <Avatar src={worker.photoURL} name={worker.displayName} size="lg" />
                    <div>
                      <h3 className="text-xl font-black text-gray-900">{worker.displayName}</h3>
                      <p className="text-sm text-gray-500">Reviewing Work Hours & Logs</p>
                    </div>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-900">
                    <X size={24} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
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
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock size={20} className="text-blue-600" />
                        {format(selectedDate, "MMM d")} Shifts
                      </h3>
                      
                      <div className="space-y-3">
                        {shiftsLoading ? (
                          <div className="animate-pulse space-y-2">
                            <div className="h-20 bg-white rounded-xl"></div>
                          </div>
                        ) : selectedDateShifts?.length > 0 ? selectedDateShifts.map(shift => (
                          <div key={shift.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
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
                            <div className="mt-4 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs">
                                {shift.isValidated === true ? (
                                  <div className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                                    <CheckCircle2 size={14} /> Validated
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg">
                                    <AlertCircle size={14} /> Unvalidated
                                  </div>
                                )}
                              </div>

                              {shift.isValidated !== true && (
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const { doc, updateDoc } = await import("firebase/firestore");
                                      const { db } = await import("../../firebase/config");
                                      const shiftRef = doc(db, "users", worker.id, "shifts", shift.id);
                                      await updateDoc(shiftRef, { 
                                        isValidated: true,
                                        validatedAt: new Date().toISOString()
                                      });
                                    } catch (err) {
                                      console.error("Validation failed:", err);
                                      alert("Failed to validate shift.");
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-lg hover:bg-blue-700 transition-all shadow-sm shadow-blue-100"
                                >
                                  VALIDATE
                                </button>
                              )}
                            </div>
                          </div>
                        )) : (
                          <p className="text-sm text-gray-400 italic">No shifts recorded.</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-blue-600" />
                        {format(selectedDate, "MMM d")} Work Logs
                      </h3>
                      
                      <div className="space-y-3">
                        {logsLoading ? (
                          <div className="animate-pulse space-y-2">
                            <div className="h-20 bg-white rounded-lg"></div>
                          </div>
                        ) : logs?.length > 0 ? logs.map(log => (
                          <div key={log.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-blue-700 uppercase tracking-tight">
                                {log.projectName || "Project Log"}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {(() => {
                                  let dateObj;
                                  if (log.createdAt?.toDate) dateObj = log.createdAt.toDate();
                                  else if (log.createdAt) dateObj = new Date(log.createdAt);
                                  
                                  if (!dateObj || isNaN(dateObj.getTime())) return "";
                                  return format(dateObj, "hh:mm a");
                                })()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{log.description || log.content}</p>
                          </div>
                        )) : (
                          <p className="text-sm text-gray-400 italic">No work logs submitted.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default WorkerCalendarModal;
