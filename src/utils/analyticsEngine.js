import { format } from "date-fns";

const cleanNumber = (val) => {
  const num = Number(String(val || 0).replace(/[^0-9.-]+/g, ""));
  return isNaN(num) ? 0 : num;
};

const extractRevenue = (item) => {
  const val = item?.totalBilling || item?.estimatedBilling || item?.billing || item?.price || item?.amount || item?.revenue || item?.total || item?.EstimatedBilling || 0;
  return cleanNumber(val);
};

const extractCost = (item) => {
  const val = item?.estimatedBudget || item?.estimatedBudgetCost || item?.cost || item?.budget || item?.EstimatedBudgetCost || 0;
  return cleanNumber(val);
};

const getProjectStatus = (project) => {
  const statusRaw = project?.status || project?.phase || project?.state || 'open';
  return String(statusRaw).toLowerCase().replace(/\s+/g, '_');
};

export const computeProjectKPIs = (projects) => {


  let totalRevenue = 0;
  let totalCost = 0;
  let activeProjects = 0;
  
  projects.forEach(p => {
    totalRevenue += extractRevenue(p);
    totalCost += extractCost(p);
    
    const status = getProjectStatus(p);
    if (status !== 'cancelled' && status !== 'deleted') {
      activeProjects++;
    }
  });
  
  const profit = totalRevenue - totalCost;
  const profitMargin = (totalRevenue === 0 || isNaN(totalRevenue)) ? 0 : (profit / totalRevenue) * 100;
  
  return {
    totalRevenue,
    totalCost,
    profit,
    profitMargin: parseFloat(profitMargin.toFixed(2)) || 0,
    activeProjects
  };
};

export const computeRevenueVsCostChartData = (projects) => {
  return projects.map(p => ({
    name: p.projectTitle || p.title || p.name || 'Unknown',
    Revenue: Number(extractRevenue(p)) || 0,
    Cost: Number(extractCost(p)) || 0
  })).sort((a, b) => b.Revenue - a.Revenue).slice(0, 10);
};

export const computeStatusPieData = (projects) => {
  const statusCounts = {};
  projects.forEach(p => {
    const status = getProjectStatus(p);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  const COLORS = {
    open: '#3b82f6',
    in_progress: '#eab308',
    completed: '#22c55e',
    on_hold: '#ef4444',
    cancelled: '#64748b'
  };
  
  return Object.keys(statusCounts).map(status => ({
    name: status.replace('_', ' ').toUpperCase(),
    value: statusCounts[status],
    fill: COLORS[status] || '#94a3b8'
  }));
};

export const computeSalaryDistribution = (users) => {
  let hourly = 0;
  let monthly = 0;
  let project = 0;
  
  users.forEach(u => {
    const type = String(u.salary?.type || '').toLowerCase();
    if (type === 'hourly') hourly++;
    else if (type === 'monthly') monthly++;
    else if (type === 'project' || type === 'fixed') project++;
  });
  
  return [
    { name: 'Hourly', value: hourly, fill: '#8b5cf6' },
    { name: 'Monthly', value: monthly, fill: '#ec4899' },
    { name: 'Project-Based', value: project, fill: '#14b8a6' }
  ];
};

export const computeWorkerShiftData = (users, shifts) => {
  const shiftTotals = {};
  shifts.forEach(s => {
    const status = String(s.status || '').toLowerCase();
    // Count if validated, regardless of specific status, or if completed.
    // The previous logic required both isValidated && status === 'completed'. 
    if (s.isValidated) {
      shiftTotals[s.userId] = (shiftTotals[s.userId] || 0) + (Number(s.durationMinutes) || 0);
    }
  });
  
  return users.map(u => {
    const totalMinutes = shiftTotals[u.id] || 0;
    const divisor = 60;
    const hours = (divisor === 0 || isNaN(divisor)) ? 0 : totalMinutes / divisor;
    
    return {
      name: u.displayName || u.name || 'Unknown',
      Hours: parseFloat(hours.toFixed(2)) || 0
    };
  }).sort((a, b) => b.Hours - a.Hours).slice(0, 10);
};

export const computeMonthlyRevenueTrend = (projects) => {
  const monthTotals = {};
  
  projects.forEach(p => {
    const dateStr = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : new Date());
    const month = format(dateStr, 'MMM yyyy');
    
    monthTotals[month] = Number(monthTotals[month] || 0) + Number(extractRevenue(p) || 0);
  });
  
  return Object.keys(monthTotals).map(month => ({
    name: month,
    Revenue: Number(monthTotals[month]) || 0
  }));
};
