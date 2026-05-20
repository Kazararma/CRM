import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * useLeadLogs hook
 * Fetches real-time subcollection of lead logs for a specific lead.
 */
export function useLeadLogs(leadId) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = onSnapshot(
      query(
        collection(db, 'leads', leadId, 'lead_logs'),
        orderBy('createdAt', 'desc')
      ),
      (snap) => {
        setLogs(snap.docs.map(d => ({ logId: d.id, id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => {
        console.error('[useLeadLogs]', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [leadId]);

  return { logs, loading };
}
