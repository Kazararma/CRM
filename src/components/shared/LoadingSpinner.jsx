import React from "react";

const LoadingSpinner = ({ fullPage = false }) => {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="text-gray-500 font-medium animate-pulse">Loading data...</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center">
        {spinner}
      </div>
    );
  }

  return (
    <div className="w-full py-20 flex items-center justify-center">
      {spinner}
    </div>
  );
};

export default LoadingSpinner;
