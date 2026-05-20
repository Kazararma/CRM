/**
 * LEGACY NORMALIZATION
 * If a worker hasn't been migrated to the new 'salary' map, this helper
 * constructs a temporary config from legacy fields.
 */
export function normalizeSalaryConfig(user) {
  if (user?.salary?.isConfigured) return user.salary;

  // Map legacy fields (salaryType, hourlyRate, etc.)
  const type = user.salaryType || 'hourly';
  
  if (type === 'monthly') {
    return {
      type: 'monthly',
      isConfigured: !!user.monthlySalary,
      monthly: {
        fixedMonthlySalary: Number(user.monthlySalary || 0),
        requiredWorkDays: 20,
        requiredHoursPerDay: 6 // Legacy threshold was 6
      }
    };
  }

  if (type === 'project') {
    return {
      type: 'project',
      isConfigured: !!user.projectRate,
      project: {
        baseRatePerHour: Number(user.projectRate || 0),
        standardHoursThreshold: Number(user.projectExpectedHours || 160),
        overtimeRatePerHour: Number(user.projectOvertimeRate || user.projectRate || 0)
      }
    };
  }

  // Default: Hourly
  return {
    type: 'hourly',
    isConfigured: !!user.hourlyRate,
    hourly: {
      ratePerHour: Number(user.hourlyRate || 0)
    }
  };
}

/**
 * SALARY COMPUTATION ENGINE
 * Authoritative source for all payroll calculations.
 * All functions are PURE: they accept data and return results without side effects.
 */

import { formatINR } from './formatCurrency';

/**
 * PROJECT-BASED SALARY (Legacy Hours-Based Model)
 * Logic: Worker is paid at a base rate until they reach the standardHoursThreshold.
 * All hours beyond the threshold are paid at the overtimeRatePerHour.
 */
export function computeProjectSalary(config, shifts) {
  const totalMinutes = shifts.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
  const totalHours = totalMinutes / 60;

  const threshold = Number(config.standardHoursThreshold) || 160;
  const baseRate = Number(config.baseRatePerHour) || 0;
  const overtimeRate = Number(config.overtimeRatePerHour) || 0;

  const baseHours = Math.min(totalHours, threshold);
  const overtimeHours = Math.max(0, totalHours - threshold);

  const basePay = baseHours * baseRate;
  const overtimePay = overtimeHours * overtimeRate;
  const totalPayable = basePay + overtimePay;

  return {
    totalHours: parseFloat(totalHours.toFixed(2)),
    baseHours: parseFloat(baseHours.toFixed(2)),
    overtimeHours: parseFloat(overtimeHours.toFixed(2)),
    basePay: parseFloat(basePay.toFixed(2)),
    overtimePay: parseFloat(overtimePay.toFixed(2)),
    totalPayable: parseFloat(totalPayable.toFixed(2)),
    formatted: {
      basePay: formatINR(basePay),
      overtimePay: formatINR(overtimePay),
      totalPayable: formatINR(totalPayable),
    },
  };
}

/**
 * MONTHLY SALARY
 * Implements the 20-day / eligibility check based on daily hour thresholds.
 */
export function computeMonthlySalary(config, shifts) {
  // 1. Group shifts by date to determine daily totals
  const minutesByDate = {};
  shifts.forEach((s) => {
    // Format date as YYYY-MM-DD for grouping
    let dateKey = s.date;
    if (!dateKey && s.startTime) {
      const d = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
      dateKey = d.toISOString().split('T')[0];
    }
    
    if (dateKey) {
      minutesByDate[dateKey] = (minutesByDate[dateKey] || 0) + (Number(s.durationMinutes) || 0);
    }
  });

  // 2. Eligibility logic: qualifying days must hit the hourly threshold
  const requiredMinutes = (Number(config.requiredHoursPerDay) || 0) * 60;
  const daysWorked = Object.keys(minutesByDate).length;
  const qualifyingDays = Object.values(minutesByDate)
    .filter((mins) => mins >= requiredMinutes).length;

  const isEligible = qualifyingDays >= (Number(config.requiredWorkDays) || 20);
  const amountPayable = isEligible ? (Number(config.fixedMonthlySalary) || 0) : 0;

  return {
    daysWorked,
    qualifyingDays,
    isEligible,
    amountPayable,
    totalPayable: amountPayable,
    formatted: {
      amountPayable: formatINR(amountPayable),
      totalPayable: formatINR(amountPayable),
      fixedSalary: formatINR(config.fixedMonthlySalary),
    },
  };
}

/**
 * HOURLY SALARY
 * Computes compensation across all assigned projects for hourly workers.
 */
export function computeHourlySalary(config, shifts) {
  const byProject = {};
  
  shifts.forEach((s) => {
    if (!byProject[s.projectId]) {
      byProject[s.projectId] = {
        projectId: s.projectId,
        projectName: s.projectName || "Unknown Project",
        totalMinutes: 0,
      };
    }
    byProject[s.projectId].totalMinutes += (Number(s.durationMinutes) || 0);
  });

  const projectBreakdown = Object.values(byProject).map((p) => {
    const totalHours = parseFloat((p.totalMinutes / 60).toFixed(2));
    const amountPayable = parseFloat((totalHours * (Number(config.ratePerHour) || 0)).toFixed(2));
    return {
      ...p,
      totalHours,
      amountPayable,
      formatted: {
        totalHours: `${totalHours} hrs`,
        amountPayable: formatINR(amountPayable),
      },
    };
  });

  const grandTotalHours = projectBreakdown.reduce((sum, p) => sum + p.totalHours, 0);
  const grandTotalPayable = projectBreakdown.reduce((sum, p) => sum + p.amountPayable, 0);

  return {
    projectBreakdown,
    totalHours: parseFloat(grandTotalHours.toFixed(2)),
    grandTotalHours: parseFloat(grandTotalHours.toFixed(2)),
    grandTotalPayable: parseFloat(grandTotalPayable.toFixed(2)),
    totalPayable: parseFloat(grandTotalPayable.toFixed(2)),
    formatted: {
      grandTotalPayable: formatINR(grandTotalPayable),
      totalPayable: formatINR(grandTotalPayable),
    },
  };
}
