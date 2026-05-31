import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import EmptyChartState from './EmptyChartState';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
};

const MonthlyRevenueTrendChart = ({ data }) => {
  if (!data || data.length === 0) return <EmptyChartState message="No revenue trend data available" />;

  const sanitizedData = (data || []).map(item => ({
    name: item?.name || 'Unknown',
    revenue: Number(item?.Revenue || item?.revenue || 0)
  }));

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Monthly Revenue Trend</h3>
      <div className="w-full overflow-x-auto flex justify-center pt-4">
        <div style={{ minWidth: '600px', height: '300px' }}>
          <BarChart width={600} height={300} data={sanitizedData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
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
            <Bar dataKey="revenue" name="Total Revenue" fill="#0ea5e9" maxBarSize={40} minPointSize={0} radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </div>
      </div>
    </div>
  );
};

export default MonthlyRevenueTrendChart;
