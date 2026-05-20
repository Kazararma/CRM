import React from 'react';
import { Briefcase, Calendar, Clock, AlertCircle, CheckCircle2, Hourglass } from 'lucide-react';

/**
 * SalaryTypeBadge
 * Displays the payment model: Project, Monthly, or Hourly.
 */
export const SalaryTypeBadge = ({ type }) => {
  const configs = {
    project: { label: 'PROJECT', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Briefcase },
    monthly: { label: 'MONTHLY', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Calendar },
    hourly: { label: 'HOURLY', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  };

  const config = configs[type] || configs.hourly;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${config.color}`}>
      <Icon size={12} strokeWidth={3} />
      {config.label}
    </div>
  );
};

/**
 * PaymentStatusChip
 * Displays the state of the payment handshake.
 */
export const PaymentStatusChip = ({ status }) => {
  const configs = {
    PENDING_CONFIRMATION: { 
      label: 'Awaiting Confirmation', 
      color: 'bg-amber-50 text-amber-700 border-amber-100', 
      icon: Hourglass 
    },
    PAID: { 
      label: 'Confirmed', 
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100', 
      icon: CheckCircle2 
    },
    DISPUTED: { 
      label: 'Disputed', 
      color: 'bg-red-50 text-red-700 border-red-100', 
      icon: AlertCircle 
    },
  };

  const config = configs[status];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${config.color}`}>
      <Icon size={14} strokeWidth={2.5} />
      {config.label}
    </div>
  );
};
