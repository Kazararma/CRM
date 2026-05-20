import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  startAt,
  endAt
} from "firebase/firestore";
import { db } from "../firebase/config";
import { startOfMonth, endOfMonth, format } from "date-fns";

export const useShifts = (userId, currentMonth) => {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    setError(null);
    
    // We filter by date string "YYYY-MM-DD" which is stored in the doc
    const monthStartStr = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const monthEndStr = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const shiftsRef = collection(db, "users", userId, "shifts");
    const q = query(
      shiftsRef,
      where("date", ">=", monthStartStr),
      where("date", "<=", monthEndStr),
      orderBy("date", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shiftData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setShifts(shiftData);
      setLoading(false);
    }, (err) => {
      console.error("Date Click Fetch Error (Shifts):", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, currentMonth]);

  return { shifts, loading, error };
};
