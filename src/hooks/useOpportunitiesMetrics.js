import { useMemo } from 'react';

// ── Phase display metadata (matches blueprint §3.2) ───────────────────────────
export const OPPORTUNITY_PHASE_META = [
  { value: 'prospecting',          label: 'Prospecting',          group: 'active' },
  { value: 'qualification',        label: 'Qualification',        group: 'active' },
  { value: 'needs_analysis',       label: 'Needs Analysis',       group: 'active' },
  { value: 'value_proposition',    label: 'Value Proposition',    group: 'active' },
  { value: 'decision_makers',      label: 'Decision Makers',      group: 'active' },
  { value: 'perception_analysis',  label: 'Perception Analysis',  group: 'active' },
  { value: 'proposal',             label: 'Proposal',             group: 'active' },
  { value: 'negotiation_review',   label: 'Negotiation & Review', group: 'active' },
  { value: 'closed_won',           label: 'Closed Won',           group: 'won'    },
  { value: 'closed_lost',          label: 'Closed Lost',          group: 'lost'   },
];

export const ACTIVE_PHASES = OPPORTUNITY_PHASE_META
  .filter(p => p.group === 'active')
  .map(p => p.value);

/**
 * Derives the pipeline value for a single opportunity.
 * Prefers the negotiated amount; falls back to the proposal ask.
 *
 * @param {Object} opp
 * @returns {number}
 */
function getPipelineValue(opp) {
  return (
    opp.negotiationReview?.moneyAgreedByClient  ||
    opp.proposal?.moneyAskedFromClient          ||
    0
  );
}

/**
 * useOpportunitiesMetrics hook
 *
 * Pure memoized computation — zero extra Firestore calls.
 * Consumes the normalized opportunities array from useOpportunities.
 *
 * Derived metrics:
 *  - total               Total opportunity count
 *  - hot / neutral / cold  Count per category
 *  - activePipelineCount  Opportunities not yet closed (neither won nor lost)
 *  - closedWonCount       Opportunities in closed_won phase
 *  - closedLostCount      Opportunities in closed_lost phase
 *  - convertedToProject   Opportunities already handed off to a project
 *  - totalPipelineValue   Sum of pipeline values across all non-lost opportunities
 *  - closedWonValue       Sum of pipeline values for closed_won opportunities
 *  - stageFunnel          { [phaseValue]: count } map for all 10 phases
 *
 * @param {Object[]} opportunities  - Array from useOpportunities()
 * @returns {Object}                - Metric object
 */
export function useOpportunitiesMetrics(opportunities) {
  return useMemo(() => {
    const EMPTY = {
      total:               0,
      hot:                 0,
      neutral:             0,
      cold:                0,
      activePipelineCount: 0,
      closedWonCount:      0,
      closedLostCount:     0,
      convertedToProject:  0,
      totalPipelineValue:  0,
      closedWonValue:      0,
      stageFunnel:         Object.fromEntries(
        OPPORTUNITY_PHASE_META.map(p => [p.value, 0])
      ),
    };

    if (!Array.isArray(opportunities) || opportunities.length === 0) {
      return EMPTY;
    }

    const active = opportunities.filter(o => !o.isDeleted);

    // ── Category counts ───────────────────────────────────────────────────────
    const hot     = active.filter(o => o.category === 'hot').length;
    const neutral = active.filter(o => o.category === 'neutral').length;
    const cold    = active.filter(o => o.category === 'cold').length;

    // ── Phase counts ──────────────────────────────────────────────────────────
    const closedWon  = active.filter(o => o.phase === 'closed_won');
    const closedLost = active.filter(o => o.phase === 'closed_lost');
    const inPipeline = active.filter(o => ACTIVE_PHASES.includes(o.phase));

    const convertedToProject = closedWon.filter(
      o => o.closedWon?.isConvertedToProject === true
    ).length;

    // ── Pipeline value ────────────────────────────────────────────────────────
    // All non-lost opportunities contribute to the pipeline value
    const nonLost = active.filter(o => o.phase !== 'closed_lost');
    const totalPipelineValue = nonLost.reduce(
      (sum, o) => sum + getPipelineValue(o), 0
    );

    const closedWonValue = closedWon.reduce(
      (sum, o) => sum + getPipelineValue(o), 0
    );

    // ── Stage funnel map ──────────────────────────────────────────────────────
    const stageFunnel = Object.fromEntries(
      OPPORTUNITY_PHASE_META.map(p => [p.value, 0])
    );
    active.forEach(o => {
      if (o.phase && stageFunnel.hasOwnProperty(o.phase)) {
        stageFunnel[o.phase] += 1;
      }
    });

    return {
      total:               active.length,
      hot,
      neutral,
      cold,
      activePipelineCount: inPipeline.length,
      closedWonCount:      closedWon.length,
      closedLostCount:     closedLost.length,
      convertedToProject,
      totalPipelineValue,
      closedWonValue,
      stageFunnel,
    };
  }, [opportunities]);
}
