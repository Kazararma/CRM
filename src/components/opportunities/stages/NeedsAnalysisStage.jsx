import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';
import { formatINR } from '../../../utils/formatCurrency';

const NeedsAnalysisStage = ({ opportunity, isEditable }) => {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [form, setForm] = useState({ detailedProjectDetails: '', estimatedCosts: 0, painPoints: '' });

  useEffect(() => {
    const n = opportunity.needsAnalysis || {};
    setForm({ detailedProjectDetails: n.detailedProjectDetails || '', estimatedCosts: n.estimatedCosts || 0, painPoints: n.painPoints || '' });
  }, [opportunity.needsAnalysis]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        'needsAnalysis.detailedProjectDetails': form.detailedProjectDetails,
        'needsAnalysis.estimatedCosts':         Number(form.estimatedCosts),
        'needsAnalysis.painPoints':             form.painPoints,
        updatedAt: serverTimestamp(), updatedBy: currentUser.uid,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const input  = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all';
  const roInp  = 'w-full p-2.5 bg-gray-100 border border-gray-100 rounded-xl text-sm text-gray-600 cursor-default';

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm font-bold text-blue-800">Stage 3 — Needs Analysis</p>
        <p className="text-xs text-blue-600 mt-1">Deep-dive into what the client really needs and what it will cost internally.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Detailed Project Details</label>
          {isEditable ? <textarea rows={5} value={form.detailedProjectDetails} onChange={e => setForm(p=>({...p,detailedProjectDetails:e.target.value}))} className={`${input} resize-none`} placeholder="Full project scope, deliverables, timelines..." /> : <div className={`${roInp} min-h-[100px]`}>{form.detailedProjectDetails||'—'}</div>}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Estimated Internal Costs (₹)</label>
          {isEditable ? <input type="number" min="0" value={form.estimatedCosts} onChange={e=>setForm(p=>({...p,estimatedCosts:e.target.value}))} className={`${input} font-bold`} /> : <div className={`${roInp} font-bold`}>{formatINR(form.estimatedCosts)}</div>}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Client Pain Points</label>
          {isEditable ? <textarea rows={3} value={form.painPoints} onChange={e=>setForm(p=>({...p,painPoints:e.target.value}))} className={`${input} resize-none`} placeholder="What problems does the client need solved?" /> : <div className={`${roInp} min-h-[60px]`}>{form.painPoints||'—'}</div>}
        </div>
      </div>

      {isEditable && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className={`px-5 py-2 text-sm font-bold rounded-xl flex items-center gap-2 transition-all ${saved?'bg-emerald-500 text-white':'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-60`}>
            <Save size={14}/>{saving?'Saving…':saved?'✓ Saved!':'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

export default NeedsAnalysisStage;
