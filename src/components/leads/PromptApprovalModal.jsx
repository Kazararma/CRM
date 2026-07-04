import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, Check, XCircle } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const PromptApprovalModal = ({ leadId, approval, onClose }) => {
  const { currentUser } = useAuth();
  // Safe fallback if approval is undefined (e.g. testing)
  const initialPrompt = approval?.generatedPrompt || '';
  const [editedPrompt, setEditedPrompt] = useState(initialPrompt);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      // In a full implementation, this would update the approval status
      // and trigger the cloud function to resume the cycle.
      await updateDoc(doc(db, 'leads', leadId), {
        'pendingPromptApproval.status': 'approved',
        'pendingPromptApproval.editedPrompt': editedPrompt,
        'pendingPromptApproval.reviewedAt': serverTimestamp(),
        'pendingPromptApproval.reviewedBy': currentUser.uid
      });
      alert('Prompt approved! The agent will now dispatch.');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to approve prompt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        'pendingPromptApproval.status': 'rejected',
        'pendingPromptApproval.reviewedAt': serverTimestamp(),
        'pendingPromptApproval.reviewedBy': currentUser.uid
      });
      // Append rejection to chat history or log
      alert('Prompt rejected.');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to reject prompt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => !isSubmitting && onClose()}>
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
              enterFrom="opacity-0 scale-95 translate-y-4"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-4"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all border border-gray-100 flex flex-col">
                
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-bold text-gray-900">
                      🤖 AI-Generated Prompt
                    </Dialog.Title>
                    <p className="text-xs text-gray-500 mt-1">Review and edit before sending</p>
                  </div>
                  <button onClick={onClose} disabled={isSubmitting} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>

                <div className="p-6">
                  <textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-64 p-4 text-sm font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y"
                  />
                  <div className="text-right text-xs font-medium text-gray-400 mt-2">
                    Character count: {editedPrompt.length}
                  </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center gap-4">
                  <button
                    onClick={handleReject}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-white border border-gray-200 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors flex items-center gap-2"
                  >
                    <XCircle size={18} /> Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={isSubmitting || !editedPrompt.trim()}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md shadow-blue-200"
                  >
                    <Check size={18} /> Edit & Approve →
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

export default PromptApprovalModal;
