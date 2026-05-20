import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, Trash2, ArrowRightCircle, Calendar } from 'lucide-react';
import { db } from '../../firebase/config';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { convertLeadToOpportunity } from '../../services/opportunitiesService';

import LeadLogsPanel from './LeadLogsPanel';
import LeadPhaseSelector from './LeadPhaseSelector';
import ContactedInfoCard from './ContactedInfoCard';

const LeadDetailModal = ({ isOpen, onClose, lead }) => {
  const { currentUser, userProfile } = useAuth();
  const [activeTab, setActiveTab]       = useState('overview'); // 'overview' | 'logs'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
      setError(null);
    }
  }, [isOpen]);

  if (!lead) return null;

  // ─── Phase Change ────────────────────────────────────────────────────────────
  const handlePhaseChange = async (newPhase) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        phase:     newPhase,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });

      // Auto-log the phase change
      await addDoc(collection(db, 'leads', lead.id, 'lead_logs'), {
        content:    `Phase changed to "${newPhase}" by ${userProfile?.displayName || currentUser.email}.`,
        phase:      newPhase,
        loggedBy:   currentUser.uid,
        loggerName: userProfile?.displayName || currentUser.email,
        createdAt:  serverTimestamp(),
        attachments: [],
      });
    } catch (err) {
      console.error('Error updating phase:', err);
      setError('Failed to update phase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Delete (Unqualified leads only) ─────────────────────────────────────────
  const handleDeleteLead = async () => {
    if (!window.confirm('Permanently remove this unqualified lead? This cannot be undone.')) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        isDeleted: true,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
      onClose();
    } catch (err) {
      console.error('Error deleting lead:', err);
      setError('Failed to delete lead.');
      setIsSubmitting(false);
    }
  };

  // ─── Derivations ─────────────────────────────────────────────────────────────
  const isConvertedToOpportunity = !!lead.isConvertedToOpportunity;
  // Legacy support: old docs used isConverted for direct-to-project conversion
  const isLegacyConverted        = !!lead.isConverted && !isConvertedToOpportunity;

  // Tabs — only Overview and Logs (Financials removed per blueprint §2.4.1)
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'logs',     label: 'Logs' },
  ];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => !isSubmitting && onClose()}>
        {/* Backdrop */}
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
              enterFrom="opacity-0 scale-95 translate-y-8"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-8"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all border border-gray-100 flex flex-col max-h-[90vh]">

                {/* ── Header ── */}
                <div className="flex justify-between items-start p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
                  <div className="flex items-start gap-4">
                    {/* Category badge */}
                    <div className={`mt-1 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${
                      lead.category === 'hot'     ? 'bg-red-50    text-red-600    border-red-200'    :
                      lead.category === 'neutral' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                                    'bg-blue-50   text-blue-600   border-blue-200'
                    }`}>
                      {lead.category}
                    </div>
                    <div>
                      <Dialog.Title as="h3" className="text-xl font-bold text-gray-900 mb-1">
                        {lead.projectTitle}
                      </Dialog.Title>
                      <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                        <span>Client: <strong className="text-gray-700">{lead.clientName}</strong></span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="flex items-center gap-1">
                          Source: <span className="bg-white px-1.5 py-0.5 rounded border border-gray-200">{lead.source}</span>
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          Added: {lead.createdAt
                            ? format(lead.createdAt.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt), 'dd MMM yyyy')
                            : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="p-2 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>

                {/* ── Tabs Nav ── */}
                <div className="flex px-6 border-b border-gray-100 shrink-0">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-400 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ── Tab Content ── */}
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
                  {error && (
                    <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>
                  )}

                  {/* ── Overview Tab ── */}
                  {activeTab === 'overview' && (
                    <div className="space-y-5 animate-in fade-in">

                      {/* Description */}
                      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 mb-3">
                          Description
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.description}</p>
                      </div>

                      {/* Contact Details */}
                      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 mb-3">
                          Contact Details
                        </h4>
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="text-gray-400 w-16 inline-block font-medium">Email:</span>
                            <a href={`mailto:${lead.email}`} className="font-bold text-blue-600 hover:underline">
                              {lead.email}
                            </a>
                          </p>
                          <p>
                            <span className="text-gray-400 w-16 inline-block font-medium">Phone:</span>
                            <a href={`tel:${lead.phoneNumber}`} className="font-bold text-gray-900">
                              {lead.phoneNumber}
                            </a>
                          </p>
                        </div>
                      </div>

                      {/* Legacy: Converted to Project badge (old system) */}
                      {isLegacyConverted && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm font-bold text-emerald-700 flex items-center gap-2">
                          ✓ Converted to Project (Legacy) — this lead was converted under the old system.
                        </div>
                      )}

                      {/* Contacted Info Card — hidden when phase is 'open' */}
                      {lead.phase !== 'open' && (
                        <ContactedInfoCard
                          lead={lead}
                          isReadOnly={isConvertedToOpportunity}
                        />
                      )}
                    </div>
                  )}

                  {/* ── Logs Tab ── */}
                  {activeTab === 'logs' && (
                    <div className="h-full min-h-[300px] animate-in fade-in">
                      <LeadLogsPanel leadId={lead.id} currentPhase={lead.phase} />
                    </div>
                  )}
                </div>

                {/* ── Footer ── */}
                <div className="p-6 border-t border-gray-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                  {/* Left: Phase Selector */}
                  <LeadPhaseSelector
                    currentPhase={lead.phase}
                    isConvertedToOpportunity={isConvertedToOpportunity}
                    isConverted={lead.isConverted}
                    onPhaseChange={handlePhaseChange}
                    isSubmitting={isSubmitting}
                  />

                  {/* Right: Action Buttons */}
                  <div className="flex items-center gap-3">

                    {/* Delete button — only for 'unqualified' phase */}
                    {lead.phase === 'unqualified' && !isConvertedToOpportunity && (
                      <button
                        onClick={handleDeleteLead}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded-xl hover:bg-red-100 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 size={16} /> Delete Lead
                      </button>
                    )}

                    {/* Convert to Opportunity — qualified, not yet converted */}
                    {lead.phase === 'qualified' && !isConvertedToOpportunity && (
                      <button
                        onClick={async () => {
                          setIsSubmitting(true);
                          setError(null);
                          try {
                            await convertLeadToOpportunity(
                              lead.id,
                              lead,
                              currentUser.uid,
                              userProfile?.displayName || currentUser.email,
                            );
                            onClose();
                          } catch (err) {
                            console.error('[LeadDetailModal] Handshake 1 failed:', err);
                            setError('Failed to convert lead to opportunity. Please try again.');
                            setIsSubmitting(false);
                          }
                        }}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 shadow-md shadow-emerald-200 transition-colors disabled:opacity-60"
                      >
                        <ArrowRightCircle size={16} />
                        {isSubmitting ? 'Converting…' : 'Convert to Opportunity →'}
                      </button>
                    )}

                    {/* View Opportunity — already converted */}
                    {isConvertedToOpportunity && (
                      <button
                        onClick={() => {
                          onClose();
                          // TODO: navigate('/opportunities') filtered to this opportunity in Phase 2
                          alert('View Opportunity — coming in Phase 2.');
                        }}
                        className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 flex items-center gap-2 shadow-md shadow-blue-200 transition-colors"
                      >
                        View Opportunity →
                      </button>
                    )}
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

export default LeadDetailModal;
