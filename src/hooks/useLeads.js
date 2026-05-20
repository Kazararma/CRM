import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { normalizeLead } from "../utils/leadPhaseNormalizer";

// Helper: resolve a TimeframeFilter object to { fromDate, toDate } Date objects
function resolveDateRange(filter) {
  const now = new Date();
  
  if (!filter || filter.mode === 'this_month') {
    return {
      fromDate: new Date(now.getFullYear(), now.getMonth(), 1),
      toDate:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    };
  }
  if (filter.mode === 'last_month') {
    return {
      fromDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      toDate:   new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    };
  }
  if (filter.mode === 'last_3_months') {
    const from = new Date(now);
    from.setMonth(from.getMonth() - 3);
    return { fromDate: from, toDate: now };
  }
  if (filter.mode === 'custom' && filter.fromDate && filter.toDate) {
    return { fromDate: filter.fromDate, toDate: filter.toDate };
  }
  
  // Fallback to this month
  return {
    fromDate: new Date(now.getFullYear(), now.getMonth(), 1),
    toDate:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

/**
 * useLeads hook
 * Fetches leads based on timeframe filter and handles real-time updates.
 */
export function useLeads(timeframeFilter) {
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const { fromDate, toDate } = resolveDateRange(timeframeFilter);

    const q = query(
      collection(db, 'leads'),
      where('isDeleted',  '==', false),
      where('createdAt',  '>=', Timestamp.fromDate(fromDate)),
      where('createdAt',  '<=', Timestamp.fromDate(toDate)),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setLeads(snap.docs.map(d => normalizeLead({ leadId: d.id, id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useLeads]', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [timeframeFilter]); // Re-subscribes whenever the filter changes

  return { leads, loading, error };
}
