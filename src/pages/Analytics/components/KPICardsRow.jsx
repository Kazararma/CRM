import React from 'react';
import KPICard from './KPICard';
import { IndianRupee, TrendingUp, TrendingDown, Briefcase, Users } from 'lucide-react';

const KPICardsRow = ({ kpiData, workerCount }) => {
  const { totalRevenue, totalCost, profit, profitMargin, activeProjects } = kpiData;
  
  const isProfitNegative = profit < 0;
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <KPICard 
        title="Total Revenue" 
        value={totalRevenue} 
        isCurrency={true} 
        icon={IndianRupee} 
        iconColor="text-green-600"
        iconBg="bg-green-50"
      />
      
      <KPICard 
        title="Est. Costs" 
        value={totalCost} 
        isCurrency={true} 
        icon={IndianRupee} 
        iconColor="text-red-500"
        iconBg="bg-red-50"
      />
      
      <KPICard 
        title="Net Profit" 
        value={profit} 
        isCurrency={true} 
        icon={isProfitNegative ? TrendingDown : TrendingUp}
        valueColor={isProfitNegative ? 'text-red-600' : 'text-green-600'}
        iconColor={isProfitNegative ? 'text-red-600' : 'text-green-600'}
        iconBg={isProfitNegative ? 'bg-red-50' : 'bg-green-50'}
        subtitle={`Margin: ${profitMargin}%`}
      />
      
      <KPICard 
        title="Active Projects" 
        value={activeProjects} 
        icon={Briefcase} 
        iconColor="text-blue-500"
        iconBg="bg-blue-50"
      />
      
      <KPICard 
        title="Active Workers" 
        value={workerCount} 
        icon={Users} 
        iconColor="text-purple-500"
        iconBg="bg-purple-50"
      />
    </div>
  );
};

export default KPICardsRow;
