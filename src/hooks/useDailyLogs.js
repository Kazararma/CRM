import { useState, useEffect } from "react";
import { 
  collectionGroup, 
  query, 
  where, 
  getDocs,
  orderBy
} from "firebase/firestore";
import { db } from "../firebase/config";
import { format } from "date-fns";

export const useDailyLogs = (userId, date) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId || !date) return;

    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      const dateStr = format(date, "yyyy-MM-dd");
      
      try {
        const q = query(
          collectionGroup(db, "workLogs"),
          where("authorUid", "==", userId)
        );

        const snapshot = await getDocs(q);
        const logData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter(log => {
          const logDateValue = log.createdAt || log.date;
          if (!logDateValue) return false;
          
          const logDate = logDateValue.toDate ? logDateValue.toDate() : new Date(logDateValue);
          if (isNaN(logDate.getTime())) return false;
          
          const year = logDate.getFullYear();
          const month = String(logDate.getMonth() + 1).padStart(2, '0');
          const day = String(logDate.getDate()).padStart(2, '0');
          const logDateStr = `${year}-${month}-${day}`;

          return logDateStr === dateStr;
        });

        console.log("Daily Logs Debug:", { 
          userId, 
          targetDate: dateStr, 
          matchingLogs: logData.length 
        });

        setLogs(logData);
      } catch (err) {
        console.error("Date Click Fetch Error (Logs):", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [userId, date]);

  return { logs, loading, error };
};
