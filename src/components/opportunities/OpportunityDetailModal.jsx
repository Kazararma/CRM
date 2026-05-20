import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, CheckCircle, Clock, XCircle, RotateCcw, LayoutDashboard } from 'lucide-react';
import { format } from 'date-fns';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

import { OPPORTUNITY_PHASE_META } from '../../hooks/useOpportunitiesMetrics';
import { OPPORTUNITY_PHASES } from '../../services/opportunitiesService';

import { STAGE_COMPONENTS } from './stages';
import PhaseAdvanceControls from './PhaseAdvanceControls';
import OpportunityLogsPanel from './OpportunityLogsPanel';
import OpportunityOverview from './OpportunityOverview';

const OpportunityDetailModal = ({ isOpen, onClose, opportunity }) => {
  const { currentUser, userProfile } = useAuth();
  
  // Track selected tab. Start with overview.
  const [selectedTab, setSelectedTab] = useState('overview');
  const [logsOpen, setLogsOpen] = useState(false);

  // Jump to the current phase when the phase string changes (e.g., Next Stage clicked).
  // But on initial open, default to 'overview' so they can see everything.
  useEffect(() => {
    if (isOpen) {
      setSelectedTab('overview');
      setLogsOpen(false);
    }
  }, [isOpen]); // Only run when modal opens

  // Separate effect to jump to the new phase ONLY if they advance while the modal is already open
  useEffect(() => {
    if (isOpen && opportunity?.phase && selectedTab !== 'overview') {
      setSelectedTab(opportunity.phase);
    }
  }, [opportunity?.phase]);

  if (!opportunity) return null;

  // Logic: is the selected tab editable?
  const currentPhaseIdx = OPPORTUNITY_PHASES.indexOf(opportunity.phase);
  const selectedTabIdx  = OPPORTUNITY_PHASES.indexOf(selectedTab);
  
  const isLocked = opportunity.closedWon?.isConvertedToProject;
  const isTerminal = opportunity.phase === 'closed_won' || opportunity.phase === 'closed_lost';
  const isEditable = !isLocked && (selectedTab !== 'overview') && (selectedTabIdx <= currentPhaseIdx) && !(isTerminal && selectedTabIdx !== currentPhaseIdx);

  const isWon  = opportunity.phase === 'closed_won';
  const isLost = opportunity.phase === 'closed_lost';

  // ── Quick Action: Toggle Failed State ──────────────────────────────────────
  const handleToggleFailed = async () => {
    if (isWon) return; // Cannot toggle closed_won
    try {
      if (!isLost) {
        await updateDoc(doc(db, 'opportunities', opportunity.id), {
          phase: 'closed_lost',
          'closedLost.previousPhase': opportunity.phase,
          'closedLost.lostDate': serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
        });
        
        await addDoc(collection(db, 'opportunities', opportunity.id, 'opportunity_logs'), {
          content: `Opportunity marked as Failed (Closed Lost) from modal by ${userProfile?.displayName || currentUser.email}.`,
          phase: 'closed_lost',
          loggedBy: currentUser.uid,
          loggerName: userProfile?.displayName || currentUser.email,
          createdAt: serverTimestamp(),
          attachments: [],
        });
        setSelectedTab('closed_lost'); // Jump to the reason tab
      } else {
        const prevPhase = opportunity.closedLost?.previousPhase || 'prospecting';
        await updateDoc(doc(db, 'opportunities', opportunity.id), {
          phase: prevPhase,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
        });

        await addDoc(collection(db, 'opportunities', opportunity.id, 'opportunity_logs'), {
          content: `Opportunity reverted to Active (Phase: ${prevPhase}) from modal by ${userProfile?.displayName || currentUser.email}.`,
          phase: prevPhase,
          loggedBy: currentUser.uid,
          loggerName: userProfile?.displayName || currentUser.email,
          createdAt: serverTimestamp(),
          attachments: [],
        });
        setSelectedTab(prevPhase); // Jump back to the active phase
      }
    } catch (err) {
      console.error('Error toggling failed state:', err);
      alert('Failed to update opportunity state.');
    }
  };

  const ActiveStageComponent = selectedTab === 'overview' ? OpportunityOverview : STAGE_COMPONENTS[selectedTab];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden flex items-end md:items-center justify-center md:p-4">
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-full md:translate-y-8 md:scale-95" enterTo="opacity-100 translate-y-0 md:scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0 md:scale-100" leaveTo="opacity-0 translate-y-full md:translate-y-8 md:scale-95">
            <Dialog.Panel className="w-full h-[95vh] md:h-[90vh] md:max-w-6xl flex flex-col bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
              
              {/* ── Header ── */}
              <div className={`flex flex-col md:flex-row md:justify-between md:items-start p-4 md:p-6 border-b shrink-0 gap-4 md:gap-0 ${isLost ? 'bg-red-50/50 border-red-100' : 'bg-gray-50/50 border-gray-100'}`}>
                <div className="flex items-start gap-3 md:gap-4 w-full md:w-auto">
                  <div className={`mt-1 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border shrink-0 ${
                    opportunity.category === 'hot'     ? 'bg-red-50    text-red-600    border-red-200'    :
                    opportunity.category === 'neutral' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                                         'bg-blue-50   text-blue-600   border-blue-200'
                  }`}>
                    {opportunity.category}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Dialog.Title as="h3" className="text-lg md:text-xl font-bold text-gray-900 truncate">
                        {opportunity.title || opportunity.qualification?.projectTitle || 'Untitled Opportunity'}
                      </Dialog.Title>
                      {isLost && (
                        <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border border-red-200">
                          Failed
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs font-medium text-gray-500">
                      <span className="truncate max-w-[200px]">Client: <strong className="text-gray-700">{opportunity.clientName}</strong></span>
                      <span className="hidden md:block w-1 h-1 rounded-full bg-gray-300" />
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock size={12} />
                        {opportunity.createdAt ? format(opportunity.createdAt.toDate ? opportunity.createdAt.toDate() : new Date(opportunity.createdAt), 'dd MMM yyyy') : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-center w-full md:w-auto justify-end md:justify-start">
                  {!isWon && (
                    <button 
                      onClick={handleToggleFailed}
                      className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-bold rounded-xl flex items-center gap-2 transition-colors border flex-1 md:flex-none justify-center ${
                        isLost 
                          ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' 
                          : 'bg-white text-gray-600 border-gray-200 hover:text-red-600 hover:bg-red-50 hover:border-red-200'
                      }`}
                    >
                      {isLost ? (
                        <><RotateCcw size={16} /> <span className="hidden sm:inline">Revert to Active</span><span className="sm:hidden">Revert</span></>
                      ) : (
                        <><XCircle size={16} /> <span className="hidden sm:inline">Mark as Failed</span><span className="sm:hidden">Failed</span></>
                      )}
                    </button>
                  )}
                  <button onClick={() => setLogsOpen(!logsOpen)} className={`px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-bold rounded-xl transition-colors shrink-0 ${logsOpen ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {logsOpen ? 'Hide Logs' : 'Logs'}
                  </button>
                  <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-gray-200 rounded-xl transition-colors shrink-0">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                
                {/* Left Sidebar: Stages List (Horizontal scroll on mobile) */}
                <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-100 overflow-x-auto md:overflow-y-auto p-2 md:p-4 flex flex-row md:flex-col gap-2 md:gap-1 shrink-0 hide-scrollbar snap-x">
                  <button
                    onClick={() => setSelectedTab('overview')}
                    className={`shrink-0 md:shrink text-left px-3 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-all md:mb-4 snap-center ${
                      selectedTab === 'overview' 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                        : 'text-gray-600 hover:bg-gray-200/50'
                    }`}
                  >
                    <LayoutDashboard size={16} className={selectedTab === 'overview' ? 'text-blue-200' : 'text-gray-400'} />
                    Overview
                  </button>

                  <p className="hidden md:block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-2">Pipeline Stages</p>
                  
                  {OPPORTUNITY_PHASE_META.map((meta, idx) => {
                    const isSelected = selectedTab === meta.value;
                    const isCurrent  = opportunity.phase === meta.value;
                    const isPast     = OPPORTUNITY_PHASES.indexOf(meta.value) < currentPhaseIdx;
                    
                    // Don't show won/lost if they aren't the current phase or past
                    if ((meta.group === 'won' || meta.group === 'lost') && !isCurrent && !isPast) return null;

                    return (
                      <button
                        key={meta.value}
                        onClick={() => setSelectedTab(meta.value)}
                        className={`shrink-0 md:shrink text-left px-3 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center justify-between transition-all gap-3 snap-center ${
                          isSelected ? 'bg-white shadow-sm border border-gray-200 text-blue-600' :
                          isCurrent  ? 'text-gray-900 hover:bg-gray-200/50' :
                          isPast     ? 'text-gray-600 hover:bg-gray-200/50' :
                                       'text-gray-400 hover:bg-gray-200/50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-400 w-auto md:w-4">{idx + 1}.</span>
                          {meta.label}
                        </span>
                        {isPast && !isCurrent && <CheckCircle size={14} className="text-emerald-500" />}
                        {isCurrent && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                      </button>
                    );
                  })}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                  {isLocked && selectedTab !== 'overview' && (
                    <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold rounded-xl flex items-center gap-2">
                      <CheckCircle size={16} className="shrink-0" />
                      This opportunity has been converted to a Project and is now locked (read-only).
                    </div>
                  )}

                  {!isEditable && !isLocked && selectedTab !== 'overview' && selectedTabIdx > currentPhaseIdx && (
                    <div className="mb-6 p-3 bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl flex items-center gap-2">
                      You are previewing a future stage. It will be editable once the opportunity reaches this phase.
                    </div>
                  )}
                  
                  {ActiveStageComponent ? (
                    <ActiveStageComponent 
                      opportunity={opportunity}
                      isEditable={isEditable}
                    />
                  ) : (
                    <div className="text-gray-400 text-center mt-20">Select a stage to view details.</div>
                  )}
                </div>

                {/* Optional Right Panel: Logs */}
                {logsOpen && (
                  <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-100 shrink-0 p-4 bg-gray-50 h-64 md:h-auto overflow-y-auto">
                    <OpportunityLogsPanel 
                      opportunityId={opportunity.id} 
                      currentPhase={opportunity.phase} 
                    />
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              <div className="p-4 md:p-6 border-t border-gray-100 bg-white flex flex-col md:flex-row justify-between items-center shrink-0 gap-4 md:gap-0">
                <div className="flex items-center gap-2 text-sm w-full md:w-auto justify-between md:justify-start">
                  <span className="text-gray-500 font-medium">Current Phase:</span>
                  <span className="font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                    {OPPORTUNITY_PHASE_META.find(m => m.value === opportunity.phase)?.label}
                  </span>
                </div>

                <div className="w-full md:w-auto">
                  <PhaseAdvanceControls opportunity={opportunity} />
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default OpportunityDetailModal;
