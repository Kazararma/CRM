import React, { useState } from 'react';
import { Trophy, CheckCircle, ArrowRightCircle } from 'lucide-react';
import ConvertToProjectConfirmModal from '../ConvertToProjectConfirmModal';

const ClosedWonStage = ({ opportunity, isEditable }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const isConverted = opportunity.closedWon?.isConvertedToProject;

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trophy size={32} />
        </div>
        <h3 className="text-xl font-black text-emerald-800 mb-2">Deal Won!</h3>
        <p className="text-sm text-emerald-600 max-w-md mx-auto">
          Congratulations! The deal is closed and won. You can now convert this opportunity into an active Project to assign workers and begin execution.
        </p>
      </div>

      <div className="flex flex-col items-center py-6">
        {isConverted ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 font-bold">
              <CheckCircle size={20} className="text-emerald-500" />
              Converted to Project
            </div>
            <p className="text-xs text-gray-400">Project ID: {opportunity.closedWon.convertedProjectId}</p>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 hover:-translate-y-1 shadow-lg shadow-emerald-200 transition-all flex items-center gap-3"
          >
            <ArrowRightCircle size={24} />
            Convert to Active Project
          </button>
        )}
      </div>

      {showConfirm && (
        <ConvertToProjectConfirmModal
          opportunity={opportunity}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
};

export default ClosedWonStage;
