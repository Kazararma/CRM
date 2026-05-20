import React, { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { OPPORTUNITY_PHASES, advanceOpportunityPhase } from '../../services/opportunitiesService';
import { useAuth } from '../../context/AuthContext';

const PhaseAdvanceControls = ({ opportunity }) => {
  const { currentUser, userProfile } = useAuth();
  const [advancing, setAdvancing] = useState(false);

  const currentIdx = OPPORTUNITY_PHASES.indexOf(opportunity.phase);
  
  // Can't move if we don't know the phase, or if it's terminal (index >= 8: closed_won, closed_lost)
  if (currentIdx < 0 || currentIdx >= 8) return null;
  // If the opportunity is locked (converted), don't show controls
  if (opportunity.closedWon?.isConvertedToProject) return null;

  const handleAdvance = async (direction) => {
    const nextIdx = currentIdx + direction;
    if (nextIdx < 0 || nextIdx >= OPPORTUNITY_PHASES.length) return;
    
    setAdvancing(true);
    try {
      await advanceOpportunityPhase(
        opportunity.id,
        OPPORTUNITY_PHASES[nextIdx],
        currentUser.uid,
        userProfile?.displayName || currentUser.email
      );
    } catch (e) {
      console.error('Failed to advance phase', e);
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {currentIdx > 0 && (
        <button
          onClick={() => handleAdvance(-1)}
          disabled={advancing}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
        >
          <ArrowLeft size={16} /> Previous Stage
        </button>
      )}
      <button
        onClick={() => handleAdvance(1)}
        disabled={advancing}
        className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 flex items-center gap-2 shadow-md shadow-blue-200 transition-colors disabled:opacity-50"
      >
        {advancing ? 'Moving…' : 'Next Stage'} <ArrowRight size={16} />
      </button>
    </div>
  );
};

export default PhaseAdvanceControls;
