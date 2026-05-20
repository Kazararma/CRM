import React, { useState, useMemo, useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useUsers } from "../../hooks/useUsers";
import { createProject } from "../../firebase/projectService";
import { useAuth } from "../../hooks/useAuth";
import { X, Plus, Trash2, Calculator, Info } from "lucide-react";
import { calculateLaborCost } from "../../utils/financeUtils";

const CreateProjectForm = ({ onComplete }) => {
  const { currentUser, userProfile } = useAuth();
  const { users } = useUsers();
  
  const { register, handleSubmit, setValue, watch, reset, control, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      title: "",
      notes: "",
      projectValue: 0,
      totalBilling: 0,
      amountPaid: 0,
      assignedWorkers: [],
      assignedAdmins: [],
      hourlyEstimates: {}, // Store estimates as { [uid]: hours }
      expenses: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "expenses"
  });

  const [showPreview, setShowPreview] = useState(false);

  const assignedWorkers = useWatch({ control, name: "assignedWorkers" }) || [];
  const assignedAdmins = useWatch({ control, name: "assignedAdmins" }) || [];
  const hourlyEstimates = useWatch({ control, name: "hourlyEstimates" }) || {};
  const expenses = useWatch({ control, name: "expenses" }) || [];
  
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

  const previewTotalCost = totalExpenses + previewLaborCost;

  // AUTO-ROLE RECONCILIATION
  useEffect(() => {
    if (!users || users.length === 0) return;
    let changed = false;
    let newWorkers = [...assignedWorkers];
    let newAdmins = [...assignedAdmins];

    newWorkers.forEach(uid => {
      const u = users.find(user => user.id === uid);
      const role = u?.role?.toLowerCase();
      if (role === 'admin' || role === 'super_admin') {
        newWorkers = newWorkers.filter(id => id !== uid);
        if (!newAdmins.includes(uid)) newAdmins.push(uid);
        changed = true;
      }
    });

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
        })),
        createdBy: currentUser?.uid || "unknown",
      };

      await createProject(sanitizedData, {
        uid: currentUser?.uid || "unknown",
        displayName: userProfile?.displayName || currentUser?.displayName || "Admin"
      });
      
      reset();
      onComplete();
    } catch (error) {
      console.error("Error creating project", error);
      alert("Error: " + error.message);
    }
  };

  const workers = users.filter(u => u.role?.toLowerCase() === "worker");
  const admins = users.filter(u => u.role?.toLowerCase() === "admin" || u.role?.toLowerCase() === "super_admin");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900">Create New Project</h2>
        
        {/* LIVE PREVIEW BADGE */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 bg-slate-900 px-4 py-4 md:px-6 md:py-4 rounded-2xl shadow-xl border border-slate-800 w-full lg:w-auto">
          <div className="flex flex-col gap-1 pr-0 sm:pr-6 border-b sm:border-b-0 sm:border-r border-slate-800 pb-4 sm:pb-0 w-full sm:w-auto">
            <div className="flex justify-between items-center gap-8 min-w-full sm:min-w-[140px]">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Monthly Base</span>
              <span className="text-xs font-bold text-emerald-400">
                {showPreview ? `₹${breakdown.monthlyTotal.toLocaleString('en-IN')}` : "₹ •••"}
              </span>
            </div>
            <div className="flex justify-between items-center gap-8 min-w-full sm:min-w-[140px]">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Hourly (Est)</span>
              <span className="text-xs font-bold text-blue-400">
                {showPreview ? `₹${breakdown.hourlyTotal.toLocaleString('en-IN')}` : "₹ •••"}
              </span>
            </div>
            <div className="flex justify-between items-center gap-8 min-w-full sm:min-w-[140px]">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Project Base</span>
              <span className="text-xs font-bold text-amber-400">
                {showPreview ? `₹${breakdown.projectTotal.toLocaleString('en-IN')}` : "₹ •••"}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
            <div className="flex flex-col text-right">
              <span className="text-[9px] font-black text-blue-400 uppercase leading-none mb-1 tracking-widest">Est. Deployment Cost</span>
              <span className="text-2xl font-black text-white leading-none">
                {showPreview ? `₹${previewTotalCost.toLocaleString('en-IN')}` : "₹ ••••••"}
              </span>
            </div>
            <button 
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`p-2.5 rounded-xl transition-all duration-500 relative overflow-hidden group
                ${showPreview 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_0_25px_rgba(59,130,246,0.5)] scale-110 border-t border-blue-400/40' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-blue-400 border-t border-slate-700/50'
                }`}
              title={showPreview ? "Hide Calculation" : "Calculate Deployment Cost"}
            >
              {/* Glossy Overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              
              <Calculator size={24} className="relative z-10" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Project Title</label>
            <input
              {...register("title", { required: "Title is required" })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-gray-900 transition-all placeholder:text-gray-400 shadow-sm"
              placeholder="e.g. Website Redesign"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Project Value (Client Billing) (₹)</label>
            <input
              type="number"
              min="0"
              {...register("projectValue", { min: 0 })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-blue-50/30 text-gray-900 transition-all shadow-sm font-bold"
              placeholder="Total contract value"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Project Notes</label>
            <textarea
              {...register("notes")}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none h-32 bg-white text-gray-900 transition-all placeholder:text-gray-400 shadow-sm resize-none"
              placeholder="Describe the project scope..."
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
              <label className="block text-sm font-bold text-gray-700">Assign Workers</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Hourly</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Monthly</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Project</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 bg-gray-50/50 p-4 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
              {workers.map(w => {
                const isSelected = assignedWorkers.includes(w.id);
                const sType = w.salaryType || "hourly";
                
                let colorClasses = "";
                if (isSelected) {
                  if (sType === "monthly") colorClasses = "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-emerald-100 scale-105";
                  else if (sType === "project") colorClasses = "bg-amber-600 text-white border-amber-600 hover:bg-amber-700 shadow-amber-100 scale-105";
                  else colorClasses = "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-blue-100 scale-105";
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 shadow-sm ${colorClasses}`}
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
                  <p className="text-[10px] text-blue-500 font-medium italic mt-2">
                    * Enter the estimated hours per month to include in the deployment cost.
                  </p>
                </div>
              </div>
            );
          })()}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">Assign Admins</label>
            <div className="flex flex-wrap gap-2 bg-gray-50/50 p-4 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
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
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {a.displayName}
                    {isSelected && <X size={14} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Project Expenses</h3>
          <button
            type="button"
            onClick={() => append({ name: "", amount: 0 })}
            className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all"
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
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-gray-900 text-sm transition-all"
                  placeholder="e.g. Server Hosting"
                />
              </div>
              <div className="w-32">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  {...register(`expenses.${index}.amount`, { min: 0 })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white text-gray-900 text-sm transition-all"
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
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:bg-blue-300 active:scale-95"
        >
          {isSubmitting ? "Creating..." : "Launch Project"}
        </button>
      </div>
    </form>
  );
};

export default CreateProjectForm;
