import React from 'react';
import { format } from 'date-fns';
import { History, ChevronRight, CheckCircle2, AlertCircle, Hourglass } from 'lucide-react';
import { formatINR } from '../../utils/formatCurrency';
import { SalaryTypeBadge } from './SalaryUI';

/**
 * PaymentHistoryList
 * Renders a chronological list of past transactions for a worker.
 */
const PaymentHistoryList = ({ transactions }) => {
  if (!transactions?.length) {
    return (
      <div className="bg-white rounded-3xl border-2 border-dashed border-gray-100 p-12 text-center">
        <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
          <History size={32} />
        </div>
        <p className="text-gray-400 font-bold italic text-sm">No payment history found yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <History size={20} className="text-blue-600" />
        <h3 className="text-lg font-black text-gray-900">Payment History</h3>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date Paid</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Projects</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <p className="text-sm font-black text-gray-900">
                      {tx.paidAt ? format(tx.paidAt.toDate(), 'dd MMM yyyy') : 'Recently'}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">by {tx.adminName}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-black text-blue-600">{formatINR(tx.amountPaid)}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{tx.hoursLogged || 0} hrs total</p>
                  </td>
                  <td className="px-6 py-5">
                    <SalaryTypeBadge type={tx.salaryType} />
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {tx.breakdown?.projectBreakdown?.length > 0 ? (
                        tx.breakdown.projectBreakdown.map((p, pIdx) => (
                          <div key={pIdx} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[9px] font-black border border-gray-200">
                            {p.projectName}: {formatINR(p.amount || 0)}
                          </div>
                        ))
                      ) : (
                        <span className="text-[10px] text-gray-400 italic font-bold">{tx.scope?.projectName || 'General Payroll'}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      {tx.status === 'PAID' && (
                        <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
                          <CheckCircle2 size={14} />
                          Confirmed
                        </div>
                      )}
                      {tx.status === 'DISPUTED' && (
                        <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs">
                          <AlertCircle size={14} />
                          Disputed
                        </div>
                      )}
                      {tx.status === 'PENDING_CONFIRMATION' && (
                        <div className="flex items-center gap-1.5 text-amber-600 font-bold text-xs">
                          <Hourglass size={14} />
                          Pending
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryList;
