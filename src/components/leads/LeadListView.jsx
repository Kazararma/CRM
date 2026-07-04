import React from 'react';
import { AlertCircle } from 'lucide-react';

const LeadListView = ({ leads, onLeadClick }) => {
  const getRowClass = (aiStatus) => {
    switch (aiStatus) {
      case 'calling':
      case 'messaging':
        return 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200';
      case 'completed':
        return 'bg-green-50 hover:bg-green-100 text-green-900 border-green-200';
      case 'failed':
        return 'bg-red-50 hover:bg-red-100 text-red-900 border-red-200';
      case 'idle':
      default:
        return 'bg-white hover:bg-gray-50 text-gray-900 border-gray-200';
    }
  };

  if (!leads || leads.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
        <p className="text-gray-500">No leads match the current filters.</p>
      </div>
    );
  }

  const sortedLeads = [...leads].sort((a, b) => {
    if (a.attentionNeeded && !b.attentionNeeded) return -1;
    if (!a.attentionNeeded && b.attentionNeeded) return 1;
    return 0;
  });

  return (
    <div className="overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200">
      <table className="w-full text-left border-collapse">
        <thead className="hidden md:table-header-group">
          <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
            <th className="px-6 py-4">Name</th>
            <th className="px-6 py-4">Email</th>
            <th className="px-6 py-4">Phone</th>
            <th className="px-6 py-4">Budget</th>
            <th className="px-6 py-4">Pipeline Stage</th>
            <th className="px-6 py-4">AI Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 flex flex-col md:table-row-group border-t border-gray-200">
          {sortedLeads.map((lead) => (
            <tr 
              key={lead.id} 
              onClick={() => onLeadClick(lead)}
              className={`cursor-pointer transition-colors ${getRowClass(lead.aiStatus)} ${lead.attentionNeeded ? 'bg-red-50/50' : ''} flex flex-col md:table-row mb-4 md:mb-0 border border-gray-100 md:border-0 rounded-lg md:rounded-none mx-4 md:mx-0 shadow-sm md:shadow-none p-4 md:p-0`}
            >
              <td className="md:px-6 md:py-4 font-medium flex items-center gap-2 mb-2 md:mb-0">
                {lead.attentionNeeded && (
                  <AlertCircle size={16} className="text-red-500 animate-pulse shrink-0" />
                )}
                <div>
                  <div className="text-gray-900">{lead.clientName || 'N/A'}</div>
                  <div className="text-xs opacity-70 font-normal">{lead.projectTitle}</div>
                </div>
              </td>
              <td className="md:px-6 md:py-4 text-sm flex justify-between md:table-cell py-1 text-gray-600">
                <span className="md:hidden font-semibold text-xs uppercase text-gray-400">Email:</span>
                <span className="truncate max-w-[200px] md:max-w-none">{lead.email || 'N/A'}</span>
              </td>
              <td className="md:px-6 md:py-4 text-sm flex justify-between md:table-cell py-1 text-gray-600">
                <span className="md:hidden font-semibold text-xs uppercase text-gray-400">Phone:</span>
                <span>{lead.phoneNumber || 'N/A'}</span>
              </td>
              <td className="md:px-6 md:py-4 text-sm flex justify-between md:table-cell py-1 text-gray-600">
                <span className="md:hidden font-semibold text-xs uppercase text-gray-400">Budget:</span>
                <span>{lead.estimatedBilling ? `₹${lead.estimatedBilling.toLocaleString('en-IN')}` : 'N/A'}</span>
              </td>
              <td className="md:px-6 md:py-4 flex justify-between items-center md:table-cell py-2 mt-2 md:mt-0 border-t md:border-0 border-dashed border-gray-200">
                <span className="md:hidden font-semibold text-xs uppercase text-gray-400">Stage:</span>
                <span className="capitalize px-2.5 py-1 rounded-full text-xs font-semibold bg-black/5">
                  {lead.phase || lead.pipelineStage || 'open'}
                </span>
              </td>
              <td className="md:px-6 md:py-4 flex justify-between items-center md:table-cell py-1">
                <span className="md:hidden font-semibold text-xs uppercase text-gray-400">AI Status:</span>
                <span className={`capitalize px-2.5 py-1 rounded-full text-xs font-semibold ${lead.attentionNeeded ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-black/5'}`}>
                  {lead.attentionNeeded ? 'Attention Needed' : (lead.aiStatus || 'idle')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeadListView;
