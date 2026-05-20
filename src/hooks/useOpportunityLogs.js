import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * useOpportunityLogs hook
 *
 * Real-time listener for the `opportunity_logs` subcollection of a single
 * opportunity. Mirrors the useLeadLogs pattern exactly.
 *
 * Logs are ordered by createdAt descending (newest first).
 *
 * @param {string|null} opportunityId  - Firestore document ID of the opportunity
 * @returns {{ logs: Object[], loading: boolean }}
 */
export function useOpportunityLogs(opportunityId) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!opportunityId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'opportunities', opportunityId, 'opportunity_logs'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(
          snap.docs.map(d => ({
            logId: d.id,
            id:    d.id,
            ...d.data(),
          }))
        );
        setLoading(false);
      },
      (err) => {
        console.error('[useOpportunityLogs] onSnapshot error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [opportunityId]);

  return { logs, loading };
}
