import React from 'react';
import { formatINR } from '../../utils/formatCurrency';
import { format } from 'date-fns';
import { Calendar, User, Layers, XCircle, RotateCcw } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

// ── Phase pill configuration covering all 10 opportunity phases ───────────────
const PHASE_PILL_CONFIG = {
  prospecting:         { label: 'Prospecting',         bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
  qualification:       { label: 'Qualification',       bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
  needs_analysis:      { label: 'Needs Analysis',      bg: 'bg-blue-50',     text: 'text-blue-600',    dot: 'bg-blue-400'    },
  value_proposition:   { label: 'Value Proposition',   bg: 'bg-blue-50',     text: 'text-blue-600',    dot: 'bg-blue-400'    },
  decision_makers:     { label: 'Decision Makers',     bg: 'bg-blue-50',     text: 'text-blue-600',    dot: 'bg-blue-400'    },
  perception_analysis: { label: 'Perception Analysis', bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400'   },
  proposal:            { label: 'Proposal',             bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400'   },
  negotiation_review:  { label: 'Negotiation',         bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400'   },
  closed_won:          { label: 'Closed Won',           bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  closed_lost:         { label: 'Closed Lost',          bg: 'bg-red-50',      text: 'text-red-600',     dot: 'bg-red-400'     },
};

// Stage index for the progress bar (1–10)
const PHASE_ORDER = [
  'prospecting', 'qualification', 'needs_analysis', 'value_proposition',
  'decision_makers', 'perception_analysis', 'proposal', 'negotiation_review',
  'closed_won', 'closed_lost',
];

/**
 * OpportunityPhasePill
 * A compact coloured badge showing the current opportunity stage.
 */
export const OpportunityPhasePill = ({ phase }) => {
  const config = PHASE_PILL_CONFIG[phase] || PHASE_PILL_CONFIG.prospecting;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-current/10 ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
};

/**
 * OpportunityCard
 * Clickable card rendered inside the Kanban columns.
 */
const OpportunityCard = ({ opportunity: opp, onClick }) => {
  const { currentUser, userProfile } = useAuth();
  
  // Pipeline value: prefer negotiated amount, fall back to proposal ask
  const pipelineValue =
    opp.negotiationReview?.moneyAgreedByClient ||
    opp.proposal?.moneyAskedFromClient ||
    0;

  const isWon  = opp.phase === 'closed_won';
  const isLost = opp.phase === 'closed_lost';

  // Format creation date safely
  let createdDateStr = '';
  if (opp.createdAt) {
    try {
      const d = opp.createdAt.toDate ? opp.createdAt.toDate() : new Date(opp.createdAt);
      createdDateStr = format(d, 'dd MMM yyyy');
    } catch { /* noop */ }
  }

  // Stage progress (0–100%)
  const stageIdx  = PHASE_ORDER.indexOf(opp.phase);
  const progress  = stageIdx < 0 ? 0 : Math.round(((stageIdx + 1) / 10) * 100);

  // ── Quick Action: Toggle Failed State ──────────────────────────────────────
  const handleToggleFailed = async (e) => {
    e.stopPropagation(); // Don't open the modal
    if (isWon) return; // Cannot toggle closed_won

    try {
      if (!isLost) {
        // Mark as failed
        await updateDoc(doc(db, 'opportunities', opp.id), {
          phase: 'closed_lost',
          'closedLost.previousPhase': opp.phase,
          'closedLost.lostDate': serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
        });
        
        await addDoc(collection(db, 'opportunities', opp.id, 'opportunity_logs'), {
          content: `Opportunity marked as Failed (Closed Lost) via quick action by ${userProfile?.displayName || currentUser.email}.`,
          phase: 'closed_lost',
          loggedBy: currentUser.uid,
          loggerName: userProfile?.displayName || currentUser.email,
          createdAt: serverTimestamp(),
          attachments: [],
        });
      } else {
        // Revert to active
        const prevPhase = opp.closedLost?.previousPhase || 'prospecting';
        await updateDoc(doc(db, 'opportunities', opp.id), {
          phase: prevPhase,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
        });

        await addDoc(collection(db, 'opportunities', opp.id, 'opportunity_logs'), {
          content: `Opportunity reverted to Active (Phase: ${prevPhase}) via quick action by ${userProfile?.displayName || currentUser.email}.`,
          phase: prevPhase,
          loggedBy: currentUser.uid,
          loggerName: userProfile?.displayName || currentUser.email,
          createdAt: serverTimestamp(),
          attachments: [],
        });
      }
    } catch (err) {
      console.error('Error toggling failed state:', err);
      alert('Failed to update opportunity state.');
    }
  };

  return (
    <div
      onClick={onClick}
      className={`relative bg-white p-4 rounded-2xl shadow-sm border cursor-pointer
        transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group overflow-hidden
        ${isLost ? 'opacity-60 border-red-200 bg-red-50/10' : 'border-gray-100'}
        ${isWon  ? 'border-emerald-100' : ''}
      `}
    >
      {/* Converted to Project ribbon */}
      {isWon && opp.closedWon?.isConvertedToProject && (
        <div className="absolute top-3 right-[-32px] rotate-45 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest py-1 px-10 shadow-sm z-10">
          ✓ Converted
        </div>
      )}

      <div className="flex flex-col h-full gap-2">
        {/* Phase pill & Quick Action */}
        <div className="flex items-start justify-between gap-2">
          <OpportunityPhasePill phase={opp.phase} />
          
          {!isWon && (
            <button 
              onClick={handleToggleFailed}
              className={`p-1.5 rounded-lg border transition-colors flex shrink-0 ${
                isLost 
                  ? 'bg-red-100 text-red-600 border-red-200 hover:bg-red-200 shadow-sm' 
                  : 'bg-white text-gray-400 border-gray-100 hover:text-red-500 hover:bg-red-50 hover:border-red-200 opacity-0 group-hover:opacity-100'
              }`}
              title={isLost ? 'Revert to Active' : 'Mark as Failed'}
            >
              {isLost ? <RotateCcw size={14} /> : <XCircle size={14} />}
            </button>
          )}
        </div>

        {/* Title */}
        <h4 className={`font-bold text-sm line-clamp-2 leading-snug transition-colors ${isLost ? 'text-gray-800' : 'text-gray-900 group-hover:text-blue-600'}`}>
          {opp.title || opp.qualification?.projectTitle || 'Untitled Opportunity'}
        </h4>

        {/* Client */}
        <p className="flex items-center gap-1 text-xs text-gray-500 font-medium truncate">
          <User size={11} className="shrink-0 text-gray-400" />
          {opp.clientName || 'Unknown Client'}
        </p>

        {/* Stage progress bar */}
        <div className="mt-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Layers size={9} /> Stage {Math.max(1, stageIdx + 1)}/10
            </span>
            <span className="text-[9px] font-bold text-gray-400">{progress}%</span>
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isWon  ? 'bg-emerald-500' :
                isLost ? 'bg-red-400' :
                stageIdx >= 5 ? 'bg-amber-400' :
                stageIdx >= 2 ? 'bg-blue-500' :
                'bg-slate-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-50">
          <span className={`text-sm font-black ${isWon ? 'text-emerald-600' : isLost ? 'text-gray-600 line-through decoration-red-400 decoration-2 opacity-70' : 'text-gray-900'}`}>
            {formatINR(pipelineValue)}
          </span>
          {createdDateStr && (
            <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
              <Calendar size={10} />
              {createdDateStr}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpportunityCard;
