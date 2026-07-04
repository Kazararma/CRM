import React from 'react';
import { CheckCircle2, XCircle, Circle, ArrowRight } from 'lucide-react';

const LeadPhaseTimeline = ({ lead, onTriggerDispatch }) => {
  const { phase, executionMode } = lead;

  const isInitial = phase === 'initial';
  const isContacted = phase === 'contacted';
  const isSuccess = phase === 'success';
  const isFail = phase === 'fail';

  return (
    <div className="flex items-center justify-between max-w-sm w-full mx-auto sm:mx-0">
      {/* Initial Node */}
      <div 
        className={`flex flex-col items-center gap-1 ${isInitial && executionMode !== 'manual' ? 'cursor-pointer hover:opacity-80' : ''}`}
        onClick={() => {
          if (isInitial && executionMode !== 'manual' && onTriggerDispatch) {
            onTriggerDispatch();
          }
        }}
      >
        {isInitial ? (
          <div className="w-6 h-6 rounded-full bg-blue-600 border-2 border-blue-600 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
        ) : (
          <CheckCircle2 size={24} className="text-blue-600" />
        )}
        <span className={`text-xs font-bold ${isInitial ? 'text-blue-600' : 'text-gray-500'}`}>Initial</span>
      </div>

      <div className="flex-1 h-0.5 bg-gray-200 mx-2">
        <div className={`h-full bg-blue-600 transition-all ${!isInitial ? 'w-full' : 'w-0'}`} />
      </div>

      {/* Contacted Node */}
      <div className="flex flex-col items-center gap-1">
        {isContacted ? (
          <div className="w-6 h-6 rounded-full bg-blue-600 border-2 border-blue-600 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
        ) : isSuccess || isFail ? (
          <CheckCircle2 size={24} className="text-blue-600" />
        ) : (
          <Circle size={24} className="text-gray-300" />
        )}
        <span className={`text-xs font-bold ${isContacted ? 'text-blue-600' : (isSuccess || isFail ? 'text-gray-500' : 'text-gray-400')}`}>Contacted</span>
      </div>

      <div className="flex-1 h-0.5 bg-gray-200 mx-2">
        <div className={`h-full transition-all ${(isSuccess || isFail) ? 'bg-blue-600 w-full' : 'w-0'}`} />
      </div>

      {/* Terminal Node */}
      <div className="flex flex-col items-center gap-1">
        {isSuccess ? (
          <CheckCircle2 size={24} className="text-green-600" />
        ) : isFail ? (
          <XCircle size={24} className="text-red-600" />
        ) : (
          <Circle size={24} className="text-gray-300" />
        )}
        <span className={`text-xs font-bold ${isSuccess ? 'text-green-600' : isFail ? 'text-red-600' : 'text-gray-400'}`}>
          {isSuccess ? 'Success' : isFail ? 'Fail' : 'Outcome'}
        </span>
      </div>
    </div>
  );
};

export default LeadPhaseTimeline;
