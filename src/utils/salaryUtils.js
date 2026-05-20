import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc 
} from "firebase/firestore";
import { db } from "../firebase/config";
import { startOfMonth, endOfMonth, format } from "date-fns";

/**
 * HOURLY CALCULATOR ENGINE
 * Calculates total pay for a worker on an hourly salaryType.
 * Only includes shifts with isValidated == true.
 */
export const calculateHourlyPay = async (workerId, targetMonth, targetYear) => {
  try {
    // 1. Fetch worker profile and validate Salary Type
    const userRef = doc(db, "users", workerId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return { error: "Worker document not found" };
    }

    const userData = userSnap.data();
    
    // VALIDATION GATE: Strictly for hourly workers
    if (userData.salaryType !== "hourly") {
      return { 
        error: `Worker salary type is '${userData.salaryType}', not 'hourly'.`,
        totalMinutes: 0,
        totalHours: 0,
        totalPay: 0,
        shiftCount: 0
      };
    }

    const hourlyRate = Number(userData.hourlyRate || 0);

    // 2. Query Validated Shifts
    const shiftsRef = collection(db, "users", workerId, "shifts");
    const q = query(
      shiftsRef,
      where("isValidated", "==", true)
    );

    const querySnapshot = await getDocs(q);
    
    let totalMinutes = 0;
    let shiftCount = 0;

    // 3. Filter and Sum by target month/year
    querySnapshot.docs.forEach(docSnap => {
      const shift = docSnap.data();
      let shiftDate;

      try {
        // Robust date extraction
        if (shift.startTime?.toDate) {
          shiftDate = shift.startTime.toDate();
        } else if (shift.startTime) {
          shiftDate = new Date(shift.startTime);
        } else if (shift.date) {
          shiftDate = new Date(shift.date);
        }

        // Check if it falls within the target period
        if (shiftDate && 
            !isNaN(shiftDate.getTime()) &&
            shiftDate.getMonth() === targetMonth && 
            shiftDate.getFullYear() === targetYear) {
          totalMinutes += Number(shift.durationMinutes || 0);
          shiftCount++;
        }
      } catch (dateErr) {
        console.error("Error processing shift date for worker:", workerId, dateErr);
      }
    });

    // 4. The Math
    const totalHours = totalMinutes / 60; 
    const grossPay = totalHours * hourlyRate;

    // 5. Final Return Object
    return {
      workerName: userData.displayName || "Worker",
      totalMinutes: Number(totalMinutes),
      totalHours: Number(totalHours.toFixed(4)),
      hourlyRate: Number(hourlyRate),
      totalPay: Number(grossPay.toFixed(2)), 
      shiftCount: Number(shiftCount),
      period: format(new Date(targetYear, targetMonth), "MMMM yyyy")
    };
  } catch (error) {
    console.error("Hourly Calculation Engine Error:", error);
    throw error;
  }
};

/**
 * MONTHLY PROGRESS CALCULATOR (20-Day Cycle)
 * A day is 'Qualified' if total validated minutes >= 360 (6 hours).
 * Payout is pro-rated based on 20 target days.
 */
export const calculateMonthlyProgress = async (workerId, targetMonth, targetYear) => {
  try {
    const userRef = doc(db, "users", workerId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return { error: "User not found" };
    const userData = userSnap.data();
    
    if (userData.salaryType !== "monthly") {
      return { 
        error: "Worker is not on a monthly salary model",
        qualifiedDays: 0,
        totalPay: 0,
        progressPercent: 0
      };
    }

    const monthlySalary = Number(userData.monthlySalary || 0);
    const targetDays = 20;

    // 1. Fetch Validated Shifts
    const shiftsRef = collection(db, "users", workerId, "shifts");
    const q = query(shiftsRef, where("isValidated", "==", true));
    const snapshot = await getDocs(q);

    // 2. Group by Date
    const dailyMinutes = {};
    snapshot.docs.forEach(d => {
      const shift = d.data();
      let dateKey;

      if (shift.startTime?.toDate) {
        dateKey = format(shift.startTime.toDate(), "yyyy-MM-dd");
      } else if (shift.date) {
        dateKey = shift.date;
      }

      if (dateKey) {
        // Filter by target month/year
        const shiftDate = new Date(dateKey);
        if (shiftDate.getMonth() === targetMonth && shiftDate.getFullYear() === targetYear) {
          dailyMinutes[dateKey] = (dailyMinutes[dateKey] || 0) + Number(shift.durationMinutes || 0);
        }
      }
    });

    // 3. Evaluate Qualified Days
    const breakdown = [];
    let qualifiedDaysCount = 0;

    Object.entries(dailyMinutes).forEach(([date, minutes]) => {
      const isQualified = minutes >= 360;
      if (isQualified) qualifiedDaysCount++;
      
      breakdown.push({
        date,
        minutes,
        hours: (minutes / 60).toFixed(2),
        status: isQualified ? "QUALIFIED" : "REJECTED (Insufficient Hours)"
      });
    });

    // Debug Breakdown
    console.log(`--- Monthly Cycle Audit: ${userData.displayName} ---`);
    console.table(breakdown);

    // 4. Final Math
    const progressPercent = Math.min((qualifiedDaysCount / targetDays) * 100, 100);
    const projectedPay = (Math.min(qualifiedDaysCount, targetDays) / targetDays) * monthlySalary;

    return {
      workerName: userData.displayName,
      qualifiedDays: qualifiedDaysCount,
      targetDays,
      progressPercent,
      monthlySalary: Number(monthlySalary),
      totalPay: Number(projectedPay.toFixed(2)),
      breakdown,
      period: format(new Date(targetYear, targetMonth), "MMMM yyyy")
    };
  } catch (error) {
    console.error("Monthly Progress Calculation Error:", error);
    throw error;
  }
};

/**
 * PROJECT-BASED SALARY ENGINE (with Overtime)
 * Calculates pay based on total hours worked.
 * Standard hours: 160. Overtime (1.5x rate) applies thereafter.
 */
export const calculateProjectPay = async (workerId, targetMonth, targetYear) => {
  try {
    const userRef = doc(db, "users", workerId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return { error: "User not found" };
    const userData = userSnap.data();
    
    if (userData.salaryType !== "project") {
      return { error: "Worker is not on a project-based salary model" };
    }

    const rate = Number(userData.projectRate || 0);
    const overtimeRate = Number(userData.projectOvertimeRate || 0);
    const STANDARD_HOURS = Number(userData.projectExpectedHours || 0);

    // 1. Fetch Validated Shifts
    const shiftsRef = collection(db, "users", workerId, "shifts");
    const q = query(shiftsRef, where("isValidated", "==", true));
    const querySnapshot = await getDocs(q);
    
    let totalMinutes = 0;

    // 2. Filter and Sum by target month/year
    querySnapshot.docs.forEach(docSnap => {
      const shift = docSnap.data();
      let shiftDate;

      if (shift.startTime?.toDate) {
        shiftDate = shift.startTime.toDate();
      } else if (shift.date) {
        shiftDate = new Date(shift.date);
      }

      if (shiftDate && 
          !isNaN(shiftDate.getTime()) &&
          shiftDate.getMonth() === targetMonth && 
          shiftDate.getFullYear() === targetYear) {
        totalMinutes += Number(shift.durationMinutes || 0);
      }
    });

    const totalHours = totalMinutes / 60;

    // 3. The Overtime Math
    let basePay = 0;
    let overtimePay = 0;
    let overtimeHours = 0;

    if (totalHours <= STANDARD_HOURS) {
      basePay = totalHours * rate;
    } else {
      basePay = STANDARD_HOURS * rate;
      overtimeHours = totalHours - STANDARD_HOURS;
      overtimePay = overtimeHours * overtimeRate;
    }

    const totalPay = basePay + overtimePay;

    return {
      workerName: userData.displayName,
      totalHours: Number(totalHours.toFixed(2)),
      standardHoursLimit: STANDARD_HOURS,
      standardHours: Number(Math.min(totalHours, STANDARD_HOURS).toFixed(2)),
      overtimeHours: Number(overtimeHours.toFixed(2)),
      basePay: Number(basePay.toFixed(2)),
      overtimePay: Number(overtimePay.toFixed(2)),
      totalPay: Number(totalPay.toFixed(2)),
      period: format(new Date(targetYear, targetMonth), "MMMM yyyy")
    };

  } catch (error) {
    console.error("Project Pay Calculation Error:", error);
    throw error;
  }
};
