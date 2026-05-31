import React from 'react';
import StagingTableRow from './StagingTableRow';
import { LEAD_EXCEL_COLUMNS } from '../../../config/leadImportExportConfig';

const StagingTable = ({ leads, onUpdate }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
              {LEAD_EXCEL_COLUMNS.map((col, idx) => (
                <th key={idx} className="p-4 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <StagingTableRow 
                key={lead.id} 
                lead={lead} 
                onUpdate={onUpdate}
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
  );
};

export default StagingTable;
