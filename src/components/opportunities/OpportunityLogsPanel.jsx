import React, { useState } from 'react';
import { useOpportunityLogs } from '../../hooks/useOpportunityLogs';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Send, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';

const OpportunityLogsPanel = ({ opportunityId, currentPhase }) => {
  const { currentUser, userProfile } = useAuth();
  const { logs, loading } = useOpportunityLogs(opportunityId);
  const [newLog, setNewLog] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!newLog.trim() || !opportunityId) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'opportunities', opportunityId, 'opportunity_logs'), {
        content: newLog.trim(),
        phase: currentPhase,
        loggedBy: currentUser.uid,
        loggerName: userProfile?.displayName || currentUser.email,
        createdAt: serverTimestamp(),
        attachments: [],
      });
      setNewLog('');
    } catch (err) {
      console.error("Error adding log:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
      <div className="p-4 bg-white border-b border-gray-100">
        <form onSubmit={handleSubmitLog} className="relative">
          <textarea
            value={newLog}
            onChange={(e) => setNewLog(e.target.value)}
            placeholder="Log a note, communication, or update..."
            className="w-full p-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
            rows="2"
          />
          <button 
            type="submit" 
            disabled={isSubmitting || !newLog.trim()}
            className="absolute bottom-3 right-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-4 text-gray-400 text-sm">Loading logs...</div>
        ) : logs.length > 0 ? (
          logs.map(log => (
            <div key={log.logId} className="flex gap-3 animate-in fade-in">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">
                {log.loggerName ? log.loggerName.charAt(0).toUpperCase() : <UserIcon size={14} />}
              </div>
              <div className="flex-1 bg-white p-3 rounded-xl rounded-tl-none shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{log.loggerName}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {log.phase}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400">
                    {log.createdAt ? format(log.createdAt.toDate ? log.createdAt.toDate() : new Date(log.createdAt), 'dd MMM, HH:mm') : 'Just now'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.content}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">No logs recorded yet.</div>
        )}
      </div>
    </div>
  );
};

export default OpportunityLogsPanel;
