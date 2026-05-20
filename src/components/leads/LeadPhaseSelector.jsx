import React from 'react';
import { ChevronRight, Lock } from 'lucide-react';

/**
 * LEAD_PHASES — canonical list of all phases in display order.
 * Values match new Firestore naming. Legacy docs are normalized by useLeads.js
 * before reaching this component, so we never need to handle old names here.
 */
export const LEAD_PHASES = [
  { value: 'open',        label: 'Open',        color: 'gray'  },
  { value: 'contacted',   label: 'Contacted',   color: 'blue'  },
  { value: 'qualified',   label: 'Qualified',   color: 'green' },
  { value: 'unqualified', label: 'Unqualified', color: 'red'   },
];

/**
 * LEAD_PHASE_TRANSITIONS — kept for blueprint reference, not enforced in UI.
 * Free switching is allowed; only conversion lock enforces restrictions.
 */
export const LEAD_PHASE_TRANSITIONS = {
  open:        ['contacted', 'unqualified'],
  contacted:   ['qualified', 'unqualified'],
  qualified:   [],
  unqualified: [],
};

const ACTIVE_COLORS = {
  gray:  'bg-gray-600    text-white border-gray-700    shadow-md',
  blue:  'bg-blue-600    text-white border-blue-700    shadow-md',
  green: 'bg-emerald-600 text-white border-emerald-700 shadow-md',
  red:   'bg-red-600     text-white border-red-700     shadow-md',
};

const IDLE_COLORS = {
  gray:  'bg-white text-gray-600    border-gray-200    hover:bg-gray-50    hover:border-gray-400',
  blue:  'bg-white text-blue-600    border-blue-200    hover:bg-blue-50    hover:border-blue-400',
  green: 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400',
  red:   'bg-white text-red-600     border-red-200     hover:bg-red-50     hover:border-red-400',
};

/**
 * LeadPhaseSelector
 *
 * All phases are always visible. Clicking any non-current phase switches to it.
 * The entire selector is locked (read-only) only when the lead is converted
 * to an Opportunity (isConvertedToOpportunity === true).
 *
 * Props:
 *   currentPhase             – normalized phase string
 *   isConvertedToOpportunity – boolean — locks the selector when true
 *   isConverted              – legacy prop, treated as lock too
 *   onPhaseChange            – (newPhase: string) => void
 *   isSubmitting             – boolean
 */
const LeadPhaseSelector = ({
  currentPhase,
  isConvertedToOpportunity,
  isConverted,
  onPhaseChange,
  isSubmitting,
}) => {
  // Only lock when the lead has been converted to an Opportunity (or legacy project)
  const isLocked = !!(isConvertedToOpportunity || isConverted);

  return (
    <div className="flex flex-col space-y-1.5">
      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">
        Phase
      </label>

      <div className="flex items-center flex-wrap gap-1.5">
        {LEAD_PHASES.map((phase, idx) => {
          const isCurrent  = currentPhase === phase.value;
          const isDisabled = isLocked || isSubmitting;

          let cls = 'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ';

          if (isCurrent) {
            cls += ACTIVE_COLORS[phase.color];
          } else if (isDisabled) {
            cls += 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed opacity-50';
          } else {
            cls += IDLE_COLORS[phase.color] + ' cursor-pointer shadow-sm';
          }

          return (
            <React.Fragment key={phase.value}>
              <button
                disabled={isDisabled || isCurrent}
                onClick={() => onPhaseChange(phase.value)}
                className={cls}
                title={isCurrent ? 'Current phase' : `Switch to ${phase.label}`}
              >
                {phase.label}
              </button>

              {/* Chevron between pills (not after last) */}
              {idx < LEAD_PHASES.length - 1 && (
                <ChevronRight size={13} className="text-gray-300 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Conversion lock indicator */}
      {isLocked && (
        <span className="text-xs font-bold text-emerald-600 px-1 flex items-center gap-1 mt-0.5">
          <Lock size={11} /> Locked — Converted to Opportunity
        </span>
      )}
    </div>
  );
};

export default LeadPhaseSelector;
