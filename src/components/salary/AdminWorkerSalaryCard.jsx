import React, { useMemo } from 'react';
import { Settings, Send, History, AlertTriangle, CheckCircle2, MoreHorizontal } from 'lucide-react';
import Avatar from '../shared/Avatar';
import Badge from '../shared/Badge';
import { useWorkerShifts } from '../../hooks/useWorkerShifts';
import { computeProjectSalary, computeMonthlySalary, computeHourlySalary, normalizeSalaryConfig } from '../../utils/salaryEngine';
import { formatINR } from '../../utils/formatCurrency';
import { SalaryTypeBadge, PaymentStatusChip } from './SalaryUI';

const AdminWorkerSalaryCard = ({ worker, activeTransaction, onPay, onConfigure, onViewBreakdown }) => {
  const { shifts, loading } = useWorkerShifts(worker.id);
  const salary = useMemo(() => normalizeSalaryConfig(worker), [worker]);
  const isConfigured = salary?.isConfigured;

  // COMPUTE SALARY LIVE
  const computed = useMemo(() => {
    const validatedShifts = shifts.filter(s => s.isValidated === true);
    if (!isConfigured || !validatedShifts.length) return { totalPayable: 0, formatted: { totalPayable: formatINR(0) } };
    
    if (salary.type === 'project') return computeProjectSalary(salary.project, validatedShifts);
    if (salary.type === 'monthly') return computeMonthlySalary(salary.monthly, validatedShifts);
    if (salary.type === 'hourly') return computeHourlySalary(salary.hourly, validatedShifts);
    
    return { totalPayable: 0, formatted: { totalPayable: formatINR(0) } };
  }, [salary, shifts, isConfigured]);

  const pendingCount = shifts.filter(s => s.isValidated !== true).length;

  const handlePayClick = () => {
    if (!isConfigured) return;
    
    // If we are re-issuing a disputed payment, we use the disputed transaction's data
    if (activeTransaction?.status === 'DISPUTED') {
      const reIssueData = {
        totalPayable: activeTransaction.amountPaid,
        totalHours: activeTransaction.hoursLogged,
        basePay: activeTransaction.breakdown?.basePay,
        overtimeHours: activeTransaction.breakdown?.overtimeHours,
        overtimePay: activeTransaction.breakdown?.overtimePay,
        formatted: {
          totalPayable: formatINR(activeTransaction.amountPaid)
        }
      };
      onPay(worker, reIssueData, []); // No new shifts to mark as paid
      return;
    }

    if (activeTransaction) return;
    onPay(worker, computed, shifts);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-5 border-b border-gray-50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar src={worker.photoURL} name={worker.displayName} size="md" />
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{worker.displayName}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge type={worker.role}>{worker.role}</Badge>
              {worker.jobTitle && (
                <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-tight">
                  {worker.jobTitle}
                </span>
              )}
              {isConfigured && <SalaryTypeBadge type={salary.type} />}
            </div>
          </div>
        </div>
        <button 
          onClick={() => onConfigure(worker)}
          className="p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600 rounded-xl transition-all"
          title="Configure Salary"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 flex-1 bg-gray-50/30">
        {!isConfigured ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-3">
              <AlertTriangle size={24} />
            </div>
            <p className="text-sm font-bold text-gray-500">Salary Not Configured</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[180px]">Set up a payment model to start tracking payroll.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Conditional Rendering based on Salary Type */}
            {salary.type === 'project' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Payment Model</span>
                  <span className="text-gray-900 font-bold italic">Hours-Based Project</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Standard Hours</span>
                  <span className="text-gray-900 font-bold">{salary.project.standardHoursThreshold} hrs</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Base Rate</span>
                  <span className="text-gray-900 font-bold">{formatINR(salary.project.baseRatePerHour)} / hr</span>
                </div>
                <div className="h-px bg-gray-100 my-2"></div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Base Pay ({computed.baseHours} hrs)</span>
                  <span className="text-gray-900 font-black">{computed.formatted.basePay}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Overtime ({computed.overtimeHours} hrs)</span>
                  <span className={`font-black ${computed.overtimePay > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{computed.formatted.overtimePay}</span>
                </div>
              </div>
            )}

            {salary.type === 'monthly' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Monthly Cycle</span>
                  <span className="text-gray-900 font-bold">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Work Threshold</span>
                  <span className="text-gray-900 font-bold">{computed.qualifyingDays} / 20 Days</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Status</span>
                  <span className={`font-black ${computed.isEligible ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {computed.isEligible ? 'ELIGIBLE' : 'IN PROGRESS'}
                  </span>
                </div>
                <div className="h-px bg-gray-100 my-2"></div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Accrued Payout</span>
                  <span className="text-gray-900 font-black">{computed.formatted.amountPayable}</span>
                </div>
              </div>
            )}

            {salary.type === 'hourly' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Hourly Rate</span>
                  <span className="text-gray-900 font-bold">{formatINR(salary.hourly.ratePerHour)} / hr</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Total Validated</span>
                  <span className="text-gray-900 font-bold">{computed.grandTotalHours} hrs</span>
                </div>
                <div className="h-px bg-gray-100 my-2"></div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Total Accrued</span>
                  <span className="text-gray-900 font-black">{computed.formatted.grandTotalPayable}</span>
                </div>
              </div>
            )}

            {/* Total Display */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Total Due</span>
                <span className="text-2xl font-black text-gray-900 leading-none">{computed.formatted.totalPayable}</span>
              </div>
              
              {pendingCount > 0 && (
                <div className="mt-3 p-2 bg-amber-50 rounded-lg flex items-center gap-2 border border-amber-100">
                  <MoreHorizontal size={14} className="text-amber-600" />
                  <span className="text-[10px] font-bold text-amber-700">
                    {pendingCount} shifts pending validation
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Handshake Actions */}
      <div className="p-4 bg-white border-t border-gray-50">
        {!isConfigured ? (
          <button 
            onClick={() => onConfigure(worker)}
            className="w-full py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
          >
            CONFIGURE SALARY
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            {activeTransaction ? (
              <div className="space-y-3">
                <PaymentStatusChip status={activeTransaction.status} />
                {activeTransaction.status === 'DISPUTED' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => onViewBreakdown(worker, computed, shifts)}
                      className="py-2.5 bg-gray-50 text-gray-900 text-xs font-black rounded-xl hover:bg-gray-100 transition-all border border-gray-100"
                    >
                      BREAKDOWN
                    </button>
                    <button 
                      onClick={handlePayClick}
                      className="py-2.5 bg-red-600 text-white text-xs font-black rounded-xl hover:bg-red-700 transition-all shadow-md shadow-red-100 flex items-center justify-center gap-2"
                    >
                      RE-ISSUE
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="text-[10px] text-center text-gray-400 font-bold animate-pulse">
                      Waiting for worker to confirm...
                    </div>
                    <button 
                      onClick={() => onViewBreakdown(worker, computed, shifts)}
                      className="w-full py-2 bg-gray-50 text-gray-600 text-[10px] font-black rounded-lg hover:bg-gray-100 transition-all uppercase tracking-widest"
                    >
                      View Details
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => onViewBreakdown(worker, computed, shifts)}
                  className="py-2.5 bg-gray-50 text-gray-900 text-xs font-black rounded-xl hover:bg-gray-100 transition-all border border-gray-100"
                >
                  BREAKDOWN
                </button>
                <button 
                  onClick={handlePayClick}
                  disabled={loading || computed.totalPayable <= 0}
                  className={`py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none`}
                >
                  <Send size={14} /> PAY
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWorkerSalaryCard;
