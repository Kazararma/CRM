import React from 'react';
// Force Vite HMR reload
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X } from 'lucide-react';
import LeadInfoPanel from './LeadInfoPanel';
import LeadChatPanel from './LeadChatPanel';

const LeadDetailView = ({ isOpen, onClose, lead }) => {
  if (!lead) return null;

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
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-8"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-8"
            >
              <Dialog.Panel className="w-full max-w-7xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all border border-gray-100 flex flex-col h-[90vh]">
                
                {/* Header (Cross icon only, or simple close) */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 p-2 bg-white/80 hover:bg-gray-100 rounded-full transition-colors backdrop-blur-sm"
                >
                  <X size={20} className="text-gray-600" />
                </button>

                {/* Two-Column Layout */}
                <div className="flex flex-col md:flex-row h-full">
                  {/* Left Column: Lead Info Panel (40%) */}
                  <div className="w-full md:w-[40%] border-r border-gray-100 overflow-y-auto bg-gray-50/30">
                    <LeadInfoPanel lead={lead} />
                  </div>

                  {/* Right Column: Chat & Autonomous Workflow Panel (60%) */}
                  <div className="w-full md:w-[60%] flex flex-col bg-white overflow-hidden">
                    <LeadChatPanel lead={lead} />
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

export default LeadDetailView;
