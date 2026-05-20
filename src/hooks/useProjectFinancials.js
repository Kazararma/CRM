import { useState, useEffect, useMemo } from "react";
import { doc, query, where, onSnapshot, collectionGroup } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "./useAuth";
import { useUsers } from "./useUsers";
import { computeProjectSalary, computeMonthlySalary, computeHourlySalary, normalizeSalaryConfig } from "../utils/salaryEngine";

/**
 * HOOK: useProjectFinancials
 * Fully reactive hook that listens to the project document and its validated shifts.
 * Now integrates with useUsers to react to salary changes dynamically.
 * FIXED: Only calculates labor cost for workers/admins CURRENTLY assigned to the project.
 */
export const useProjectFinancials = (projectId) => {
  const { role } = useAuth();
  const { users } = useUsers();
  
  const [liveProject, setLiveProject] = useState(null);
  const [baseExpenses, setBaseExpenses] = useState(0);
  const [validatedShifts, setValidatedShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // STRICT GUARD: Prevent Firebase path errors
  const isValidId = projectId && typeof projectId === 'string';

  useEffect(() => {
    if (!isValidId || (role !== "admin" && role !== "super_admin")) {
      setLoading(false);
      return;
    }

    // LISTENER 1: Project Document & Overhead Expenses
    const unsubProject = onSnapshot(doc(db, "projects", projectId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLiveProject({ id: snap.id, ...data });
        const expenses = (data.expenses || []).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
        setBaseExpenses(expenses);
      }
    }, (err) => {
      console.error("Project Financial Listener Error:", err);
      setError(err.message);
    });

    // LISTENER 2: Validated Shifts
    const q = query(
      collectionGroup(db, "shifts"),
      where("projectId", "==", projectId),
      where("isValidated", "==", true)
    );

    const unsubShifts = onSnapshot(q, (snapshot) => {
      setValidatedShifts(snapshot.docs.map(d => d.data()));
      setLoading(false);
    }, (err) => {
      console.error("Shifts Financial Listener Error:", err);
      if (err.message.includes("index")) setError("Index required for labor calculation.");
    });

    return () => {
      unsubProject();
      unsubShifts();
    };
  }, [projectId, role, isValidId]);

  // REFACTORED: Compute Labor Cost using the new Salary Engine
  const totalLaborCost = useMemo(() => {
    if (!liveProject || !users.length || !validatedShifts.length) return 0;

    const assignedIds = [
      ...(liveProject.assignedWorkers || []),
      ...(liveProject.assignedAdmins || [])
    ];

    let total = 0;

    assignedIds.forEach(uid => {
      const worker = users.find(u => u.id === uid);
      if (!worker) return;

      const salary = normalizeSalaryConfig(worker);
      if (!salary.isConfigured) return;

      const workerShifts = validatedShifts.filter(s => s.userId === uid);
      if (!workerShifts.length) return;

      let result = { totalPayable: 0, grandTotalPayable: 0, amountPayable: 0 };

      if (salary.type === 'project') {
        result = computeProjectSalary(salary.project, workerShifts);
      } else if (salary.type === 'monthly') {
        result = computeMonthlySalary(salary.monthly, workerShifts);
      } else if (salary.type === 'hourly') {
        result = computeHourlySalary(salary.hourly, workerShifts);
      }

      total += (result.totalPayable || result.grandTotalPayable || result.amountPayable || 0);
    });

    return total;
  }, [validatedShifts, users, liveProject]);

  const grandTotal = baseExpenses + totalLaborCost;

  return { 
    liveProject, 
    baseExpenses, 
    totalLaborCost, 
    grandTotal, 
    loading, 
    error 
  };
};
