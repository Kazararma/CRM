import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  getDoc 
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { 
  LOCAL_STORAGE_SHIFT_KEY, 
  HEARTBEAT_INTERVAL_MS, 
  HEARTBEAT_GRACE_PERIOD_MS, 
  HEARTBEAT_CHECK_INTERVAL_MS 
} from "../config/shiftConfig";
import { format } from "date-fns";

const ShiftContext = createContext();

export const ShiftProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [shiftState, setShiftState] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [heartbeatRequired, setHeartbeatRequired] = useState(false);
  const [remainingGraceSeconds, setRemainingGraceSeconds] = useState(0);
  const [reconciliationError, setReconciliationError] = useState(null);
  const intervalRef = useRef(null);

  // Helper to clear local state
  const clearLocalShift = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_SHIFT_KEY);
    setShiftState(null);
    setElapsedSeconds(0);
    setHeartbeatRequired(false);
    setRemainingGraceSeconds(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  // Helper to ensure we have a Date object regardless of source (ISO string or Firestore Timestamp)
  const ensureDate = (dateVal) => {
    if (!dateVal) return new Date();
    if (typeof dateVal.toDate === "function") return dateVal.toDate();
    return new Date(dateVal);
  };

  // Heartbeat / Timer Logic
  const startTimer = useCallback((startTime, lastHeartbeat) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Tick every 1 second for a smooth UI display
    intervalRef.current = setInterval(() => {
      const now = new Date();
      const start = ensureDate(startTime);
      const last = ensureDate(lastHeartbeat);
      
      const elapsed = Math.floor((now - start) / 1000);
      setElapsedSeconds(elapsed);

      const timeSinceHeartbeat = now - last;
      const graceEndTime = HEARTBEAT_INTERVAL_MS + HEARTBEAT_GRACE_PERIOD_MS;

      if (timeSinceHeartbeat >= graceEndTime) {
        expireShift();
      } else if (timeSinceHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        setHeartbeatRequired(true);
        const remaining = Math.max(0, Math.floor((graceEndTime - timeSinceHeartbeat) / 1000));
        setRemainingGraceSeconds(remaining);
      } else {
        setHeartbeatRequired(false);
        setRemainingGraceSeconds(0);
      }
    }, 1000); // 1 second interval
  }, []);

  // Reconciliation with Firestore & Ghost Shift Cleanup
  useEffect(() => {
    if (!currentUser) {
      clearLocalShift();
      return;
    }

    const reconcileShifts = async () => {
      try {
        const { collection, query, where, getDocs, orderBy, limit } = await import("firebase/firestore");
        const shiftsRef = collection(db, "users", currentUser.uid, "shifts");
        const q = query(
          shiftsRef,
          where("status", "==", "active"),
          orderBy("startTime", "desc")
        );

        const snapshot = await getDocs(q);
        const activeShifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (activeShifts.length === 0) {
          clearLocalShift();
          return;
        }

        // Ghost Shift Cleanup & The 'Nuke Active' Rule
        if (activeShifts.length > 0) {
          const now = new Date();
          const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
          
          for (const s of activeShifts) {
            const start = ensureDate(s.startTime);
            const startDateStr = start.toLocaleDateString('en-CA');
            const isPreviousDay = startDateStr < todayStr;
            const msIn24Hours = 24 * 60 * 60 * 1000;
            const isTooOld = (now - start) > msIn24Hours;
            
            // The 'Nuke Active' Rule: Force expire if it's from a previous day OR > 24 hours old OR not the newest ghost
            if (isPreviousDay || isTooOld || (activeShifts.length > 1 && s.id !== activeShifts[0].id)) {
              console.warn(`Nuking stale shift ${s.id} (Prev Day: ${isPreviousDay}, Old: ${isTooOld})`);
              const ghostRef = doc(db, `users/${currentUser.uid}/shifts`, s.id);
              const last = ensureDate(s.lastHeartbeat || s.startTime);
              const estimatedEnd = new Date(last.getTime() + 60000); 
              const duration = Math.max(0, Math.round((estimatedEnd - start) / 60000));
              
              await updateDoc(ghostRef, {
                status: "expired",
                endTime: serverTimestamp(),
                durationMinutes: duration,
                // Removed redundant isValidated: false to preserve auto-validation
              });
            }
          }
          
          // Refresh after cleanup
          const refreshedSnapshot = await getDocs(q);
          const validActiveShifts = refreshedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          if (validActiveShifts.length === 0) {
            clearLocalShift();
            return;
          }

          const newest = validActiveShifts[0];
          const newestShift = {
            shiftId: newest.id,
            userId: newest.userId,
            startTime: ensureDate(newest.startTime).toISOString(),
            lastHeartbeat: ensureDate(newest.lastHeartbeat || newest.startTime).toISOString(),
            status: "active",
            projectId: newest.projectId || null
          };
          localStorage.setItem(LOCAL_STORAGE_SHIFT_KEY, JSON.stringify(newestShift));
          setShiftState(newestShift);
          startTimer(newestShift.startTime, newestShift.lastHeartbeat);
        }
      } catch (error) {
        console.warn("Shift Reconciliation Background Error:", error.message);
        if (error.message.includes("index") || error.message.includes("console.firebase.google.com")) {
          setReconciliationError(error.message);
        }
      }
    };

    reconcileShifts();
  }, [currentUser, clearLocalShift, startTimer]);

  const startShift = async (projectId = null) => {
    if (!currentUser) return;
    
    try {
      const newShiftPayload = {
        userId: currentUser.uid,
        startTime: serverTimestamp(),
        lastHeartbeat: serverTimestamp(),
        endTime: null,
        durationMinutes: 0,
        status: "active",
        isValidated: false,
        date: new Date().toLocaleDateString('en-CA'),
        projectId: projectId
      };

      console.log("HARD-LOCKED CREATION PAYLOAD:", newShiftPayload);
      
      const shiftsRef = collection(db, "users", currentUser.uid, "shifts");
      const docRef = await addDoc(shiftsRef, newShiftPayload);
      
      const localShift = {
        ...newShiftPayload,
        shiftId: docRef.id,
        startTime: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString()
      };

      localStorage.setItem(LOCAL_STORAGE_SHIFT_KEY, JSON.stringify(localShift));
      setShiftState(localShift);
      startTimer(localShift.startTime, localShift.lastHeartbeat);
      
      console.log("Shift successfully started and locked to unvalidated:", docRef.id);
    } catch (error) {
      console.error("Shift Creation Failed:", error);
      clearLocalShift();
    }
  };

  const confirmHeartbeat = async () => {
    if (!shiftState || !currentUser) return;

    const now = new Date();
    try {
      await updateDoc(doc(db, `users/${currentUser.uid}/shifts`, shiftState.shiftId), {
        lastHeartbeat: serverTimestamp()
      });

      const updatedShift = {
        ...shiftState,
        lastHeartbeat: now.toISOString()
      };

      localStorage.setItem(LOCAL_STORAGE_SHIFT_KEY, JSON.stringify(updatedShift));
      setShiftState(updatedShift);
      setHeartbeatRequired(false);
      startTimer(updatedShift.startTime, updatedShift.lastHeartbeat);
    } catch (error) {
      console.error("Error confirming heartbeat", error);
    }
  };

  const endShift = async () => {
    if (!shiftState || !currentUser) return;

    const now = new Date();
    const start = ensureDate(shiftState.startTime);
    const durationMinutes = Math.round((now - start) / 60000);

    try {
      await updateDoc(doc(db, `users/${currentUser.uid}/shifts`, shiftState.shiftId), {
        status: "completed",
        endTime: serverTimestamp(),
        durationMinutes: durationMinutes,
        // Removed redundant isValidated: false to preserve auto-validation
      });

      clearLocalShift();
    } catch (error) {
      console.error("Error ending shift", error);
    }
  };

  const expireShift = async () => {
    if (!shiftState || !currentUser) return;

    const last = ensureDate(shiftState.lastHeartbeat);
    const expireTime = new Date(last.getTime() + HEARTBEAT_GRACE_PERIOD_MS);
    const start = ensureDate(shiftState.startTime);
    const durationMinutes = Math.round((expireTime - start) / 60000);

    try {
      await updateDoc(doc(db, `users/${currentUser.uid}/shifts`, shiftState.shiftId), {
        status: "expired",
        endTime: expireTime,
        durationMinutes: Math.max(0, durationMinutes)
      });

      clearLocalShift();
    } catch (error) {
      console.error("Error expiring shift", error);
    }
  };

  return (
    <ShiftContext.Provider 
      value={{ 
        shiftState, 
        startShift, 
        endShift, 
        confirmHeartbeat, 
        elapsedSeconds, 
        heartbeatRequired,
        remainingGraceSeconds,
        reconciliationError
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
};

export const useShift = () => {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error("useShift must be used within a ShiftProvider");
  }
  return context;
};
