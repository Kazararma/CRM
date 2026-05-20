import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useWorkerSalaryView } from '../../hooks/useWorkerSalaryView';
import { confirmSalaryReceived, disputePayment } from '../../services/salaryService';
import { 
  computeProjectSalary, 
  computeMonthlySalary, 
  computeHourlySalary,
  normalizeSalaryConfig 
} from '../../utils/salaryEngine';
import { formatINR } from '../../utils/formatCurrency';
import PendingPaymentBanner from '../../components/salary/PendingPaymentBanner';
import PaymentHistoryList from '../../components/salary/PaymentHistoryList';
import DisputeModal from '../../components/salary/DisputeModal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { SalaryTypeBadge } from '../../components/salary/SalaryUI';
import { Wallet, Info, ArrowUpRight, TrendingUp, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

const SalaryWorkerView = () => {
  const { currentUser } = useAuth();
  const { salaryConfig, transactions, shifts, activeTransaction, loading } = useWorkerSalaryView(currentUser.uid);
  const [selectedTxForDispute, setSelectedTxForDispute] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const normalizedSalary = useMemo(() => normalizeSalaryConfig({ ...currentUser, salary: salaryConfig }), [currentUser, salaryConfig]);

  // COMPUTE ACCRUED SALARY (Live Estimate)
  const accruedData = useMemo(() => {
    if (!normalizedSalary || !shifts.length) return { totalPayable: 0, formatted: { totalPayable: formatINR(0) } };
    
    if (normalizedSalary.type === 'project') return computeProjectSalary(normalizedSalary.project, shifts);
    if (normalizedSalary.type === 'monthly') return computeMonthlySalary(normalizedSalary.monthly, shifts);
    if (normalizedSalary.type === 'hourly') return computeHourlySalary(normalizedSalary.hourly, shifts);
    
    return { totalPayable: 0, formatted: { totalPayable: formatINR(0) } };
  }, [normalizedSalary, shifts]);

  const handleConfirm = async (id) => {
    try {
      await confirmSalaryReceived(id);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err) {
      console.error("Confirmation failed:", err);
    }
  };

  const handleDispute = async (id, note) => {
    try {
      await disputePayment(id, note);
    } catch (err) {
      console.error("Dispute failed:", err);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      {/* Success Notification */}
      {showSuccess && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-emerald-200 flex items-center gap-4 animate-in fade-in slide-in-from-right-10 duration-500">
          <div className="p-2 bg-white/20 rounded-xl">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-sm font-black leading-none mb-1">Payment Confirmed</p>
            <p className="text-xs font-bold text-emerald-100">The transaction has been moved to your history.</p>
          </div>
        </div>
      )}

      {/* Handshake Banner */}
      {activeTransaction?.status === 'PENDING_CONFIRMATION' && (
        <PendingPaymentBanner 
          transaction={activeTransaction} 
          onConfirm={handleConfirm}
          onDispute={setSelectedTxForDispute}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 md:pt-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black text-gray-900 leading-none mb-4">My Salary</h1>
            <p className="text-gray-500 font-medium max-w-lg">Track your earnings, view payment history, and confirm received payouts in real-time.</p>
          </div>
          
          {salaryConfig && (
            <div className="flex items-center gap-4 bg-white p-2 pl-4 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Plan</span>
              <SalaryTypeBadge type={salaryConfig.type} />
            </div>
          )}
        </div>

        {/* Accrued Pay Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <div className="lg:col-span-2 bg-blue-600 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full -ml-20 -mb-20 blur-2xl" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-12">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Wallet size={20} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">Estimated Accrued Pay</span>
                </div>
                
                <h2 className="text-5xl md:text-7xl font-black tracking-tighter">
                  {accruedData.formatted?.totalPayable}
                </h2>

                <div className="flex items-center gap-3 text-blue-100/80">
                  <TrendingUp size={16} />
                  <p className="text-sm font-bold">Calculated from {shifts.length} validated work sessions</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-200 mb-1">Work Days</p>
                  <p className="text-2xl font-black text-white">{accruedData.qualifyingDays || 0}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-200 mb-1">Total Hours</p>
                  <p className="text-2xl font-black text-white">
                    {( (accruedData.baseHours || 0) + (accruedData.overtimeHours || 0) + (accruedData.grandTotalHours || 0) ).toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm flex flex-col justify-center space-y-6">
            <div className="p-4 bg-gray-50 rounded-3xl space-y-2">
              <div className="flex items-center gap-2 text-blue-600">
                <Info size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">How it works</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                This estimate reflects your pay for all <span className="text-gray-900 font-bold underline underline-offset-2">validated</span> work. Payments are issued periodically by admins and will appear in the history below.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest px-2">Cycle Snapshot</h4>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-600">Current Month</span>
                </div>
                <span className="text-xs font-black text-gray-900 uppercase">{new Date().toLocaleString('default', { month: 'long' })}</span>
              </div>

              {/* Validation Feedback */}
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <AlertCircle size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Validation Status</span>
                </div>
                <p className="text-[10px] text-amber-700 font-bold leading-tight">
                  Only sessions approved by an admin are included in the accrued pay above. Pending sessions will appear once accepted.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* History List */}
        <PaymentHistoryList transactions={transactions} />
      </div>

      {/* Modals */}
      {selectedTxForDispute && (
        <DisputeModal 
          isOpen={!!selectedTxForDispute}
          onClose={() => setSelectedTxForDispute(null)}
          onConfirm={handleDispute}
          transaction={selectedTxForDispute}
        />
      )}
    </div>
  );
};

export default SalaryWorkerView;
