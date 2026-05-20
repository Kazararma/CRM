import React, { useState, useEffect } from "react";
import { useProjectLogs } from "../../hooks/useProjectLogs";
import BudgetSection from "./BudgetSection";
import StageSelector from "./StageSelector";
import WorkLogSection from "./WorkLogSection";
import MeetingLogSection from "./MeetingLogSection";
import Avatar from "../shared/Avatar";
import { ChevronDown, ChevronUp, Clock, Info, AlertCircle, Trash2 } from "lucide-react";
import { useShift } from "../../contexts/ShiftContext";
import LoadingSpinner from "../shared/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import { useUsers } from "../../hooks/useUsers";
import { useProjectFinancials } from "../../hooks/useProjectFinancials";
import { doc, updateDoc, collectionGroup, query, where, onSnapshot, writeBatch } from "firebase/firestore";
import { db } from "../../firebase/config";

const ProjectDashboardCard = ({ project }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { currentUser, userProfile, role } = useAuth();
  const { shiftState } = useShift();
  const { logs, loading } = useProjectLogs(project?.id);


  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const isAdmin = role === "admin" || role === "super_admin";

  const { liveProject, baseExpenses, totalLaborCost, grandTotal, loading: financialsLoading } = useProjectFinancials(project?.id);
  const [pendingShifts, setPendingShifts] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const { users } = useUsers();

  // Use liveProject data for reactive P&L math
  const displayProject = liveProject || project;

  // Map assigned UIDs to full user objects
  const assignedMembers = [...(displayProject.assignedWorkers || []), ...(displayProject.assignedAdmins || [])]
    .map(uid => users.find(u => u.id === uid))
    .filter(Boolean);

  const totalMembers = assignedMembers.length;

  // Listen for unvalidated shifts
  useEffect(() => {
    if (!isAdmin || !project?.id) return;

    const q = query(
      collectionGroup(db, "shifts"),
      where("projectId", "==", project.id),
      where("isValidated", "==", false),
      where("status", "in", ["completed", "expired"])
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setPendingShifts(snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() })));
    }, (error) => {
      console.error("DEBUG: ProjectDashboardCard Shift Listener Error:", error);
    });

    return () => unsubscribe();
  }, [project?.id, isAdmin]);

  const handleValidateShift = async (shift) => {
    try {
      const batch = writeBatch(db);
      batch.update(shift.ref, { isValidated: true });
      await batch.commit();
    } catch (error) {
      console.error("Validation failed", error);
    }
  };

  const handleDenyShift = async (shift) => {
    if (!window.confirm("Are you sure you want to deny and delete this work session? This cannot be undone.")) return;
    try {
      const batch = writeBatch(db);
      batch.delete(shift.ref);
      await batch.commit();
    } catch (error) {
      console.error("Denial failed", error);
    }
  };

  const handleValidateAll = async () => {
    if (pendingShifts.length === 0) return;
    setIsValidating(true);
    try {
      const batch = writeBatch(db);
      pendingShifts.forEach(shift => {
        batch.update(shift.ref, { isValidated: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Validation batch failed", error);
    } finally {
      setIsValidating(false);
    }
  };





  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${isExpanded ? 'border-blue-200' : 'border-slate-100'} overflow-hidden transition-all duration-300 mb-6`}>
      {/* Header / Summary */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50/50' : ''}`}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="hidden sm:flex -space-x-2">
            {assignedMembers.slice(0, 3).map((user, i) => (
              <div key={user.id} className="border-2 border-white rounded-full">
                <Avatar src={user.photoURL} name={user.displayName} size="sm" />
              </div>
            ))}
            {assignedMembers.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                +{assignedMembers.length - 3}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">{displayProject.title}</h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                <Clock size={12} />
                Updated {displayProject.updatedAt ? "recently" : "now"}
              </span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {displayProject.assignedWorkers?.length || 0} Workers Assigned
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:block text-right mr-4">
            <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">Progress</p>
            <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full" 
                style={{ width: `${displayProject.totalBilling > 0 ? (displayProject.amountPaid / displayProject.totalBilling) * 100 : 0}%` }}
              />
            </div>
          </div>
          {isExpanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-6 border-t border-slate-100 bg-white">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Management */}
              <div className="lg:col-span-4 space-y-8">
                <StageSelector project={displayProject} />
                {isAdmin && (
                  <BudgetSection 
                    project={displayProject} 
                    logs={logs.budgetLogs} 
                    totalCost={grandTotal}
                    isCalculating={financialsLoading}
                  />
                )}

                {isAdmin && (() => {
                  const budget = Number(displayProject.totalBilling || displayProject.projectValue || 0);
                  const amountPaid = Number(displayProject.amountPaid || 0);
                  
                  // REFACTORED: Use only reactive grandTotal from useProjectFinancials
                  const expectedProfit = budget - grandTotal;
                  const realizedProfit = amountPaid - grandTotal;

                  return (
                    <div className="space-y-4">
                      {/* Detailed Pending Worklogs List */}
                      {pendingShifts.length > 0 && (
                        <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-right-4 duration-300">
                          <div className="bg-amber-50 p-3 border-b border-amber-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                              <h4 className="text-[10px] font-black text-amber-700 uppercase">Awaiting Validation ({pendingShifts.length})</h4>
                            </div>
                            <button
                              onClick={handleValidateAll}
                              disabled={isValidating}
                              className="px-2 py-1 bg-amber-600 text-white text-[9px] font-black rounded uppercase hover:bg-amber-700 transition-colors"
                            >
                              {isValidating ? "..." : "Approve All"}
                            </button>
                          </div>

                          <div className="divide-y divide-gray-50 max-h-[250px] overflow-y-auto">
                            {pendingShifts.map((shift) => {
                              const worker = users.find(u => u.id === shift.userId);
                              return (
                                <div key={shift.id} className="p-3 hover:bg-slate-50 transition-colors group">
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center font-bold text-slate-400 border border-white overflow-hidden text-[10px]">
                                      {worker?.photoURL ? (
                                        <img src={worker.photoURL} alt={worker.displayName} className="w-full h-full object-cover" />
                                      ) : (
                                        worker?.displayName?.charAt(0) || "U"
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[11px] font-bold text-slate-900 truncate">{worker?.displayName || "Unknown User"}</span>
                                        <span className="text-[9px] font-black text-blue-600">
                                          {(shift.durationMinutes / 60).toFixed(1)}h
                                        </span>
                                      </div>
                                      <h5 className="text-[10px] font-bold text-blue-500 truncate mb-0.5">{shift.taskHeading || "No Heading"}</h5>
                                      <p className="text-[10px] text-slate-500 line-clamp-1 leading-tight">{shift.taskDescription || "No description provided."}</p>
                                      
                                      <div className="flex items-center gap-2 mt-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleDenyShift(shift)}
                                          className="text-red-500 hover:text-red-700 p-1"
                                          title="Deny"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                        <button
                                          onClick={() => handleValidateShift(shift)}
                                          className="bg-emerald-50 text-emerald-600 text-[9px] font-black px-2 py-0.5 rounded border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all"
                                        >
                                          Validate
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2">Live Financial Breakdown</h4>
                        
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">Expenses (Overhead):</span>
                          <span className="font-bold text-slate-900">
                            ₹{baseExpenses.toLocaleString('en-IN')}
                          </span>
                        </div>
                        
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">Labor Costs:</span>
                          <span className="font-bold text-slate-900">
                            ₹{totalLaborCost.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex justify-between text-sm border-t border-gray-50 pt-2 font-bold">
                          <span className="text-gray-900">Total Cost:</span>
                          <span className="text-red-500">
                            ₹{grandTotal.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex justify-between text-xs pt-1">
                          <span className="text-slate-500 font-medium">Expected Profit:</span>
                          <span className={`font-bold ${expectedProfit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                            {financialsLoading ? "..." : `₹${expectedProfit.toLocaleString('en-IN')}`}
                          </span>
                        </div>

                        <div className="flex justify-between text-xs pt-1 border-t border-gray-50">
                          <span className="text-slate-500 font-medium tracking-tight uppercase">Realized Profit:</span>
                          <span className={`font-black ${realizedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {financialsLoading ? "..." : `₹${realizedProfit.toLocaleString('en-IN')}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}






                
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <h4 className="text-[10px] font-black text-blue-600 uppercase mb-2 flex items-center gap-1">
                    <Info size={12} />
                    Project Notes
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    {project.notes || "No additional notes for this project."}
                  </p>
                </div>
              </div>

              {/* Right Column: Activity */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-l border-slate-100 pl-0 lg:pl-8">
                <WorkLogSection 
                  projectId={project.id} 
                  logs={logs.workLogs} 
                  associatedShiftId={shiftState?.shiftId} 
                />
                <MeetingLogSection projectId={project.id} logs={logs.meetingLogs} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectDashboardCard;
