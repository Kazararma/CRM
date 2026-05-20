import React from "react";

const ComingSoon = ({ title }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <h1 className="text-3xl font-black text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500 max-w-md">
        We're working hard to bring you the new {title} experience. This feature will be available in the next update.
      </p>
    </div>
  );
};

export default ComingSoon;
