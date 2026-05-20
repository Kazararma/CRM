import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  orderBy 
} from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * useWorkerSalaryView (Worker Hook)
 * All real-time data a worker needs to view their own salary status.
 */
export function useWorkerSalaryView(userId) {
  const [salaryConfig, setSalaryConfig] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    // 1. LISTENER: Own user document (for latest salary configuration)
    const unsubUser = onSnapshot(doc(db, "users", userId), (snap) => {
      setSalaryConfig(snap.data()?.salary || null);
    }, (err) => {
      console.error("Error fetching worker salary config:", err);
      setError(err);
    });

    // 2. LISTENER: Own payment transactions (History)
    const qTx = query(
      collection(db, "salary_transactions"),
      where("workerId", "==", userId),
      orderBy("paidAt", "desc")
    );

    const unsubTx = onSnapshot(qTx, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Error fetching worker transactions:", err);
      setError(err);
    });

    // 3. LISTENER: Own validated shifts (for current accrued pay)
    const qShifts = query(
      collection(db, "users", userId, "shifts"),
      where("isValidated", "==", true),
      where("status", "==", "completed")
    );

    const unsubShifts = onSnapshot(qShifts, (snap) => {
      const allShifts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter out already paid shifts
      setShifts(allShifts.filter(s => s.isPaid !== true));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching worker shifts:", err);
      setError(err);
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubTx();
      unsubShifts();
    };
  }, [userId]);

  // DERIVED STATE: The current active (unresolved) transaction, if any
  const activeTransaction = transactions.find((t) => !t.isResolved) || null;

  return { 
    salaryConfig, 
    transactions, 
    shifts, 
    activeTransaction, 
    loading, 
    error 
  };
}
