import React from "react";
import Avatar from "../shared/Avatar";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";

const WorkerSummaryCard = ({ worker, shifts = [], onClick }) => {
  const totalMinutes = shifts.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const validatedMinutes = shifts.filter(s => s.isValidated).reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const unvalidatedCount = shifts.filter(s => !s.isValidated && s.status === "completed").length;

  const formatHours = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const calculatePaySummary = () => {
    try {
      if (worker?.salaryType === "hourly") {
        const rate = Number(worker?.hourlyRate || 0);
        const hours = validatedMinutes / 60;
        return {
          type: "Hourly",
          amount: Number((hours * rate).toFixed(2))
        };
      }
      if (worker?.salaryType === "monthly") {
        return {
          type: "Monthly",
          amount: Number(worker?.monthlySalary || 0)
        };
      }
      if (worker?.salaryType === "project") {
        const rate = Number(worker?.projectRate || 0);
        const overtimeRate = Number(worker?.projectOvertimeRate || 0);
        const standardHours = Number(worker?.projectExpectedHours || 0);
        const totalHours = validatedMinutes / 60;
        
        let pay = 0;
        if (totalHours <= standardHours) {
          pay = totalHours * rate;
        } else {
          pay = (standardHours * rate) + ((totalHours - standardHours) * overtimeRate);
        }
        
        return {
          type: "Project",
          amount: Number(pay.toFixed(2))
        };
      }
      return { type: "Not Assigned", amount: 0 };
    } catch (err) {
      console.error("Error calculating card pay summary:", err);
      return { type: "Error", amount: 0 };
    }
  };

  const payInfo = calculatePaySummary();

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-4 mb-5">
        <Avatar src={worker.photoURL} name={worker.displayName} size="lg" />
        <div>
          <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
            {worker?.displayName || "Unknown Worker"}
          </h3>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-400 capitalize">{worker?.role?.replace("_", " ") || "No Role"}</p>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <p className="text-[10px] font-bold text-blue-500 uppercase">{payInfo.type}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Total Time</p>
          <div className="flex items-center gap-1.5 text-gray-900 font-bold">
            <Clock size={14} className="text-blue-500" />
            {formatHours(totalMinutes)}
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Est. Salary</p>
          <div className="flex items-center gap-1.5 text-blue-600 font-bold">
            {typeof payInfo === 'object' && payInfo !== null
              ? Number(payInfo.amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
              : "₹0"}
          </div>
        </div>
      </div>

      {unvalidatedCount > 0 && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold">
          <AlertCircle size={14} />
          {unvalidatedCount} shifts need validation
        </div>
      )}
    </div>
  );
};

export default WorkerSummaryCard;
