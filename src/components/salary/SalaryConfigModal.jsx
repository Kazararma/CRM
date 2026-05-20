import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, Transition } from '@headlessui/react';
import { X, Save, Briefcase, Calendar, Clock, Info } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useProjects } from '../../hooks/useProjects';

const SalaryConfigModal = ({ isOpen, onClose, worker }) => {
  const { currentUser } = useAuth();
  const { projects } = useProjects();
  
  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      type: 'hourly',
      project: {
        baseRatePerHour: 0,
        standardHoursThreshold: 160,
        overtimeRatePerHour: 0
      },
      monthly: {
        fixedMonthlySalary: 0,
        requiredWorkDays: 20,
        requiredHoursPerDay: 7
      },
      hourly: {
        ratePerHour: 0
      }
    }
  });

  const salaryType = watch('type');

  useEffect(() => {
    if (worker?.salary) {
      const s = worker.salary;
      reset({
        type: s.type || 'hourly',
        project: s.project || { baseRatePerHour: 0, standardHoursThreshold: 160, overtimeRatePerHour: 0 },
        monthly: s.monthly || { fixedMonthlySalary: 0, requiredWorkDays: 20, requiredHoursPerDay: 7 },
        hourly: s.hourly || { ratePerHour: 0 }
      });
    }
  }, [worker, reset]);

  const onSubmit = async (data) => {
    try {
      const userRef = doc(db, 'users', worker.id);
      
      const salaryPayload = {
        type: data.type,
        configuredBy: currentUser.uid,
        configuredAt: serverTimestamp(),
        isConfigured: true,
        project: data.type === 'project' ? {
          baseRatePerHour: Number(data.project.baseRatePerHour),
          standardHoursThreshold: Number(data.project.standardHoursThreshold),
          overtimeRatePerHour: Number(data.project.overtimeRatePerHour)
        } : null,
        monthly: data.type === 'monthly' ? {
          fixedMonthlySalary: Number(data.monthly.fixedMonthlySalary),
          requiredWorkDays: Number(data.monthly.requiredWorkDays),
          requiredHoursPerDay: Number(data.monthly.requiredHoursPerDay)
        } : null,
        hourly: data.type === 'hourly' ? {
          ratePerHour: Number(data.hourly.ratePerHour)
        } : null
      };

      await updateDoc(userRef, { salary: salaryPayload });
      onClose();
    } catch (error) {
      console.error("Error saving salary config:", error);
      alert("Failed to save configuration.");
    }
  };

  const assignedProjects = projects.filter(p => p.assignedWorkers?.includes(worker.id));

  // LIVE PREVIEW CALCULATION
  const projectedLiability = React.useMemo(() => {
    if (salaryType === 'monthly') return Number(watch('monthly.fixedMonthlySalary') || 0);
    if (salaryType === 'project') {
      const rate = Number(watch('project.baseRatePerHour') || 0);
      const threshold = Number(watch('project.standardHoursThreshold') || 160);
      return rate * threshold;
    }
    if (salaryType === 'hourly') {
      const rate = Number(watch('hourly.ratePerHour') || 0);
      return rate * 160; // Estimate based on standard 160h month
    }
    return 0;
  }, [salaryType, watch('monthly.fixedMonthlySalary'), watch('project.baseRatePerHour'), watch('project.standardHoursThreshold'), watch('hourly.ratePerHour')]);

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <Dialog.Title className="text-xl font-black text-gray-900 leading-none mb-1">
                      Configure Salary
                    </Dialog.Title>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{worker.displayName}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col text-right">
                      <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Projected Monthly</span>
                      <span className="text-lg font-black text-blue-600 leading-none">₹{projectedLiability.toLocaleString('en-IN')}</span>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                  {/* Type Selection */}
                  <div className="flex p-1 bg-gray-100 rounded-2xl">
                    {['hourly', 'monthly', 'project'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setValue('type', type)}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${
                          salaryType === type 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {type === 'hourly' && <Clock size={18} />}
                        {type === 'monthly' && <Calendar size={18} />}
                        {type === 'project' && <Briefcase size={18} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{type}</span>
                      </button>
                    ))}
                  </div>

                  {/* HOURLY FIELDS */}
                  {salaryType === 'hourly' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Rate Per Hour (₹)</label>
                        <input 
                          type="number"
                          min="0"
                          {...register('hourly.ratePerHour', { min: 0 })}
                          className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex gap-2 p-3 bg-blue-50 text-blue-700 rounded-xl text-xs leading-relaxed">
                        <Info size={16} className="shrink-0" />
                        <p>This rate applies to all projects this worker is assigned to. Calculations are based on validated shifts.</p>
                      </div>
                    </div>
                  )}

                  {/* MONTHLY FIELDS */}
                  {salaryType === 'monthly' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Fixed Monthly Salary (₹)</label>
                        <input 
                          type="number"
                          min="0"
                          {...register('monthly.fixedMonthlySalary', { min: 0 })}
                          className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Req. Days / Month</label>
                          <input 
                            type="number"
                            readOnly
                            {...register('monthly.requiredWorkDays')}
                            className="w-full px-4 py-3 bg-gray-100 border-none rounded-xl text-gray-500 font-bold cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Min Hrs / Day</label>
                          <input 
                            type="number"
                            step="0.5"
                            min="0"
                            {...register('monthly.requiredHoursPerDay', { min: 0 })}
                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PROJECT FIELDS */}
                  {salaryType === 'project' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Base Rate (₹/hr)</label>
                        <input 
                          type="number" 
                          min="0"
                          {...register('project.baseRatePerHour', { min: 0 })} 
                          className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 font-bold" 
                          placeholder="0.00"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Standard Hours</label>
                          <input 
                            type="number" 
                            min="0"
                            {...register('project.standardHoursThreshold', { min: 0 })} 
                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 font-bold" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">OT Rate (₹/hr)</label>
                          <input 
                            type="number" 
                            min="0"
                            {...register('project.overtimeRatePerHour', { min: 0 })} 
                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 font-bold" 
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 p-3 bg-blue-50 text-blue-700 rounded-xl text-[10px] leading-relaxed">
                        <Info size={14} className="shrink-0" />
                        <p>Hours exceeding the threshold are paid at the Overtime Rate. Standard hours are paid at the Base Rate.</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100 flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-[2] py-3 bg-blue-600 text-white text-sm font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:bg-blue-300"
                    >
                      <Save size={18} />
                      {isSubmitting ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SalaryConfigModal;
