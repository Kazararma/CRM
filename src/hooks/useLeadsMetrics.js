import { useMemo } from "react";

/**
 * useLeadsMetrics hook
 * A pure computation hook. Derives all metrics from the leads array.
 * Leads are pre-normalized by useLeads.js — phases always use new naming.
 * No Firestore calls are made here.
 */
export function useLeadsMetrics(leads) {
  return useMemo(() => {
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return {
        total: 0,
        hot: 0,
        neutral: 0,
        cold: 0,
        convertedCount: 0,
        totalProfit: 0,
        pending: 0,
        unqualified: 0,
      };
    }

    const active    = leads.filter(l => !l.isDeleted);
    // Converted = converted to opportunity (new) OR legacy converted to project (old)
    const converted = active.filter(l => l.isConvertedToOpportunity || l.isConverted);

    return {
      total:          active.length,
      hot:            active.filter(l => l.category === 'hot').length,
      neutral:        active.filter(l => l.category === 'neutral').length,
      cold:           active.filter(l => l.category === 'cold').length,
      convertedCount: converted.length,
      totalProfit:    converted.reduce((s, l) => s + (Number(l.finalBilling) || Number(l.estimatedBilling) || 0), 0),
      // Pending = active leads that are not terminal and not yet converted
      pending:        active.filter(l =>
        !l.isConvertedToOpportunity &&
        !l.isConverted &&
        l.phase !== 'unqualified'
      ).length,
      unqualified:    active.filter(l => l.phase === 'unqualified').length,
    };
  }, [leads]);
}
