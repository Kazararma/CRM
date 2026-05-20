import React from 'react';
import { formatINR } from '../../utils/formatCurrency';
import {
  Target, TrendingUp, CheckCircle, XCircle,
  Flame, CircleDot, Snowflake, Trophy,
} from 'lucide-react';
import { OPPORTUNITY_PHASE_META } from '../../hooks/useOpportunitiesMetrics';

// ── Stage funnel phase display order (active stages only, shown as mini pills) ──
const FUNNEL_PHASES = OPPORTUNITY_PHASE_META.filter(p => p.group === 'active');

const MetricCard = ({ label, value, icon: Icon, iconBg, iconColor, dark = false }) => (
  <div className={`p-5 rounded-2xl shadow-sm border flex items-center justify-between ${
    dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
  }`}>
    <div>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${dark ? 'text-blue-400' : 'text-gray-400'}`}>
        {label}
      </p>
      <p className={`text-2xl font-black ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    </div>
    <div className={`w-12 h-12 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center`}>
      <Icon size={24} />
    </div>
  </div>
);

/**
 * OpportunitiesMetricsBar
 * Top-level summary metrics derived from useOpportunitiesMetrics.
 */
const OpportunitiesMetricsBar = ({ metrics }) => {
  return (
    <div className="space-y-4">
      {/* ── Row 1: Primary metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Active Pipeline"
          value={metrics.activePipelineCount}
          icon={Target}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />

        {/* Category breakdown */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Category</p>
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

        <MetricCard
          label="Closed Won"
          value={metrics.closedWonCount}
          icon={Trophy}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />

        <MetricCard
          label="Total Pipeline Value"
          value={formatINR(metrics.totalPipelineValue)}
          icon={TrendingUp}
          iconBg="bg-white/10"
          iconColor="text-white"
          dark
        />
      </div>

      {/* ── Row 2: Stage funnel mini-bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3 sm:px-5 sm:py-4">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Stage Funnel</p>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {FUNNEL_PHASES.map((phase, idx) => {
            const count = metrics.stageFunnel?.[phase.value] ?? 0;
            const isActive = count > 0;
            return (
              <div
                key={phase.value}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-[10px] sm:text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-gray-50 border-gray-100 text-gray-400'
                }`}
              >
                <span className="text-[10px] font-black text-gray-400">{idx + 1}</span>
                <span>{phase.label}</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {count}
                </span>
              </div>
            );
          })}

          {/* Closed Won / Lost terminals */}
          <div className={`flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-[10px] sm:text-xs font-bold ${
            (metrics.stageFunnel?.closed_won ?? 0) > 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-gray-50 border-gray-100 text-gray-400'
          }`}>
            <CheckCircle size={12} />
            Won
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              (metrics.stageFunnel?.closed_won ?? 0) > 0
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {metrics.stageFunnel?.closed_won ?? 0}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-[10px] sm:text-xs font-bold ${
            (metrics.stageFunnel?.closed_lost ?? 0) > 0
              ? 'bg-red-50 border-red-200 text-red-600'
              : 'bg-gray-50 border-gray-100 text-gray-400'
          }`}>
            <XCircle size={12} />
            Lost
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              (metrics.stageFunnel?.closed_lost ?? 0) > 0
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {metrics.stageFunnel?.closed_lost ?? 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpportunitiesMetricsBar;
