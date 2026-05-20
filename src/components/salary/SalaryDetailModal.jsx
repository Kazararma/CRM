import React, { useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, Calendar, Clock, Briefcase, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatINR } from '../../utils/formatCurrency';

/**
 * SalaryDetailModal
 * Provides a granular breakdown of a worker's accrued pay, grouped by project.
 */
const SalaryDetailModal = ({ isOpen, onClose, worker, computed, shifts }) => {
  if (!worker || !computed) return null;

  // GROUP shifts by project for the detail view
  const groupedShifts = useMemo(() => {
    const groups = {};
    shifts.forEach(s => {
      const pid = s.projectId || 'unassigned';
      if (!groups[pid]) {
        groups[pid] = {
          projectName: s.projectName || 'General Work',
          totalMinutes: 0,
          shifts: []
        };
      }
      groups[pid].totalMinutes += (Number(s.durationMinutes) || 0);
      groups[pid].shifts.push(s);
    });
    return Object.values(groups);
  }, [shifts]);

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
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-8"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-8"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-[2.5rem] bg-white p-8 text-left align-middle shadow-2xl transition-all border border-gray-100">
                
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-100">
                      {worker.displayName?.charAt(0) || '?'}
                    </div>
                    <div>
                      <Dialog.Title as="h3" className="text-2xl font-black text-gray-900 leading-none mb-1">
                        Payroll Breakdown
                      </Dialog.Title>
                      <p className="text-gray-500 text-sm font-medium">{worker.displayName} • {worker.salary?.type || 'Hourly'} Plan</p>
                    </div>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>

                {/* Main Stats */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Hours</p>
                    <p className="text-2xl font-black text-gray-900">{( (computed.baseHours || 0) + (computed.overtimeHours || 0) + (computed.grandTotalHours || 0) ).toFixed(1)} <span className="text-sm font-bold text-gray-400">hrs</span></p>
                  </div>
                  <div className="bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-100">
                    <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1 text-white/70">Amount Due</p>
                    <p className="text-2xl font-black text-white">{computed.formatted?.totalPayable}</p>
                  </div>
                </div>

                {/* Project Breakdown */}
                <div className="space-y-6">
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest px-1">Project Distribution</h4>
                  
                  {groupedShifts.length > 0 ? (
                    <div className="space-y-4">
                      {groupedShifts.map((group, idx) => (
                        <div key={idx} className="p-5 bg-white border border-gray-100 rounded-3xl hover:border-blue-200 hover:bg-blue-50/10 transition-all group">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                <Briefcase size={16} />
                              </div>
                              <span className="font-black text-gray-900">{group.projectName}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-black text-blue-600 block leading-none mb-1">
                                {formatINR((group.totalMinutes / 60) * (
                                  worker.salary?.type === 'hourly' 
                                    ? (worker.salary.hourly?.ratePerHour || 0) 
                                    : (worker.salary?.project?.baseRatePerHour || 0)
                                ))}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {(group.totalMinutes / 60).toFixed(1)} hrs
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {group.shifts.slice(0, 3).map((s, sIdx) => (
                              <div key={sIdx} className="flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-2">
                                  <Calendar size={12} />
                                  <span>{s.date ? new Date(s.date).toLocaleDateString() : 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock size={12} />
                                  <span>{(s.durationMinutes / 60).toFixed(1)} hrs</span>
                                </div>
                              </div>
                            ))}
                            {group.shifts.length > 3 && (
                              <p className="text-[10px] text-blue-500 font-bold italic mt-2">
                                + {group.shifts.length - 3} more sessions in this project
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                      <AlertCircle className="mx-auto text-gray-300 mb-2" size={32} />
                      <p className="text-sm text-gray-400 font-bold">No shifts found for this period.</p>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="mt-10 pt-8 border-t border-gray-100">
                  <p className="text-xs text-gray-400 font-medium leading-relaxed mb-6">
                    This breakdown shows all <span className="text-gray-900 font-bold">validated</span> work sessions included in the current payroll cycle. Click 'Pay Salary' on the dashboard to finalize this payment.
                  </p>
                  <button 
                    onClick={onClose}
                    className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-2"
                  >
                    CLOSE BREAKDOWN
                  </button>
                </div>

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SalaryDetailModal;
