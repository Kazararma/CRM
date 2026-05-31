import React, { useState } from 'react';
import SkeletonDownloadPanel from './components/SkeletonDownloadPanel';
import ExportPanel from './components/ExportPanel';
import ImportPanel from './components/ImportPanel';
import StagingTable from './components/StagingTable';
import { batchWriteLeads } from '../../services/leadsImportService';
import { validateLeadRow } from '../../utils/leadImportValidator';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeftRight, Check, X } from 'lucide-react';

const ImportExportPage = () => {
  const [parsedLeads, setParsedLeads] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { currentUser } = useAuth();

  const handleUpdateLead = (id, field, value) => {
    setParsedLeads(prev => prev.map(lead => {
      if (lead.id === id) {
        const updatedLead = { ...lead, [field]: value };
        updatedLead._errors = validateLeadRow(updatedLead);
        return updatedLead;
      }
      return lead;
    }));
  };

  const handleCancel = () => setParsedLeads([]);

  const hasErrors = parsedLeads.some(lead => Object.keys(lead._errors || {}).length > 0);

  const handleCommit = async () => {
    if (hasErrors) return;
    setIsSubmitting(true);
    try {
      await batchWriteLeads(parsedLeads, currentUser.uid);
      setSuccess(true);
      setParsedLeads([]);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to commit leads');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <ArrowLeftRight size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 leading-tight">Import & Export Hub</h1>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Manage bulk lead data</p>
          </div>
        </div>
        {success && (
          <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm animate-in fade-in slide-in-from-top-2">
            <Check size={18} /> Import Successful!
          </div>
        )}
      </div>

      {parsedLeads.length === 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImportPanel onLeadsParsed={setParsedLeads} />
            <div className="space-y-6 flex flex-col justify-between">
              <SkeletonDownloadPanel />
              <ExportPanel />
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <div>
              <h2 className="font-bold text-blue-900 text-lg">Staging Area</h2>
              <p className="text-sm text-blue-700 mt-0.5">
                Review and fix any highlighted errors before committing to the database.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X size={16} /> Cancel
              </button>
              <button 
                onClick={handleCommit}
                disabled={hasErrors || isSubmitting}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Check size={16} />
                {isSubmitting ? 'Committing...' : `Commit ${parsedLeads.length} Leads`}
              </button>
            </div>
          </div>

          <StagingTable leads={parsedLeads} onUpdate={handleUpdateLead} />
        </div>
      )}
    </div>
  );
};

export default ImportExportPage;
