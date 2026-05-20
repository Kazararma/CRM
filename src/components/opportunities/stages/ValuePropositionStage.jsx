import React, { useState, useEffect } from 'react';
import { Save, Plus, X } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';
import { formatINR } from '../../../utils/formatCurrency';

const ValuePropositionStage = ({ opportunity, isEditable }) => {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [notes, setNotes]   = useState('');
  const [points, setPoints] = useState(['']);

  useEffect(() => {
    const v = opportunity.valueProposition || {};
    setNotes(v.presentationNotes || '');
    setPoints(v.keyValuePoints?.length ? v.keyValuePoints : ['']);
  }, [opportunity.valueProposition]);

  const addPoint  = () => setPoints(p => [...p, '']);
  const removePoint = (i) => setPoints(p => p.filter((_, idx) => idx !== i));
  const updatePoint = (i, val) => setPoints(p => p.map((v, idx) => idx === i ? val : v));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        'valueProposition.presentationNotes': notes,
        'valueProposition.keyValuePoints':    points.filter(Boolean),
        updatedAt: serverTimestamp(), updatedBy: currentUser.uid,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const input = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none';

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm font-bold text-blue-800">Stage 4 — Value Proposition</p>
        <p className="text-xs text-blue-600 mt-1">How does our solution map to the client's needs?</p>
      </div>

      {/* Read-only context from Needs Analysis */}
      {opportunity.needsAnalysis?.detailedProjectDetails && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-1">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Context: Project Details (from Needs Analysis)</p>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{opportunity.needsAnalysis.detailedProjectDetails}</p>
          {opportunity.needsAnalysis.estimatedCosts > 0 && (
            <p className="text-xs font-bold text-gray-500 mt-2">Est. Cost: <span className="text-gray-800">{formatINR(opportunity.needsAnalysis.estimatedCosts)}</span></p>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Presentation Notes</label>
          {isEditable
            ? <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} className={`${input} resize-none`} placeholder="How our solution maps to their project details..." />
            : <div className="w-full p-2.5 bg-gray-100 border border-gray-100 rounded-xl text-sm text-gray-600 min-h-[80px]">{notes || '—'}</div>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Key Value Points</label>
          {points.map((pt, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-xs font-bold text-gray-400 w-4 text-right">{i+1}.</span>
              {isEditable
                ? <input type="text" value={pt} onChange={e => updatePoint(i, e.target.value)} className={`${input} flex-1`} placeholder={`Value point ${i+1}...`} />
                : <div className="flex-1 p-2.5 bg-gray-100 border border-gray-100 rounded-xl text-sm text-gray-600">{pt || '—'}</div>}
              {isEditable && points.length > 1 && (
                <button onClick={() => removePoint(i)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {isEditable && (
            <button onClick={addPoint} className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 px-1 py-1">
              <Plus size={14} /> Add Value Point
            </button>
          )}
        </div>
      </div>

      {isEditable && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className={`px-5 py-2 text-sm font-bold rounded-xl flex items-center gap-2 ${saved?'bg-emerald-500 text-white':'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-60`}>
            <Save size={14}/>{saving?'Saving…':saved?'✓ Saved!':'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ValuePropositionStage;
