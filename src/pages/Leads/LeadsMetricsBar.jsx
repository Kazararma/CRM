import React from 'react';
import { formatINR } from '../../utils/formatCurrency';
import { Target, TrendingUp, CheckCircle, Flame, Snowflake, CircleDot } from 'lucide-react';

const LeadsMetricsBar = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Active Leads */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Active Leads</p>
          <p className="text-2xl font-black text-gray-900">{metrics.pending}</p>
        </div>
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
          <Target size={24} />
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Breakdown</p>
        <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-5 w-full">
          <div className="flex items-center gap-1.5" title="Hot">
            <Flame size={16} className="text-red-500" />
            <span className="font-bold text-gray-700">{metrics.hot}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Neutral">
            <CircleDot size={16} className="text-yellow-500" />
            <span className="font-bold text-gray-700">{metrics.neutral}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Cold">
            <Snowflake size={16} className="text-blue-400" />
            <span className="font-bold text-gray-700">{metrics.cold}</span>
          </div>
        </div>
      </div>

      {/* Converted Leads */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Converted</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-gray-900">{metrics.convertedCount}</p>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Won
            </span>
          </div>
        </div>
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
          <CheckCircle size={24} />
        </div>
      </div>

      {/* Total Converted Value */}
      <div className="bg-slate-900 p-5 rounded-2xl shadow-xl border border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Total Converted</p>
          <p className="text-2xl font-black text-white">{formatINR(metrics.totalProfit)}</p>
        </div>
        <div className="w-12 h-12 bg-white/10 text-white rounded-xl flex items-center justify-center">
          <TrendingUp size={24} />
        </div>
      </div>
    </div>
  );
};

export default LeadsMetricsBar;
