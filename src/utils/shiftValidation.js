import { 
  collectionGroup, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Strict 1-to-1 Session Validation: Matches by associatedShiftId only.
 */
export const validateShiftsForUser = async (userId, shifts) => {
  try {
    if (!shifts || shifts.length === 0) return;

    // 1. Fetch ALL logs for this worker
    const logsQuery = query(
      collectionGroup(db, "workLogs"),
      where("authorUid", "==", userId)
    );
    const logsSnapshot = await getDocs(logsQuery);
    const logs = logsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Escape if no logs exist
    if (!logs || logs.length === 0) {
      return false;
    }

    console.log(`Strict 1-to-1 Validation Scan: Found ${logs.length} logs.`);

    // 2. Perform Match by Shift ID
    for (const shift of shifts) {
      if (shift.isValidated === true) continue;

      const match = logs.find(log => {
        const isMatch = log.associatedShiftId === shift.id;
        
        console.table({ 
          'Shift ID': shift.id, 
          'Assoc Shift ID': log.associatedShiftId, 
          'IDs Match': isMatch 
        });

        return isMatch;
      });

      // 3. Force Persistent Update on ID match
      if (match) {
        console.log(`Strict ID Match Found! Validating shift: ${shift.id}`);
        const shiftRef = doc(db, "users", userId, "shifts", shift.id);
        await updateDoc(shiftRef, {
          isValidated: true,
          validationDate: serverTimestamp()
        });
      }
    }

    return true;
  } catch (error) {
    console.error("Shift Validation Error:", error);
    return false;
  }
};
