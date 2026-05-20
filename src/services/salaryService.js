import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  writeBatch 
} from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * SALARY HANDSHAKE SERVICE
 * Handles the 3-step payment flow: Initiate (Admin) -> Confirm/Dispute (Worker) -> Resolve (Admin).
 */

/**
 * initiatePayment (Admin)
 * Creates a new salary_transactions document and optionally resolves a previous disputed one.
 */
export const initiatePayment = async ({
  worker,
  admin,
  computedData,
  salaryType,
  scope,
  shifts = [], // New: accept shifts to mark as paid
  previousDisputedTransactionId = null,
}) => {
  const batch = writeBatch(db);

  // 1. If re-issuing, resolve the old disputed transaction
  if (previousDisputedTransactionId) {
    const oldRef = doc(db, "salary_transactions", previousDisputedTransactionId);
    batch.update(oldRef, { 
      resolvedAt: serverTimestamp(),
      isResolved: true,
      status: "RESOLVED_REISSUE" 
    });
  }

  // 2. Mark all included shifts as PAID
  shifts.forEach((shift) => {
    const shiftRef = doc(db, "users", worker.id, "shifts", shift.id);
    batch.update(shiftRef, { isPaid: true, paidAt: serverTimestamp() });
  });

  // 3. Create the new transaction document
  const newTxRef = doc(collection(db, "salary_transactions"));
  batch.set(newTxRef, {
    transactionId: newTxRef.id,
    workerId: worker.id,
    workerName: worker.displayName,
    adminId: admin.uid,
    adminName: admin.displayName,
    salaryType,
    scope: {
      projectId: scope.projectId || null,
      projectName: scope.projectName || null,
      periodMonth: scope.periodMonth || null,
      periodStart: scope.periodStart || null,
      periodEnd: scope.periodEnd || null,
    },
    amountPaid: computedData.totalPayable,
    hoursLogged: computedData.totalHours || 0,
    breakdown: {
      basePay: computedData.basePay ?? null,
      overtimeHours: computedData.overtimeHours ?? null,
      overtimePay: computedData.overtimePay ?? null,
      daysWorked: computedData.daysWorked ?? null,
      hourlyRate: computedData.hourlyRate ?? null,
      projectBreakdown: shifts.reduce((acc, s) => {
        const existing = acc.find(p => p.projectId === s.projectId);
        const hours = (Number(s.durationMinutes) || 0) / 60;
        
        let rate = 0;
        if (salaryType === 'hourly') rate = computedData.hourlyRate || 0;
        if (salaryType === 'project') rate = worker.salary?.project?.baseRatePerHour || 0;
        
        if (existing) {
          existing.totalHours += hours;
          existing.amount += hours * rate;
        } else {
          acc.push({
            projectId: s.projectId,
            projectName: s.projectName || "General Work",
            totalHours: hours,
            amount: hours * rate
          });
        }
        return acc;
      }, [])
    },
    status: "PENDING_CONFIRMATION",
    paidAt: serverTimestamp(),
    confirmedAt: null,
    disputedAt: null,
    disputeNote: null,
    resolvedAt: null,
    isResolved: false,
  });

  await batch.commit();
  return newTxRef.id;
};

/**
 * confirmSalaryReceived (Worker)
 * Worker marks the payment as received. Case closed.
 */
export const confirmSalaryReceived = async (transactionId) => {
  const txRef = doc(db, "salary_transactions", transactionId);
  return await updateDoc(txRef, {
    status: "PAID",
    confirmedAt: serverTimestamp(),
    isResolved: true,
  });
};

/**
 * disputePayment (Worker)
 * Worker reports that the money was not received.
 */
export const disputePayment = async (transactionId, note = "") => {
  const txRef = doc(db, "salary_transactions", transactionId);
  return await updateDoc(txRef, {
    status: "DISPUTED",
    disputedAt: serverTimestamp(),
    disputeNote: note.trim() || null,
    isResolved: false,
  });
};
