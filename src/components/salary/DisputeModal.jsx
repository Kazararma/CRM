import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, AlertCircle, Send, MessageSquare } from 'lucide-react';

/**
 * DisputeModal
 * Allows a worker to report that they did not receive a payment marked as paid.
 */
const DisputeModal = ({ isOpen, onClose, onConfirm, transaction }) => {
  const [note, setNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(transaction.id, note);
    setNote('');
    onClose();
  };

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
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                      <AlertCircle size={20} />
                    </div>
                    <Dialog.Title className="text-lg font-black text-gray-900">
                      Report Issue
                    </Dialog.Title>
                  </div>
                  <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-gray-700">What went wrong?</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      If you haven't received the ₹{transaction?.amountPaid.toLocaleString('en-IN')} payment in your account, please let us know. Your admin will be notified immediately.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Optional Note</label>
                    <textarea 
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Bank transfer hasn't cleared yet..."
                      className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-red-500 outline-none h-24 resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-[2] py-3 bg-red-600 text-white text-sm font-black rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
                    >
                      <MessageSquare size={18} />
                      Submit Report
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

export default DisputeModal;
