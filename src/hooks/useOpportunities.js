import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * useOpportunities hook
 *
 * Real-time listener on the `opportunities` collection.
 * - Filters out soft-deleted documents (isDeleted: false).
 * - Orders by updatedAt descending so the most recently touched opp is first.
 * - No category or phase filter here — derived views are handled by
 *   useOpportunitiesMetrics and the Kanban board component.
 *
 * @returns {{ opportunities: Object[], loading: boolean, error: string|null }}
 */
export function useOpportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'opportunities'),
      where('isDeleted', '==', false),
      orderBy('updatedAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setOpportunities(
          snap.docs.map(d => ({
            opportunityId: d.id,
            id:            d.id,   // convenience alias
            ...d.data(),
          }))
        );
        setLoading(false);
      },
      (err) => {
        console.error('[useOpportunities] onSnapshot error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []); // No dependencies — collection-wide listener, no filter params

  return { opportunities, loading, error };
}
