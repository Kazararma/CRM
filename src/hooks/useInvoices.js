import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Real-time listener for the invoices collection.
 * Filters out soft-deleted invoices.
 * Optionally filters by projectId for project-scoped views.
 *
 * @param {{ projectId?: string | null, status?: string | null }} filters
 * @returns {{ invoices, loading, error }}
 */
export function useInvoices(filters = {}) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const constraints = [
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
    ];

    if (filters.projectId !== undefined) {
      constraints.unshift(where('projectId', '==', filters.projectId));
    }
    if (filters.status) {
      constraints.unshift(where('status', '==', filters.status));
    }

    const q = query(collection(db, 'invoices'), ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        setInvoices(snap.docs.map(d => ({ invoiceId: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useInvoices]', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [filters.projectId, filters.status]);

  return { invoices, loading, error };
}
