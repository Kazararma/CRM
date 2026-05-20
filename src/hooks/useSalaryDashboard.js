import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, collectionGroup } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * useSalaryDashboard (Admin Hook)
 * Opens and manages real-time Firestore listeners for the Admin Salary View.
 * 
 * Responsibilities:
 * 1. Syncs all worker profiles.
 * 2. Syncs all pending/disputed transactions for live badge overlays.
 */
export function useSalaryDashboard() {
  const [workers, setWorkers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [allShifts, setAllShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);

    // 1. LISTENER: All worker profiles
    // We fetch all users and filter in JS to handle case-insensitivity and role updates safely
    const qWorkers = collection(db, "users");

    const unsubWorkers = onSnapshot(qWorkers, (snap) => {
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // We now include everyone who can be paid (Workers, Admins, Super Admins)
      setWorkers(allUsers.filter(u => u.role)); 
    }, (err) => {
      console.error("Error fetching workers for salary dashboard:", err);
      setError(err);
    });

    // 2. LISTENER: All unresolved transactions (Pending or Disputed)
    const qTx = query(
      collection(db, "salary_transactions"),
      where("isResolved", "==", false)
    );

    const unsubTx = onSnapshot(qTx, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Error fetching active salary transactions:", err);
      setError(err);
    });

    // 3. LISTENER: All relevant shifts (to detect pending validation and liability)
    const qAllShifts = query(
      collectionGroup(db, "shifts"),
      where("status", "in", ["active", "completed", "expired"])
    );

    const unsubAllShifts = onSnapshot(qAllShifts, (snap) => {
      setAllShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching all shifts for tracker:", err);
      setLoading(false);
    });

    return () => {
      unsubWorkers();
      unsubTx();
      unsubAllShifts();
    };
  }, []);

  return { workers, transactions, allShifts, loading, error };
}
