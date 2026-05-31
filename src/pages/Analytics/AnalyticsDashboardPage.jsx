import React, { useMemo } from 'react';
import { useAnalyticsData } from '../../hooks/useAnalyticsData';
import { 
  computeProjectKPIs, 
  computeRevenueVsCostChartData, 
  computeStatusPieData, 
  computeSalaryDistribution, 
  computeWorkerShiftData, 
  computeMonthlyRevenueTrend 
} from '../../utils/analyticsEngine';

import AnalyticsSkeleton from './components/AnalyticsSkeleton';
import KPICardsRow from './components/KPICardsRow';
import RevenueVsCostChart from './components/RevenueVsCostChart';
import StatusPieChart from './components/StatusPieChart';
import SalaryDistributionChart from './components/SalaryDistributionChart';
import WorkerShiftChart from './components/WorkerShiftChart';
import MonthlyRevenueTrendChart from './components/MonthlyRevenueTrendChart';
import { BarChart2 } from 'lucide-react';

const AnalyticsDashboardPage = () => {
  const { projects, users, shifts, loading, error } = useAnalyticsData();

  // Pure data derivations to prevent re-renders
  const {
    kpiData,
    revenueVsCostData,
    statusPieData,
    salaryDistData,
    workerShiftData,
    monthlyTrendData
  } = useMemo(() => {
    if (loading) return {};
    return {
      kpiData: computeProjectKPIs(projects),
      revenueVsCostData: computeRevenueVsCostChartData(projects),
      statusPieData: computeStatusPieData(projects),
      salaryDistData: computeSalaryDistribution(users),
      workerShiftData: computeWorkerShiftData(users, shifts),
      monthlyTrendData: computeMonthlyRevenueTrend(projects)
    };
  }, [projects, users, shifts, loading]);

  if (loading) return <AnalyticsSkeleton />;

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="p-4 bg-red-50 text-red-600 rounded-xl">
          Error loading analytics: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
          <BarChart2 size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 leading-tight">Analytics</h1>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Business Intelligence Dashboard</p>
        </div>
      </div>

      {/* KPIs */}
      <KPICardsRow kpiData={kpiData} workerCount={users.length} />

      {/* Grid Layout for Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Row Charts */}
        <div className="min-h-[350px] h-[400px]">
          <RevenueVsCostChart data={revenueVsCostData} />
        </div>
        <div className="min-h-[350px] h-[400px]">
          <StatusPieChart data={statusPieData} />
        </div>

        {/* Middle Row Charts */}
        <div className="min-h-[350px] h-[400px]">
          <WorkerShiftChart data={workerShiftData} />
        </div>
        <div className="min-h-[350px] h-[400px]">
          <SalaryDistributionChart data={salaryDistData} />
        </div>

        {/* Full Width Bottom Chart */}
        <div className="lg:col-span-2 min-h-[350px] h-[400px]">
          <MonthlyRevenueTrendChart data={monthlyTrendData} />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboardPage;
