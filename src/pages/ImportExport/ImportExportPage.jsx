import React, { useState, useEffect } from 'react';
import SkeletonDownloadPanel from './components/SkeletonDownloadPanel';
import ExportPanel from './components/ExportPanel';
import ImportPanel from './components/ImportPanel';
import StagingTable from './components/StagingTable';
import { batchWriteLeads } from '../../services/leadsImportService';
import { validateLeadRow } from '../../utils/leadImportValidator';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeftRight, Check, X, AlertTriangle } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/config';

const ImportExportPage = () => {
  const [parsedLeads, setParsedLeads] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // AI Outreach State
  const [aiOutreachEnabled, setAiOutreachEnabled] = useState(false);
  const [outreachChannel, setOutreachChannel] = useState('voice');
  const [campaignContext, setCampaignContext] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const { currentUser } = useAuth();

  // Re-validate all leads when AI Outreach toggle changes
  useEffect(() => {
    if (parsedLeads.length === 0) return;
    setParsedLeads(prev => prev.map(lead => ({
      ...lead,
      _errors: validateLeadRow(lead, { aiOutreachEnabled })
    })));
  }, [aiOutreachEnabled]);

  const handleUpdateLead = (id, field, value) => {
    setParsedLeads(prev => prev.map(lead => {
      if (lead.id === id) {
        const updatedLead = { ...lead, [field]: value };
        updatedLead._errors = validateLeadRow(updatedLead, { aiOutreachEnabled });
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
    setDispatchResult(null);
    try {
      const result = await batchWriteLeads(parsedLeads, currentUser.uid);
      setSuccess(true);
      setParsedLeads([]);
      setTimeout(() => setSuccess(false), 3000);

      // Trigger Cloud Tasks dispatcher if AI Outreach is ON
      if (aiOutreachEnabled && result.success > 0) {
        setIsDispatching(true);
        try {
          const dispatchFn = httpsCallable(functions, 'dispatchLeadBatchToTaskQueue');
          const dispatchRes = await dispatchFn({
            leadIds: result.importedLeadIds,
            channel: outreachChannel,
            campaignContext,
            tenantId: currentUser.uid,
          });
          setDispatchResult({ tasksEnqueued: dispatchRes.data.tasksEnqueued });
        } catch (dispatchErr) {
          console.error("Dispatch Error:", dispatchErr);
          alert('Leads saved, but failed to queue AI Outreach tasks.');
        } finally {
          setIsDispatching(false);
        }
      }
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
            <div>
              <ImportPanel onLeadsParsed={setParsedLeads} />
            </div>
            
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
                disabled={hasErrors || isSubmitting || isDispatching || (aiOutreachEnabled && outreachChannel === 'none')}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Check size={16} />
                {isSubmitting || isDispatching ? 'Committing...' : `Commit ${parsedLeads.length} Leads`}
              </button>
            </div>
          </div>

          {/* ── AI Outreach Configuration Card (Moved to Staging) ─────────────────────────────── */}
          <div className={`
            rounded-xl border p-4 transition-colors
            ${aiOutreachEnabled ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-gray-50'}
          `}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">Autonomous AI Outreach</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enable to auto-dial/message these imported leads immediately after commit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiOutreachEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${aiOutreachEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                role="switch"
                aria-checked={aiOutreachEnabled}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow
                  transition-transform ${aiOutreachEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {aiOutreachEnabled && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Outreach Channel</label>
                  <select
                  value={outreachChannel}
                  onChange={(e) => setOutreachChannel(e.target.value)}
                  className="block w-full max-w-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 pl-3"
                >
                  <option value="none">No immediate outreach</option>
                  <option value="voice">🎙 AI Voice Call (Vapi)</option>
                  <option value="bland">🎙 AI Voice Call (Bland AI)</option>
                  <option value="whatsapp">📱 WhatsApp Message (Twilio)</option>
                </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Campaign-Specific Instructions</label>
                  <textarea
                    value={campaignContext}
                    onChange={e => setCampaignContext(e.target.value)}
                    rows={3}
                    placeholder='e.g., "For this list, offer our 15% Summer Discount package."'
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    AI Outreach requires valid E.164 phone numbers (e.g., +919876543210).
                    Rows with invalid numbers will be highlighted below and must be corrected before you can commit.
                  </p>
                </div>
              </div>
            )}
          </div>

          {dispatchResult && (
             <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm mb-4">
               <div>
                 <p className="font-semibold text-sm">Autonomous Dispatch Triggered!</p>
                 <p className="text-xs text-indigo-600 mt-0.5">{dispatchResult.tasksEnqueued} tasks successfully enqueued for AI Outreach.</p>
               </div>
             </div>
          )}

          <StagingTable leads={parsedLeads} onUpdate={handleUpdateLead} />
        </div>
      )}
    </div>
  );
};

export default ImportExportPage;
