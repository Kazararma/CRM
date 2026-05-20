import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

const options = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'custom', label: 'Custom Range' },
];

const LeadsTimeFilter = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentLabel = options.find(o => o.value === value?.mode)?.label || 'Custom Range';

  const handleSelect = (mode) => {
    if (mode === 'custom') {
      const now = new Date();
      onChange({ mode: 'custom', fromDate: now, toDate: now });
    } else {
      onChange({ mode });
    }
    setIsOpen(false);
  };

  const handleDateChange = (type, dateStr) => {
    if (!dateStr) return;
    const date = new Date(dateStr);
    
    // Ensure "toDate" includes the entire day
    if (type === 'toDate') {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }

    onChange({
      ...value,
      [type]: date
    });
  };

  const formatDateForInput = (dateObj) => {
    if (!dateObj) return '';
    const d = new Date(dateObj);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
        <Calendar size={16} className="text-gray-400" />
        {currentLabel}
        <ChevronDown size={16} className="text-gray-400 ml-1" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-auto mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors ${
                  value?.mode === opt.value ? 'text-blue-600 bg-blue-50/50' : 'text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
      </div>

      {value?.mode === 'custom' && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 px-2 py-1.5 rounded-xl shadow-sm animate-in fade-in slide-in-from-left-4">
          <input 
            type="date" 
            value={formatDateForInput(value.fromDate)}
            onChange={(e) => handleDateChange('fromDate', e.target.value)}
            className="text-sm border-none bg-transparent focus:ring-0 text-gray-700 font-medium px-2 py-0.5 outline-none"
          />
          <span className="text-gray-400 font-bold text-sm">to</span>
          <input 
            type="date" 
            value={formatDateForInput(value.toDate)}
            onChange={(e) => handleDateChange('toDate', e.target.value)}
            className="text-sm border-none bg-transparent focus:ring-0 text-gray-700 font-medium px-2 py-0.5 outline-none"
          />
        </div>
      )}
    </div>
  );
};

export default LeadsTimeFilter;
