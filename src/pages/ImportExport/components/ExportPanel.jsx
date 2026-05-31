import React from 'react';
import { exportLeadsToExcel } from '../../../services/excelService';
import { useLeads } from '../../../hooks/useLeads';
import { Database, Download } from 'lucide-react';

const ExportPanel = () => {
  // Use existing leads hook to fetch all leads (it defaults to 'all' or we can leave it empty depending on hook definition)
  const { leads, loading, error } = useLeads('all');

  const handleExport = () => {
    if (!leads || leads.length === 0) return;
    exportLeadsToExcel(leads);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center space-y-4">
      <div className="p-4 bg-green-50 rounded-full text-green-600">
        <Database size={32} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">Export All Leads</h2>
        <p className="text-sm text-gray-500 mt-1">
          Export your entire lead database to a clean, formatted Excel spreadsheet.
        </p>
      </div>
      <button 
        onClick={handleExport}
        disabled={loading || !leads || leads.length === 0}
        className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={18} />
        {loading ? 'Loading...' : `Export ${leads?.length || 0} Leads`}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">Failed to load leads</p>}
    </div>
  );
};

export default ExportPanel;
