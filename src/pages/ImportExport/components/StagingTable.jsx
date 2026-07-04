import React from 'react';
import StagingTableRow from './StagingTableRow';
import { LEAD_EXCEL_COLUMNS } from '../../../config/leadImportExportConfig';
import { AlertTriangle, Trash2 } from 'lucide-react';

const StagingTable = ({ leads, onUpdate, onRemove }) => {
  const discardedCount = leads.filter(l => l.isDiscarded).length;
  const pendingCount = leads.length - discardedCount;
  const errorCount = leads.filter(l => !l.isDiscarded && Object.keys(l._errors || {}).length > 0).length;

  return (
    <div className="space-y-4">
      {/* Garbage Summary Bar */}
      {leads.length > 0 && (
        <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg font-medium text-sm">
            <Trash2 size={16} />
            <span>AI discarded {discardedCount} records as garbage</span>
          </div>
          <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg font-medium text-sm">
            <span>{pendingCount} records pending review</span>
          </div>
          {errorCount > 0 && (
            <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg font-medium text-sm">
              <AlertTriangle size={16} />
              <span>{errorCount} records have errors</span>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                {LEAD_EXCEL_COLUMNS.map((col, idx) => (
                  <th key={idx} className="p-4 whitespace-nowrap">{col}</th>
                ))}
                <th className="p-4 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <StagingTableRow 
                  key={lead.id} 
                  lead={lead} 
                  onUpdate={onUpdate}
                  onRemove={() => onRemove(lead.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
        {leads.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No valid rows found in the uploaded file.
          </div>
        )}
      </div>
    </div>
  );
};

export default StagingTable;
