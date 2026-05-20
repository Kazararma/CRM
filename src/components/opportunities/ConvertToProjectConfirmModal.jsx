import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, ArrowRightCircle } from 'lucide-react';
import { convertOpportunityToProject } from '../../services/opportunitiesService';
import { useAuth } from '../../context/AuthContext';

const ConvertToProjectConfirmModal = ({ opportunity, onClose }) => {
  const { currentUser, userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await convertOpportunityToProject(
        opportunity.id,
        opportunity,
        currentUser.uid,
        userProfile?.displayName || currentUser.email
      );
      onClose(); // Parent modal can react to the change
    } catch (err) {
      console.error('Handshake 2 failed:', err);
      setError('Failed to convert opportunity to project. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={() => !isSubmitting && onClose()}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white p-6 text-left align-middle shadow-2xl transition-all border border-gray-100">
                <div className="flex justify-between items-center mb-5">
                  <Dialog.Title as="h3" className="text-xl font-black text-gray-900">
                    Confirm Conversion
                  </Dialog.Title>
                  <button onClick={onClose} disabled={isSubmitting} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>

                <p className="text-sm text-gray-600 mb-6">
                  Are you sure you want to convert <strong className="text-gray-900">{opportunity.title || 'this opportunity'}</strong> into an active project?
                  This action is final and will lock the opportunity.
                </p>

                {error && (
                  <div className="p-3 mb-6 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>
                )}

                <div className="flex gap-3">
                  <button onClick={onClose} disabled={isSubmitting} className="flex-1 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-bold rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleConfirm} disabled={isSubmitting} className="flex-[2] px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-200 transition-colors disabled:opacity-60">
                    <ArrowRightCircle size={18} />
                    {isSubmitting ? 'Converting…' : 'Yes, Convert to Project'}
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

export default ConvertToProjectConfirmModal;
