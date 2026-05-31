import React from 'react';
import { BarChart2 } from 'lucide-react';

const EmptyChartState = ({ message = "No data available" }) => {
  return (
    <div className="w-full h-full min-h-[250px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
      <BarChart2 size={32} className="mb-2 opacity-50" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

export default EmptyChartState;
