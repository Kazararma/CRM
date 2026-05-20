import React, { useState } from "react";
import { IndianRupee, Edit2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { updateProject, addBudgetLog } from "../../firebase/projectService";
import { useAuth } from "../../hooks/useAuth";

const BudgetSection = ({ project, logs, totalCost = 0, isCalculating = false }) => {
  const { currentUser, userProfile, role } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [formData, setFormData] = useState({
    totalBilling: project.totalBilling,
    amountPaid: project.amountPaid
  });
  const [submitError, setSubmitError] = useState(null);

  const isAdmin = role === "admin" || role === "super_admin";
  const progress = project.totalBilling > 0 
    ? Math.min((project.amountPaid / project.totalBilling) * 100, 100) 
    : 0;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      const fieldChanged = formData.totalBilling !== project.totalBilling ? "totalBilling" : "amountPaid";
      const previousValue = fieldChanged === "totalBilling" ? project.totalBilling : project.amountPaid;
      const newValue = Number(formData[fieldChanged]);

      if (previousValue === newValue) {
        setIsEditing(false);
        return;
      }

      await Promise.all([
        addBudgetLog(project.id, {
          changedBy: currentUser.uid,
          changedByName: userProfile.displayName,
          fieldChanged,
          previousValue,
          newValue
        }),
        updateProject(project.id, {
          [fieldChanged]: newValue
        })
      ]);

      setIsEditing(false);
    } catch (error) {
      console.error("Firebase Write Error:", error);
      setSubmitError("Failed to update budget. You may not have permission.");
    }
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <IndianRupee size={16} />
          Budget & Billing
        </h4>
        {isAdmin && !isEditing && (
          <button onClick={() => setIsEditing(true)} className="text-blue-600 hover:text-blue-700 p-1">
            <Edit2 size={16} />
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleUpdate} className="space-y-4">
          {submitError && (
            <div className="p-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
              {submitError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total Billing</label>
              <input
                type="number"
                value={formData.totalBilling}
                onChange={(e) => setFormData({ ...formData, totalBilling: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount Paid</label>
              <input
                type="number"
                value={formData.amountPaid}
                onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600">Cancel</button>
            <button type="submit" className="text-xs font-bold text-blue-600 hover:text-blue-700">Save</button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-2xl font-black text-slate-900">₹{Number(project.amountPaid || 0).toLocaleString('en-IN')}</p>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Paid out of ₹{Number(project.totalBilling || 0).toLocaleString('en-IN')}</p>
              
              {/* Reactive Admin-Only Profit Breakdown */}
              {isAdmin && (
                <div className="mt-4 space-y-1 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className="text-slate-400">Project Costs:</span>
                    <span className="text-red-500">
                      {isCalculating ? "..." : `₹${Number(totalCost).toLocaleString('en-IN')}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className="text-slate-400">Expected Profit:</span>
                    <span className="text-slate-900">
                      {isCalculating ? "..." : `₹${(Number(project.totalBilling || 0) - totalCost).toLocaleString('en-IN')}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold pt-1 border-t border-slate-200">
                    <span className="text-slate-500 uppercase tracking-tighter">Realized Profit:</span>
                    <span className={`${(Number(project.amountPaid || 0) - totalCost) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {isCalculating ? "..." : `₹${(Number(project.amountPaid || 0) - totalCost).toLocaleString('en-IN')}`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-right">
              <p className="text-lg font-bold text-blue-600">{Math.round(progress)}%</p>
              <p className="text-xs text-slate-400">Collected</p>
            </div>
          </div>
          
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-500" 
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Removed legacy profit insights block to avoid duplication */}
        </div>
      )}

      {/* Audit Logs */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <button 
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase hover:text-slate-600"
        >
          Budget Audit Trail ({logs.length})
          {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        
        {showLogs && (
          <div className="mt-3 space-y-3 max-h-32 overflow-y-auto pr-2">
            {logs.length > 0 ? logs.map(log => (
              <div key={log.id} className="text-[10px] flex justify-between gap-4">
                <span className="text-slate-500">
                  <span className="font-bold text-slate-700">{log.changedByName}</span> changed {log.fieldChanged === "totalBilling" ? "Contract" : "Paid"} from ₹{log.previousValue} to ₹{log.newValue}
                </span>
                <span className="text-slate-300 whitespace-nowrap">
                  {log.createdAt ? format(log.createdAt.toDate(), "MMM d") : "..."}
                </span>
              </div>
            )) : (
              <p className="text-[10px] text-slate-300 italic">No budget changes logged.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetSection;
