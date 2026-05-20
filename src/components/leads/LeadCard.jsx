import React from 'react';
import { formatINR } from '../../utils/formatCurrency';
import { MoreVertical } from 'lucide-react';
import { format } from 'date-fns';

const PhaseBadge = ({ phase }) => {
  const colors = {
    open:        'bg-gray-100    text-gray-600    border-gray-200',
    contacted:   'bg-blue-50     text-blue-600    border-blue-200',
    qualified:   'bg-emerald-50  text-emerald-600 border-emerald-200',
    unqualified: 'bg-red-50      text-red-600     border-red-200',
  };

  const labels = {
    open:        'Open',
    contacted:   'Contacted',
    qualified:   'Qualified',
    unqualified: 'Unqualified',
  };

  const className = colors[phase] || colors.open;

  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${className}`}>
      {labels[phase] || phase}
    </span>
  );
};

const LeadCard = ({ lead, onClick }) => {
  // Format the creation date safely
  let createdDateString = '';
  if (lead.createdAt) {
    try {
      const dateObj = lead.createdAt.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt);
      createdDateString = format(dateObj, 'dd MMM yyyy');
    } catch (e) {
      createdDateString = '';
    }
  }

  // Determine client name string
  const contactInfo = lead.clientName || lead.email || lead.phoneNumber || 'Unknown Client';

  // Show estimated billing on the card (finalBilling is a legacy field)
  const billingValue = lead.estimatedBilling || 0;

  return (
    <div 
      onClick={onClick}
      className={`relative bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group overflow-hidden ${
        (lead.isConvertedToOpportunity || lead.isConverted) ? 'opacity-80 bg-gray-50' : ''
      }`}
    >
      {/* Converted Overlay Banner */}
      {(lead.isConvertedToOpportunity || lead.isConverted) && (
        <div className="absolute top-3 right-[-30px] rotate-45 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest py-1 px-8 shadow-sm flex items-center justify-center gap-1 z-10">
          ✓ Converted
        </div>
      )}

      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start mb-2 pr-4">
          <h4 className="font-bold text-gray-900 text-sm line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
            {lead.projectTitle}
          </h4>
        </div>
        
        <p className="text-xs text-gray-500 mb-3 truncate font-medium">
          {contactInfo}
        </p>

        <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-50">
          <PhaseBadge phase={lead.phase || 'initial'} />
          <span className={`text-sm font-black ${lead.isConverted ? 'text-emerald-600' : 'text-gray-900'}`}>
            {formatINR(billingValue)}
          </span>
        </div>
        
        {createdDateString && (
          <p className="text-[10px] text-gray-400 mt-2 font-medium">
            Added {createdDateString}
          </p>
        )}
      </div>
    </div>
  );
};

export default LeadCard;
