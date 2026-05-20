import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';

const ProspectingStage = ({ opportunity, isEditable }) => {
  const { currentUser } = useAuth();
  const current = opportunity.prospecting?.hasPotentialDeal ?? null;
  const [saving, setSaving] = useState(false);

  const handleAnswer = async (value) => {
    if (!isEditable || saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        'prospecting.hasPotentialDeal': value,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
        <p className="text-sm font-bold text-blue-800">Stage 1 — Prospecting</p>
        <p className="text-xs text-blue-600 mt-1">Assess whether this opportunity has real potential. Your answer is informational and does not block phase progression.</p>
      </div>

      <div className="text-center py-6">
        <p className="text-base font-bold text-gray-700 mb-6">Is there a potential deal here?</p>
        <div className="flex items-center justify-center gap-4">
          <button
            disabled={!isEditable || saving}
            onClick={() => handleAnswer(true)}
            className={`flex flex-col items-center gap-2 px-8 py-5 rounded-2xl border-2 transition-all font-bold text-sm ${
              current === true
                ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-200'
                : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <ThumbsUp size={28} />
            YES — Potential Deal
          </button>
          <button
            disabled={!isEditable || saving}
            onClick={() => handleAnswer(false)}
            className={`flex flex-col items-center gap-2 px-8 py-5 rounded-2xl border-2 transition-all font-bold text-sm ${
              current === false
                ? 'bg-red-500 border-red-600 text-white shadow-lg shadow-red-200'
                : 'bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <ThumbsDown size={28} />
            NO — Not Promising
          </button>
        </div>
        {current === null && (
          <p className="mt-4 text-xs text-gray-400 font-medium">No answer recorded yet.</p>
        )}
      </div>
    </div>
  );
};

export default ProspectingStage;
