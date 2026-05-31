import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import EmptyChartState from './EmptyChartState';

const WorkerShiftChart = ({ data }) => {
  if (!data || data.length === 0) return <EmptyChartState message="No validated shift data available" />;

  const sanitizedData = (data || []).map((item, index) => ({
    name: (item?.name || 'Unknown') + "\u200B".repeat(index),
    hours: Number(item?.Hours || item?.hours || 0)
  }));

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Top Workers: Shift Hours</h3>
      <div className="w-full overflow-x-auto flex justify-center pt-4">
        <div style={{ minWidth: '500px', height: '300px' }}>
          <BarChart width={500} height={300} data={sanitizedData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis 
              type="number" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
            />
            <YAxis 
              dataKey="name" 
              type="category" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
              width={80}
            />
            <Tooltip 
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
              formatter={(value) => [`${value} hrs`, 'Billable Hours']}
            />
            <Bar dataKey="hours" fill="#8b5cf6" maxBarSize={40} radius={[0, 6, 6, 0]} minPointSize={0} isAnimationActive={false} />
          </BarChart>
        </div>
      </div>
    </div>
  );
};

export default WorkerShiftChart;
