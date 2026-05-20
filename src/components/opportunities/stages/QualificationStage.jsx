import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';
import { formatINR } from '../../../utils/formatCurrency';

const QualificationStage = ({ opportunity, isEditable }) => {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    projectTitle:    '',
    projectBrief:    '',
    estimatedBudget: 0,
  });

  useEffect(() => {
    const q = opportunity.qualification || {};
    setForm({
      projectTitle:    q.projectTitle    || '',
      projectBrief:    q.projectBrief    || '',
      estimatedBudget: q.estimatedBudget || 0,
    });
  }, [opportunity.qualification]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        'qualification.projectTitle':    form.projectTitle,
        'qualification.projectBrief':    form.projectBrief,
        'qualification.estimatedBudget': Number(form.estimatedBudget),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const input = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all';
  const roInput = 'w-full p-2.5 bg-gray-100 border border-gray-100 rounded-xl text-sm text-gray-600 cursor-default';

  return (
    <div className="space-y-5">
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
        <p className="text-sm font-bold text-slate-700">Stage 2 — Qualification</p>
        <p className="text-xs text-slate-500 mt-1">Define the project scope and initial budget estimate.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Project Title</label>
          {isEditable
            ? <input type="text" value={form.projectTitle} onChange={e => setForm(p => ({...p, projectTitle: e.target.value}))} className={input} placeholder="e.g. Brand Identity Redesign" />
            : <div className={roInput}>{form.projectTitle || '—'}</div>}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Project Brief</label>
          {isEditable
            ? <textarea rows={4} value={form.projectBrief} onChange={e => setForm(p => ({...p, projectBrief: e.target.value}))} className={`${input} resize-none`} placeholder="Short scope summary..." />
            : <div className={`${roInput} min-h-[80px]`}>{form.projectBrief || '—'}</div>}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Estimated Budget (₹)</label>
          {isEditable
            ? <input type="number" min="0" value={form.estimatedBudget} onChange={e => setForm(p => ({...p, estimatedBudget: e.target.value}))} className={`${input} font-bold`} />
            : <div className={`${roInput} font-bold`}>{formatINR(form.estimatedBudget)}</div>}
        </div>
      </div>

      {isEditable && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className={`px-5 py-2 text-sm font-bold rounded-xl flex items-center gap-2 transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-60`}>
            <Save size={14} />{saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

export default QualificationStage;
