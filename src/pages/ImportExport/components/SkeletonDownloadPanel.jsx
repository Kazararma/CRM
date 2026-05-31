import React from 'react';
import { downloadSkeletonSheet } from '../../../services/excelService';
import { FileSpreadsheet, Download } from 'lucide-react';

const SkeletonDownloadPanel = () => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center space-y-4">
      <div className="p-4 bg-blue-50 rounded-full text-blue-600">
        <FileSpreadsheet size={32} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">Download Template</h2>
        <p className="text-sm text-gray-500 mt-1">
          Get the exact spreadsheet format required for bulk importing new leads.
        </p>
      </div>
      <button 
        onClick={downloadSkeletonSheet}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors"
      >
        <Download size={18} />
        Download Skeleton
      </button>
    </div>
  );
};

export default SkeletonDownloadPanel;
