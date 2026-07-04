import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, Trash2, ArrowRightCircle, Calendar, AlertTriangle, CheckCircle, Play } from 'lucide-react';
import { db, functions } from '../../firebase/config';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
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

  // Intercept Editor State
  const [isIntercepting, setIsIntercepting] = useState(false);
  const [promptOverride, setPromptOverride] = useState('');
  const [customDiscount, setCustomDiscount] = useState('');

  // Dispatch State
  const [dispatchChannel, setDispatchChannel] = useState('vapi');
  const [dispatchContext, setDispatchContext] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
      setError(null);
      setIsIntercepting(false);
      setPromptOverride(lead?.promptOverride || '');
      setCustomDiscount(lead?.customDiscount || '');
      setDispatchChannel('vapi');
      setDispatchContext('');
    }
  }, [isOpen, lead]);

  if (!lead) return null;

  // ─── Human in the loop intercept ─────────────────────────────────────────────
  const handleSaveIntercept = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        promptOverride,
        customDiscount: customDiscount ? Number(customDiscount) : null,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
      
      // Auto-log the intervention
      await addDoc(collection(db, 'leads', lead.id, 'lead_logs'), {
        content:    `Human intervention applied: Updated custom instructions & discount.`,
        phase:      lead.phase,
        loggedBy:   currentUser.uid,
        loggerName: userProfile?.displayName || currentUser.email,
        createdAt:  serverTimestamp(),
        attachments: [],
      });
      
      setIsIntercepting(false);
    } catch (err) {
      console.error('Error saving intervention:', err);
      setError('Failed to save intervention.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Clear Urgent Alert ──────────────────────────────────────────────────────
  const handleClearAlert = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        attentionNeeded: false,
        aiStatus: 'idle',
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
      
      // Auto-log clearing the flag
      await addDoc(collection(db, 'leads', lead.id, 'lead_logs'), {
        content:    `Urgent alert cleared. Lead returned to idle state.`,
        phase:      lead.phase,
        loggedBy:   currentUser.uid,
        loggerName: userProfile?.displayName || currentUser.email,
        createdAt:  serverTimestamp(),
        attachments: [],
      });
    } catch (err) {
      console.error('Error clearing alert:', err);
      setError('Failed to clear alert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Change Category ─────────────────────────────────────────────────────────
  const handleCategoryChange = async (e) => {
    const newCategory = e.target.value;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        category: newCategory,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
    } catch (err) {
      console.error('Error updating category:', err);
      setError('Failed to update category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Initiate AI Outreach ────────────────────────────────────────────────────
  const handleDispatch = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const dispatchLeadBatchToTaskQueue = httpsCallable(functions, 'dispatchLeadBatchToTaskQueue');
      await dispatchLeadBatchToTaskQueue({
        leadIds: [lead.id],
        channel: dispatchChannel,
        campaignContext: dispatchContext,
        tenantId: currentUser.uid,
      });

      // Optimistically update the UI to show it's active
      await updateDoc(doc(db, 'leads', lead.id), {
        aiStatus: 'calling', // Standard fallback UI update
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });

      // Auto-log dispatch
      await addDoc(collection(db, 'leads', lead.id, 'lead_logs'), {
        content:    `Initiated AI workflow via ${dispatchChannel}.`,
        phase:      lead.phase,
        loggedBy:   currentUser.uid,
        loggerName: userProfile?.displayName || currentUser.email,
        createdAt:  serverTimestamp(),
        attachments: [],
      });

    } catch (err) {
      console.error('Error dispatching lead:', err);
      setError('Failed to initiate AI outreach.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                    {/* Category Selector */}
                    <div className="mt-1">
                      <select
                        value={lead.category || 'neutral'}
                        onChange={handleCategoryChange}
                        disabled={isSubmitting}
                        className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border outline-none cursor-pointer ${
                          lead.category === 'hot'     ? 'bg-red-50 text-red-600 border-red-200'    :
                          lead.category === 'cold'    ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                        'bg-yellow-50 text-yellow-600 border-yellow-200'
                        }`}
                      >
                        <option value="hot">HOT</option>
                        <option value="neutral">NEUTRAL</option>
                        <option value="cold">COLD</option>
                      </select>
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

                {/* ── Urgent Alert Banner ── */}
                {lead.attentionNeeded && (
                  <div className="bg-red-500 text-white px-6 py-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="mt-0.5 shrink-0" />
                      <div>
                        <h4 className="font-bold text-sm">Urgent Attention Needed</h4>
                        <p className="text-xs text-red-100 mt-0.5">The autonomous agent encountered an issue with this lead (e.g. hung up, angry response). Automated follow-ups are paused until you clear this flag.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleClearAlert}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-white text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <CheckCircle size={16} /> Clear Alert Flag
                    </button>
                  </div>
                )}

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

                      {/* Active Pipeline Controls (Human in the loop) */}
                      {(lead.aiStatus === 'calling' || lead.aiStatus === 'messaging') && (
                        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200 shadow-sm animate-in fade-in">
                          <div className="flex items-center justify-between mb-4 border-b border-blue-200 pb-3">
                            <div>
                              <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest">
                                Active Pipeline Controls
                              </h4>
                              <p className="text-xs text-blue-700 mt-1">Autonomous outreach is currently active. You can intercept to inject instructions before the next agent action.</p>
                            </div>
                            <button
                              onClick={() => setIsIntercepting(!isIntercepting)}
                              className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
                            >
                              {isIntercepting ? 'Cancel Edit' : 'Intercept / Edit'}
                            </button>
                          </div>

                          {isIntercepting && (
                            <div className="space-y-4">
                              <div>
                                <label className="block text-xs font-bold text-blue-900 mb-1">Prompt Override / Custom Context</label>
                                <textarea
                                  className="w-full p-3 rounded-xl border border-blue-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                  rows={3}
                                  placeholder="e.g. Focus specifically on our enterprise package..."
                                  value={promptOverride}
                                  onChange={(e) => setPromptOverride(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-blue-900 mb-1">Custom Discount (%)</label>
                                <input
                                  type="number"
                                  className="w-full p-3 rounded-xl border border-blue-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                  placeholder="e.g. 15"
                                  value={customDiscount}
                                  onChange={(e) => setCustomDiscount(e.target.value)}
                                />
                              </div>
                              <div className="flex justify-end pt-2">
                                <button
                                  onClick={handleSaveIntercept}
                                  disabled={isSubmitting}
                                  className="px-5 py-2 bg-blue-700 text-white text-sm font-bold rounded-xl hover:bg-blue-800 transition-colors shadow-sm"
                                >
                                  {isSubmitting ? 'Saving...' : 'Save Intervention'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Initiate AI Outreach Panel (when idle) */}
                      {lead.aiStatus === 'idle' && (
                        <div className="bg-purple-50 p-5 rounded-2xl border border-purple-200 shadow-sm animate-in fade-in">
                          <div className="flex items-center justify-between mb-4 border-b border-purple-200 pb-3">
                            <div>
                              <h4 className="text-sm font-black text-purple-900 uppercase tracking-widest">
                                Initiate AI Outreach
                              </h4>
                              <p className="text-xs text-purple-700 mt-1">Dispatch this lead to the autonomous agent workflow.</p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-purple-900 mb-1">Outreach Channel</label>
                              <select
                                className="w-full p-3 rounded-xl border border-purple-200 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                                value={dispatchChannel}
                                onChange={(e) => setDispatchChannel(e.target.value)}
                              >
                                <option value="vapi">Voice (Vapi)</option>
                                <option value="bland">Voice (Bland)</option>
                                <option value="whatsapp">Messaging (WhatsApp)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-purple-900 mb-1">Campaign Context / Instructions</label>
                              <textarea
                                className="w-full p-3 rounded-xl border border-purple-200 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                                rows={2}
                                placeholder="e.g. Focus on our enterprise SaaS tier..."
                                value={dispatchContext}
                                onChange={(e) => setDispatchContext(e.target.value)}
                              />
                            </div>
                            <div className="flex justify-end pt-2">
                              <button
                                onClick={handleDispatch}
                                disabled={isSubmitting}
                                className="px-5 py-2 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-sm flex items-center gap-2"
                              >
                                <Play size={16} /> {isSubmitting ? 'Dispatching...' : 'Start Workflow'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

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
