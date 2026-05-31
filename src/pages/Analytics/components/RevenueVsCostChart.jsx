import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import EmptyChartState from './EmptyChartState';

const RevenueVsCostChart = ({ data }) => {
  if (!data || data.length === 0) return <EmptyChartState message="No revenue/cost data available" />;

  const formatCurrency = (value) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

  const sanitizedData = (data || []).map((item, index) => ({
    // Use zero-width spaces to force unique keys for Recharts without changing display
    name: (item?.name || item?.projectName || 'Unnamed Project') + "\u200B".repeat(index),
    revenue: Number(item?.revenue || item?.Revenue || item?.estimatedBilling || item?.price || item?.total || 0),
    cost: Number(item?.cost || item?.Cost || item?.estimatedBudgetCost || item?.budget || 0)
  }));

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Top Projects: Revenue vs Cost</h3>
      <div className="w-full overflow-x-auto flex justify-center pt-4">
        <div style={{ minWidth: '600px', height: '300px' }}>
          <BarChart width={600} height={300} data={sanitizedData} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(val) => `₹${(val / 1000)}k`}
            />
            <Tooltip 
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
              formatter={(value) => formatCurrency(value)}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            <Bar dataKey="revenue" name="Revenue" fill="#10b981" maxBarSize={40} radius={[6, 6, 0, 0]} minPointSize={0} isAnimationActive={false} />
            <Bar dataKey="cost" name="Est. Cost" fill="#f43f5e" maxBarSize={40} radius={[6, 6, 0, 0]} minPointSize={0} isAnimationActive={false} />
          </BarChart>
        </div>
      </div>
    </div>
  );
};

export default RevenueVsCostChart;
