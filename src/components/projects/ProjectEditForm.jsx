import React, { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useUsers } from "../../hooks/useUsers";
import { updateProject } from "../../firebase/projectService";
import { X, Plus, Trash2, Calculator, Info } from "lucide-react";
import { query, collectionGroup, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/config";
import { calculateLaborCost } from "../../utils/financeUtils";

const ProjectEditForm = ({ project, onComplete, onLivePreview }) => {
  const { users } = useUsers();
  const [validatedShifts, setValidatedShifts] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  
  const { register, handleSubmit, setValue, watch, control, formState: { isSubmitting } } = useForm({
    defaultValues: {
      title: project.title,
      notes: project.notes,
      projectValue: project.projectValue || 0,
      totalBilling: project.totalBilling,
      amountPaid: project.amountPaid,
      assignedWorkers: project.assignedWorkers || [],
      assignedAdmins: project.assignedAdmins || [],
      hourlyEstimates: project.hourlyEstimates || {},
      expenses: project.expenses || []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "expenses"
  });

  // REAL-TIME SHIFT LISTENER for Live Preview
  useEffect(() => {
    if (!project?.id) return;
    const q = query(
      collectionGroup(db, "shifts"),
      where("projectId", "==", project.id),
      where("isValidated", "==", true)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setValidatedShifts(snap.docs.map(d => d.data()));
    });
    return () => unsubscribe();
  }, [project?.id]);

  const assignedWorkers = useWatch({ control, name: "assignedWorkers" }) || [];
  const assignedAdmins = useWatch({ control, name: "assignedAdmins" }) || [];
  const hourlyEstimates = useWatch({ control, name: "hourlyEstimates" }) || {};
  const expenses = useWatch({ control, name: "expenses" }) || [];

  // AUTO-ROLE RECONCILIATION
  // If a worker was promoted to admin (or vice versa) while assigned to this project,
  // we move them to the correct bucket automatically.
  useEffect(() => {
    if (!users || users.length === 0) return;

    let changed = false;
    let newWorkers = [...assignedWorkers];
    let newAdmins = [...assignedAdmins];

    // Check workers who might have become admins
    newWorkers.forEach(uid => {
      const u = users.find(user => user.id === uid);
      const role = u?.role?.toLowerCase();
      if (role === 'admin' || role === 'super_admin') {
        newWorkers = newWorkers.filter(id => id !== uid);
        if (!newAdmins.includes(uid)) newAdmins.push(uid);
        changed = true;
      }
    });

    // Check admins who might have become workers
    newAdmins.forEach(uid => {
      const u = users.find(user => user.id === uid);
      const role = u?.role?.toLowerCase();
      if (role === 'worker') {
        newAdmins = newAdmins.filter(id => id !== uid);
        if (!newWorkers.includes(uid)) newWorkers.push(uid);
        changed = true;
      }
    });

    if (changed) {
      setValue("assignedWorkers", newWorkers);
      setValue("assignedAdmins", newAdmins);
    }
  }, [users, assignedWorkers, assignedAdmins, setValue]);
  
  // LIVE PREVIEW CALCULATIONS
  const totalExpenses = useMemo(() => 
    expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)
  , [expenses]);

  const { previewLaborCost, breakdown } = useMemo(() => {
    const allAssigned = [...assignedWorkers, ...assignedAdmins];
    
    // Calculate individual components for breakdown
    const monthlyTotal = allAssigned.reduce((sum, uid) => {
      const u = users.find(user => user.id === uid);
      if ((u?.salaryType || u?.salary?.type) === 'monthly') {
        return sum + Number(u.salary?.monthly?.fixedMonthlySalary || u.monthlySalary || 0);
      }
      return sum;
    }, 0);

    const projectTotal = allAssigned.reduce((sum, uid) => {
      const u = users.find(user => user.id === uid);
      if ((u?.salaryType || u?.salary?.type) === 'project') {
        const rate = Number(u.salary?.project?.baseRatePerHour || u.projectRate || 0);
        const threshold = Number(u.salary?.project?.standardHoursThreshold || u.projectExpectedHours || 160);
        return sum + (rate * threshold);
      }
      return sum;
    }, 0);

    const hourlyTotal = allAssigned.reduce((sum, uid) => {
      const u = users.find(user => user.id === uid);
      if ((u?.salaryType || u?.salary?.type) === 'hourly') {
        const rate = Number(u.salary?.hourly?.ratePerHour || u.hourlyRate || 0);
        const est = Number(hourlyEstimates[uid] || 0);
        return sum + (rate * est);
      }
      return sum;
    }, 0);

    return {
      previewLaborCost: monthlyTotal + projectTotal + hourlyTotal,
      breakdown: { monthlyTotal, projectTotal, hourlyTotal }
    };
  }, [assignedWorkers, assignedAdmins, users, hourlyEstimates]);

  const incurredLaborCost = useMemo(() => {
    const allAssigned = [...assignedWorkers, ...assignedAdmins];
    return calculateLaborCost(allAssigned, validatedShifts, users);
  }, [assignedWorkers, assignedAdmins, validatedShifts, users]);

  const previewTotalCost = totalExpenses + incurredLaborCost;

  // Sync real-time estimates up to the Admin Card's header
  useEffect(() => {
    if (onLivePreview) {
      onLivePreview({
        baseExpenses: totalExpenses,
        // When in 'pending' state, use the deployment estimate because there are no shifts yet.
        // Otherwise use incurred labor.
        laborCost: project.status === 'pending' ? previewLaborCost : incurredLaborCost,
        grandTotal: totalExpenses + (project.status === 'pending' ? previewLaborCost : incurredLaborCost)
      });
    }
  }, [totalExpenses, previewLaborCost, incurredLaborCost, project.status, onLivePreview]);

  const toggleWorker = (uid) => {
    if (assignedWorkers.includes(uid)) {
      setValue("assignedWorkers", assignedWorkers.filter(id => id !== uid), { shouldDirty: true });
    } else {
      setValue("assignedWorkers", [...assignedWorkers, uid], { shouldDirty: true });
      // Mutual Exclusivity: Remove from admins if present
      if (assignedAdmins.includes(uid)) {
        setValue("assignedAdmins", assignedAdmins.filter(id => id !== uid), { shouldDirty: true });
      }
    }
  };

  const toggleAdmin = (uid) => {
    if (assignedAdmins.includes(uid)) {
      setValue("assignedAdmins", assignedAdmins.filter(id => id !== uid), { shouldDirty: true });
    } else {
      setValue("assignedAdmins", [...assignedAdmins, uid], { shouldDirty: true });
      // Mutual Exclusivity: Remove from workers if present
      if (assignedWorkers.includes(uid)) {
        setValue("assignedWorkers", assignedWorkers.filter(id => id !== uid), { shouldDirty: true });
      }
    }
  };

  const onSubmit = async (data) => {
    try {
      const sanitizedData = {
        title: data.title || "",
        notes: data.notes || "",
        assignedWorkers: assignedWorkers || [],
        assignedAdmins: assignedAdmins || [],
        hourlyEstimates: hourlyEstimates || {},
        projectValue: Number(data.projectValue) || 0,
        totalBilling: Number(data.totalBilling) || 0,
        amountPaid: Number(data.amountPaid) || 0,
        expenses: (data.expenses || []).map(exp => ({
          name: exp.name || "Unnamed Expense",
          amount: Number(exp.amount) || 0
        }))
      };
      await updateProject(project.id, sanitizedData);
      onComplete();
    } catch (error) {
      console.error("Error updating project", error);
    }
  };

  const workers = users.filter(u => u.role?.toLowerCase() === "worker");
  const admins = users.filter(u => u.role?.toLowerCase() === "admin" || u.role?.toLowerCase() === "super_admin");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
      
      {/* LIVE PREVIEW BAR */}
      <div className="mb-8 flex flex-col sm:flex-row flex-wrap gap-4 md:gap-6 bg-slate-900 p-4 md:p-5 rounded-xl shadow-xl border border-slate-800 animate-in fade-in slide-in-from-top-4 duration-500 items-start sm:items-center">
        <button 
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all duration-500 relative overflow-hidden group w-full sm:w-auto
            ${showPreview 
              ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-100 sm:scale-105 border-t border-blue-400/30' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-blue-400 border-t border-slate-700/50'
            }`}
        >
          {/* Glossy Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <Calculator size={18} className="relative z-10" />
          <span className="text-[10px] font-black uppercase tracking-wider relative z-10">{showPreview ? "Hide Budget" : "Show Budget"}</span>
        </button>
        
        {showPreview ? (
          <div className="flex flex-wrap items-center gap-6 w-full sm:w-auto">
            <div className="flex flex-col border-r border-slate-800 pr-4 animate-in slide-in-from-left-4 duration-300">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Monthly Deployment</span>
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 uppercase">Fixed</span>
                  <span className="text-xs font-bold text-emerald-400">₹{breakdown.monthlyTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 uppercase">Hourly</span>
                  <span className="text-xs font-bold text-blue-400">₹{breakdown.hourlyTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 uppercase">Project</span>
                  <span className="text-xs font-bold text-amber-400">₹{breakdown.projectTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex flex-col animate-in slide-in-from-left-4 duration-500">
                <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Incurred Labor</span>
                <span className="text-sm font-black text-white">₹{incurredLaborCost.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex flex-col animate-in slide-in-from-left-4 duration-700">
                <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Expenses</span>
                <span className="text-sm font-black text-white">₹{totalExpenses.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="flex flex-col ml-0 sm:ml-auto text-left sm:text-right animate-in slide-in-from-right-4 duration-300 w-full sm:w-auto border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
              <span className="text-[8px] font-black text-blue-400 uppercase mb-1 tracking-widest">Total Life-Cost</span>
              <span className="text-xl font-black text-white">₹{previewTotalCost.toLocaleString('en-IN')}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-2">
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] animate-pulse italic text-center px-4">
              Reveal project budget projections
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Project Title</label>
            <input
              {...register("title", { required: true })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-gray-900 transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Project Value (Client Billing) (₹)</label>
            <input
              type="number"
              min="0"
              {...register("projectValue", { min: 0 })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-blue-50/30 text-gray-900 transition-all shadow-sm font-bold"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Project Notes</label>
            <textarea
              {...register("notes")}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none h-32 bg-white text-gray-900 transition-all shadow-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Total Billing (₹)</label>
              <input
                type="number"
                min="0"
                {...register("totalBilling", { min: 0 })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-gray-900 transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Amount Paid (₹)</label>
              <input
                type="number"
                min="0"
                {...register("amountPaid", { min: 0 })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-gray-900 transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-gray-700 flex items-center gap-2">
                Assign Workers
                <div className="group relative">
                  <Info size={14} className="text-gray-400 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl z-20">
                    Toggling workers will instantly update the Budget Preview above.
                  </div>
                </div>
              </label>
            </div>
            <div className="flex flex-wrap gap-2 bg-white p-4 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
              {workers.map(w => {
                const isSelected = assignedWorkers.includes(w.id);
                const sType = w.salaryType || "hourly";

                let colorClasses = "";
                if (isSelected) {
                  if (sType === "monthly") colorClasses = "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-emerald-100";
                  else if (sType === "project") colorClasses = "bg-amber-600 text-white border-amber-600 hover:bg-amber-700 shadow-amber-100";
                  else colorClasses = "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-blue-100";
                } else {
                  if (sType === "monthly") colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100";
                  else if (sType === "project") colorClasses = "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100";
                  else colorClasses = "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100";
                }

                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWorker(w.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 shadow-sm ${colorClasses} ${isSelected ? 'scale-105' : 'hover:scale-102'}`}
                  >
                    {w.displayName}
                    {isSelected && <X size={14} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* HOURLY ESTIMATES INPUTS */}
          {(() => {
            const selectedHourly = [...assignedWorkers, ...assignedAdmins].filter(uid => {
              const u = users.find(user => user.id === uid);
              return (u?.salaryType || u?.salary?.type) === 'hourly';
            });

            if (selectedHourly.length === 0) return null;

            return (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                  <h3 className="text-sm font-bold text-gray-900">Estimated Hours (Hourly Staff)</h3>
                </div>
                <div className="bg-blue-50/50 rounded-2xl border border-blue-100 p-4 space-y-3">
                  {selectedHourly.map(uid => {
                    const u = users.find(user => user.id === uid);
                    const rate = u.salary?.hourly?.ratePerHour || u.hourlyRate || 0;
                    return (
                      <div key={uid} className="flex items-center justify-between gap-4 bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-900">{u.displayName}</span>
                          <span className="text-[10px] font-medium text-gray-400">Rate: ₹{rate}/hr</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            placeholder="Hours"
                            {...register(`hourlyEstimates.${uid}`, { min: 0 })}
                            className="w-20 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-right"
                          />
                          <span className="text-[10px] font-black text-gray-400 uppercase">Hrs</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">Assign Admins</label>
            <div className="flex flex-wrap gap-2 bg-white p-4 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
              {admins.map(a => {
                const isSelected = assignedAdmins.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAdmin(a.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 ${
                      isSelected 
                        ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700 shadow-purple-100 scale-105" 
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {a.displayName}
                    {isSelected && <X size={14} strokeWidth={3} />}
                  </button>
                );
              })}
              {admins.length === 0 && <span className="text-sm text-gray-400 italic">No admins available.</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Section */}
      <div className="mt-8 pt-8 border-t border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-700">Project Expenses</h3>
          <button
            type="button"
            onClick={() => append({ name: "", amount: 0 })}
            className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-all"
          >
            <Plus size={14} /> Add Expense
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Expense Name</label>
                <input
                  {...register(`expenses.${index}.name`)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-gray-900 text-sm transition-all shadow-sm"
                  placeholder="e.g. Server Hosting"
                />
              </div>
              <div className="w-32">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  {...register(`expenses.${index}.amount`, { min: 0 })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-gray-900 text-sm transition-all shadow-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          {fields.length === 0 && (
            <div className="text-center py-4 border-2 border-dashed border-gray-100 rounded-xl">
              <p className="text-sm text-gray-400">No expenses added yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
        <div className="hidden md:block">
          <p className="text-xs text-gray-400 font-medium italic">* Changes are not finalized until you click Save Changes.</p>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full md:w-auto bg-blue-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:bg-blue-300 active:scale-95"
        >
          {isSubmitting ? "Finalizing Changes..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
};

export default ProjectEditForm;
