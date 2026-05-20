import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * useWorkerShifts (Hook)
 * Fetches all validated, completed shifts for a specific worker.
 * Used inside AdminWorkerSalaryCard to calculate real-time payroll.
 */
export function useWorkerShifts(workerId) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workerId) {
      setShifts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "users", workerId, "shifts"),
      where("status", "==", "completed"),
      orderBy("date", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const allShifts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter out already paid shifts
      setShifts(allShifts.filter(s => s.isPaid !== true));
      setLoading(false);
    }, (err) => {
      console.error(`Error fetching shifts for worker ${workerId}:`, err);
      setLoading(false);
    });

    return () => unsub();
  }, [workerId]);

  return { shifts, loading };
}
