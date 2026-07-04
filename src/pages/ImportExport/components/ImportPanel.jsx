import React, { useRef, useState } from 'react';
import { UploadCloud, Bot, Bolt } from 'lucide-react';
import { parseLeadsFromExcel } from '../../../services/excelService';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/config';
import ImportModeToggle from './ImportModeToggle';

const ImportPanel = ({ onLeadsParsed }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importMode, setImportMode] = useState('manual');
  const [autonomousEnabled, setAutonomousEnabled] = useState(false);
  const fileInputRef = useRef(null);

  const processFile = async (file) => {
    setError(null);
    if (!file || !file.name.endsWith('.xlsx')) {
      setError('Please upload a valid .xlsx file.');
      return;
    }
    
    setIsProcessing(true);
    try {
      const parsedLeads = await parseLeadsFromExcel(file);
      
      // Call AI Garbage Filter
      const filterGarbageRecords = httpsCallable(functions, 'filterGarbageRecords');
      const response = await filterGarbageRecords({ records: parsedLeads });
      const enrichedRecords = response.data.enrichedRecords;
      
      onLeadsParsed(enrichedRecords, { importMode, autonomousEnabled });
    } catch (err) {
      console.error(err);
      setError('Failed to process Excel file. Please try again.');
    } finally {
      setIsProcessing(false);
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
    <div className="space-y-4">
      {/* AI Config Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="text-blue-600" size={20} />
          <h3 className="font-bold text-gray-900">Import Configuration</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Import Mode</label>
            <ImportModeToggle mode={importMode} onChange={setImportMode} />
          </div>
          
          <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-blue-100 cursor-pointer hover:border-blue-300 transition-colors">
            <div className="flex-1">
              <span className="block text-sm font-bold text-gray-900">Autonomous Outreach</span>
              <span className="block text-xs text-gray-500">Enable AI agents to automatically contact these leads via voice/WhatsApp.</span>
            </div>
            <input 
              type="checkbox" 
              checked={autonomousEnabled}
              onChange={(e) => setAutonomousEnabled(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      <div 
        className={`bg-white p-6 rounded-2xl border-2 border-dashed shadow-sm flex flex-col items-center text-center space-y-4 transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
        } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
          {isProcessing ? <Bolt className="animate-spin text-blue-500" size={32} /> : <UploadCloud size={32} />}
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{isProcessing ? 'Processing AI Filter...' : 'Upload Leads'}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isProcessing ? 'Scoring records for garbage and validating format.' : 'Drag and drop your populated .xlsx template here.'}
          </p>
        </div>
        
        <input 
          type="file" 
          accept=".xlsx" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileInput} 
          disabled={isProcessing}
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-sm"
        >
          Browse Files
        </button>
        
        {error && <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>}
      </div>
    </div>
  );
};

export default ImportPanel;
