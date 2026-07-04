import React, { useState } from 'react';
import { ChevronDown, ChevronUp, PhoneCall, MessageSquare, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const CycleAccordion = ({ cycle, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusColor = (status) => {
    switch(status) {
      case 'dispatched': return 'text-blue-600 bg-blue-50';
      case 'awaiting_response': return 'text-orange-600 bg-orange-50';
      case 'response_received': return 'text-purple-600 bg-purple-50';
      case 'filtered': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            {cycle.channel === 'twilio_whatsapp' ? <MessageSquare size={14} /> : <PhoneCall size={14} />}
          </div>
          <div className="text-left">
            <h5 className="text-sm font-bold text-gray-900">Cycle #{index}</h5>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-2">
              {cycle.dispatchedAt ? format(cycle.dispatchedAt.toDate ? cycle.dispatchedAt.toDate() : new Date(cycle.dispatchedAt), 'MMM dd, h:mm a') : 'Unknown'}
              <span className={`px-1.5 py-0.5 rounded font-black ${getStatusColor(cycle.status)}`}>
                {cycle.status || 'unknown'}
              </span>
            </span>
          </div>
        </div>
        {isOpen ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
      </button>

      {isOpen && (
        <div className="px-4 py-4 border-t border-gray-100 bg-gray-50/50 space-y-4 text-sm">
          {cycle.meetingSummary && (
            <div>
              <h6 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Meeting Summary</h6>
              <p className="text-gray-800">{cycle.meetingSummary}</p>
            </div>
          )}
          {cycle.aiFeedback && (
            <div>
              <h6 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">AI Feedback</h6>
              <p className="text-gray-800">{cycle.aiFeedback}</p>
            </div>
          )}
          {cycle.closureSignal && (
            <div>
              <h6 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Closure Signal</h6>
              <span className={`px-2 py-1 rounded text-xs font-bold inline-block ${
                cycle.closureSignal === 'success' ? 'bg-green-100 text-green-700' :
                cycle.closureSignal === 'fail' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {cycle.closureSignal.toUpperCase()}
              </span>
            </div>
          )}
          {cycle.promptSentToApi && (
            <div className="pt-2 border-t border-gray-200">
              <h6 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Generated Prompt</h6>
              <div className="bg-gray-100 p-3 rounded-lg text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                {cycle.promptSentToApi}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CycleAccordion;
