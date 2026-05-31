import React from 'react';

const AnalyticsSkeleton = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded-lg"></div>
      
      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 h-28 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="h-4 w-16 bg-gray-200 rounded"></div>
              <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
            </div>
            <div className="h-6 w-24 bg-gray-200 rounded mt-2"></div>
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 h-[350px]"></div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 h-[350px]"></div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 h-[350px]"></div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 h-[350px]"></div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 h-[350px] lg:col-span-2"></div>
      </div>
    </div>
  );
};

export default AnalyticsSkeleton;
