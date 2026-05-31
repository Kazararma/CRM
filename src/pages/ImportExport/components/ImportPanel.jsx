import React, { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { parseLeadsFromExcel } from '../../../services/excelService';

const ImportPanel = ({ onLeadsParsed }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const processFile = async (file) => {
    setError(null);
    if (!file || !file.name.endsWith('.xlsx')) {
      setError('Please upload a valid .xlsx file.');
      return;
    }
    
    try {
      const parsedLeads = await parseLeadsFromExcel(file);
      onLeadsParsed(parsedLeads);
    } catch (err) {
      console.error(err);
      setError('Failed to parse Excel file. Make sure it matches the template.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    processFile(file);
  };

  return (
    <div 
      className={`bg-white p-6 rounded-2xl border-2 border-dashed shadow-sm flex flex-col items-center text-center space-y-4 transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
        <UploadCloud size={32} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">Upload Leads</h2>
        <p className="text-sm text-gray-500 mt-1">
          Drag and drop your populated .xlsx template here, or click to browse.
        </p>
      </div>
      
      <input 
        type="file" 
        accept=".xlsx" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileInput} 
      />
      
      <button 
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-sm"
      >
        Browse Files
      </button>
      
      {error && <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>}
    </div>
  );
};

export default ImportPanel;
