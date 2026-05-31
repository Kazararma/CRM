import React from 'react';

const KPICard = ({ title, value, icon: Icon, valueColor = 'text-gray-900', iconColor = 'text-blue-500', iconBg = 'bg-blue-50', isCurrency = false, subtitle }) => {
  const displayValue = isCurrency 
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
    : value;

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
        <div className={`p-2 rounded-xl ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
      </div>
      <div>
        <div className={`text-2xl font-black ${valueColor} truncate`}>{displayValue}</div>
        {subtitle && (
          <p className="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-wider">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default KPICard;
