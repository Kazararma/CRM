/**
 * UTILITY: financeUtils
 * Reusable logic for calculating project labor costs based on worker assignments.
 */

export const calculateLaborCost = (assignedIds, validatedShifts, users) => {
  if (!assignedIds?.length || !validatedShifts?.length || !users?.length) return 0;

  let total = 0;
  
  // 1. Group minutes by worker (ONLY for those currently in the assignedIds list)
  const workerMinutes = {};
  validatedShifts.forEach(s => {
    if (assignedIds.includes(s.userId)) {
      workerMinutes[s.userId] = (workerMinutes[s.userId] || 0) + (Number(s.durationMinutes) || 0);
    }
  });

  // 2. Apply salary math for each worker
  Object.entries(workerMinutes).forEach(([uid, minutes]) => {
    const worker = users.find(u => u.id === uid);
    if (!worker) return;

    const hours = minutes / 60;
    let cost = 0;

    if (worker.salaryType === "hourly") {
      cost = hours * (Number(worker.hourlyRate) || 0);
    } else if (worker.salaryType === "project") {
      const limit = Number(worker.projectExpectedHours) || 0;
      const rate = Number(worker.projectRate) || 0;
      const overtimeRate = Number(worker.projectOvertimeRate) || 0;
      
      if (hours <= limit) {
        cost = hours * rate;
      } else {
        const overtime = hours - limit;
        cost = (limit * rate) + (overtime * overtimeRate);
      }
    } else if (worker.salaryType === "monthly") {
      // Prorated monthly salary assuming 160 standard hours as the denominator
      cost = hours * ((Number(worker.monthlySalary) || 0) / 160);
    }
    
    total += cost;
  });

  return total;
};

/**
 * UTILITY: calculateDeploymentCost
 * Estimates the fixed or initial liability of assigning workers to a project.
 * Used for live previews during project creation.
 */
export const calculateDeploymentCost = (assignedIds, users, hourlyEstimates = {}) => {
  if (!assignedIds?.length || !users?.length) return 0;

  return assignedIds.reduce((total, uid) => {
    const worker = users.find(u => u.id === uid);
    if (!worker) return total;

    let cost = 0;
    const salary = worker.salary || {};
    const type = salary.type || worker.salaryType || 'none';

    if (type === 'monthly') {
      cost = Number(salary.monthly?.fixedMonthlySalary || worker.monthlySalary || 0);
    } else if (type === 'project') {
      const rate = Number(salary.project?.baseRatePerHour || worker.projectRate || 0);
      const hours = Number(salary.project?.standardHoursThreshold || worker.projectExpectedHours || 160);
      cost = rate * hours;
    } else if (type === 'hourly') {
      const rate = Number(salary.hourly?.ratePerHour || worker.hourlyRate || 0);
      const estimatedHours = Number(hourlyEstimates[uid] || 0);
      cost = rate * estimatedHours;
    }

    return total + cost;
  }, 0);
};
