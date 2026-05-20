import React from 'react';
import { Users, Wallet, Hourglass, AlertTriangle, IndianRupee } from 'lucide-react';
import { formatINR } from '../../utils/formatCurrency';

/**
 * GlobalPayrollTracker
 * Summary bar for the Admin view. Displays total liability and handshake metrics.
 */
const GlobalPayrollTracker = ({ workerSalaries, transactions }) => {
  const configuredWorkers = workerSalaries.filter(w => w.salary?.isConfigured).length;
  const totalLiability = workerSalaries.reduce((sum, w) => sum + (w.computed?.totalPayable || 0), 0);
  
  const pendingCount = transactions.filter(t => t.status === 'PENDING_CONFIRMATION').length;
  const disputedCount = transactions.filter(t => t.status === 'DISPUTED').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {/* Total Workers */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Users size={20} />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Payroll</p>
        </div>
        <p className="text-2xl font-black text-gray-900">{configuredWorkers} <span className="text-sm font-bold text-gray-400">Workers</span></p>
      </div>

      {/* Total Liability */}
      <div className="bg-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/20 text-white rounded-lg">
            <Wallet size={20} />
          </div>
          <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Total Liability</p>
        </div>
        <p className="text-2xl font-black text-white">{formatINR(totalLiability)}</p>
      </div>

      {/* Pending Confirmations */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <Hourglass size={20} />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Handshakes</p>
        </div>
        <p className="text-2xl font-black text-gray-900">{pendingCount}</p>
      </div>

      {/* Disputed Payments */}
      <div className={`bg-white p-6 rounded-2xl border shadow-sm transition-colors ${disputedCount > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg ${disputedCount > 0 ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
            <AlertTriangle size={20} />
          </div>
          <p className={`text-[10px] font-black uppercase tracking-widest ${disputedCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>Disputed Payments</p>
        </div>
        <p className={`text-2xl font-black ${disputedCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{disputedCount}</p>
      </div>
    </div>
  );
};

export default GlobalPayrollTracker;
