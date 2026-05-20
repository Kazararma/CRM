import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, AlertCircle, Send, CheckCircle2 } from 'lucide-react';
import { formatINR } from '../../utils/formatCurrency';

/**
 * PaySalaryConfirmModal
 * Confirmation dialog before admin triggers a payment transaction.
 */
const PaySalaryConfirmModal = ({ isOpen, onClose, onConfirm, worker, computedData }) => {
  if (!worker || !computedData) return null;

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
              <Dialog.Panel className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-50/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                      <Send size={20} />
                    </div>
                    <Dialog.Title className="text-lg font-black text-gray-900">
                      Confirm Payment
                    </Dialog.Title>
                  </div>
                  <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Summary Header */}
                  <div className="text-center space-y-2">
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Paying to</p>
                    <h3 className="text-xl font-black text-gray-900">{worker.displayName}</h3>
                    <div className="inline-flex items-center px-2 py-1 bg-gray-100 rounded-md text-[10px] font-black text-gray-500 uppercase">
                      {worker.salary.type} model
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-bold">Base / Accrued</span>
                      <span className="text-sm font-black text-gray-900">
                        {computedData.formatted?.basePay || computedData.formatted?.amountPayable || computedData.formatted?.grandTotalPayable}
                      </span>
                    </div>
                    {computedData.overtimePay > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-bold">Overtime ({computedData.overtimeHours} hrs)</span>
                        <span className="text-sm font-black text-amber-600">+{computedData.formatted.overtimePay}</span>
                      </div>
                    )}
                    <div className="h-px bg-gray-200"></div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-sm font-black text-blue-600 uppercase">Total to Pay</span>
                      <span className="text-xl font-black text-blue-600">{computedData.formatted.totalPayable || computedData.formatted.grandTotalPayable || computedData.formatted.amountPayable}</span>
                    </div>
                  </div>

                  {/* Warning */}
                  <div className="flex gap-3 p-4 bg-amber-50 rounded-2xl text-amber-700 text-xs leading-relaxed border border-amber-100">
                    <AlertCircle size={18} className="shrink-0" />
                    <p>Clicking <strong>Send Payment</strong> will record this transaction and notify the worker. They must confirm receipt to finalize the record.</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={onClose}
                      className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onConfirm(worker, computedData);
                        onClose();
                      }}
                      className="flex-[2] py-3 bg-blue-600 text-white text-sm font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                    >
                      <Send size={18} />
                      Send Payment
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default PaySalaryConfirmModal;
