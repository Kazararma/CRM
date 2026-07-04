import React, { useState } from 'react';
import { Play, CheckCircle, Edit3, Loader2, PlusCircle } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import PromptApprovalModal from './PromptApprovalModal';

const ChatActionBar = ({ lead }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const { phase, executionMode, pendingPromptApproval } = lead;

  const handleMarkContacted = async () => {
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        phase: 'contacted',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      alert('Failed to update phase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitiateAI = () => {
    // In hybrid mode, this might generate a prompt and show the modal
    alert("This would trigger the Cloud Function to generate a prompt and open the approval modal.");
  };

  const handleStartAuto = () => {
    alert("This would trigger the autonomous dispatch Cloud Function.");
  };

  const handleLogManual = () => {
    alert("This would open a modal to log manual contact.");
  };

  const handleReviewPrompt = () => {
    setShowApprovalModal(true);
  };

  if (phase === 'success' || phase === 'fail') {
    return (
      <div className="flex items-center justify-center p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-sm font-bold">
        Lead is in a terminal phase ({phase}). Chat is read-only.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {phase === 'initial' && (
          <>
            {executionMode === 'manual' && (
              <button onClick={handleMarkContacted} disabled={isSubmitting} className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                <CheckCircle size={18} /> Mark as Contacted
              </button>
            )}
            {executionMode === 'hybrid' && (
              <button onClick={handleInitiateAI} disabled={isSubmitting} className="w-full sm:w-auto px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                <Edit3 size={18} /> Initiate AI Contact
              </button>
            )}
            {executionMode === 'automatic' && (
              <button onClick={handleStartAuto} disabled={isSubmitting} className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                <Play size={18} /> Start Autonomous Loop
              </button>
            )}
          </>
        )}

        {phase === 'contacted' && (
          <>
            {executionMode === 'manual' && (
              <button onClick={handleLogManual} className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                <PlusCircle size={18} /> Log Manual Contact
              </button>
            )}
            {executionMode === 'hybrid' && pendingPromptApproval?.status === 'pending' && (
              <button onClick={handleReviewPrompt} className="w-full sm:w-auto px-6 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 animate-pulse">
                <AlertCircle size={18} /> Review Pending Prompt
              </button>
            )}
            {executionMode === 'hybrid' && (!pendingPromptApproval || pendingPromptApproval?.status !== 'pending') && (
              <button onClick={handleInitiateAI} disabled={isSubmitting} className="w-full sm:w-auto px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                <Edit3 size={18} /> Generate Next Prompt
              </button>
            )}
            {executionMode === 'automatic' && (
              <div className="w-full flex items-center justify-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-sm font-bold">
                <Loader2 size={18} className="animate-spin" />
                Autonomous loop is active. Monitoring for next action...
              </div>
            )}
          </>
        )}
      </div>

      {showApprovalModal && (
        <PromptApprovalModal 
          leadId={lead.id} 
          approval={pendingPromptApproval} 
          onClose={() => setShowApprovalModal(false)} 
        />
      )}
    </>
  );
};

export default ChatActionBar;
