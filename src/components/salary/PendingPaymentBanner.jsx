import React from 'react';
import { Bell, CheckCircle2, AlertCircle, IndianRupee } from 'lucide-react';
import { formatINR } from '../../utils/formatCurrency';

/**
 * PendingPaymentBanner
 * A sticky notification for workers when a payment is awaiting their confirmation.
 */
const PendingPaymentBanner = ({ transaction, onConfirm, onDispute }) => {
  if (!transaction) return null;

  return (
    <div className="sticky top-0 z-30 bg-emerald-600 text-white shadow-xl animate-in slide-in-from-top-full duration-500">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-white/20 rounded-xl animate-pulse">
            <Bell size={24} />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-emerald-100 leading-none mb-1">Payment Received</p>
            <p className="text-sm font-bold">
              <span className="font-black">{transaction.adminName}</span> has marked <span className="font-black underline underline-offset-4">{formatINR(transaction.amountPaid)}</span> as paid to you.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => onDispute(transaction)}
            className="flex-1 md:flex-none px-6 py-2.5 bg-emerald-700/50 hover:bg-red-600 text-xs font-black rounded-xl transition-all border border-emerald-400/30 flex items-center justify-center gap-2"
          >
            <AlertCircle size={14} />
            NOT RECEIVED
          </button>
          <button 
            onClick={() => onConfirm(transaction.id)}
            className="flex-1 md:flex-none px-8 py-2.5 bg-white text-emerald-700 text-xs font-black rounded-xl hover:bg-emerald-50 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={14} />
            CONFIRM RECEIPT
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingPaymentBanner;
