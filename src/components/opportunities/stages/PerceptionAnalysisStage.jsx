import React, { useState, useEffect } from 'react';
import { Save, Plus, X, Swords } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';

const PerceptionAnalysisStage = ({ opportunity, isEditable }) => {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [overallNotes, setOverallNotes] = useState('');
  const [rows, setRows] = useState([{ us: '', them: '' }]);

  useEffect(() => {
    const p = opportunity.perceptionAnalysis || {};
    setOverallNotes(p.overallNotes || '');
    setRows(p.comparisonRows?.length ? p.comparisonRows : [{ us: '', them: '' }]);
  }, [opportunity.perceptionAnalysis]);

  const addRow = () => setRows(r => [...r, { us: '', them: '' }]);
  const removeRow = (i) => setRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        'perceptionAnalysis.overallNotes': overallNotes,
        'perceptionAnalysis.comparisonRows': rows.filter(r => r.us || r.them),
        updatedAt: serverTimestamp(), updatedBy: currentUser.uid,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const input = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none';

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <p className="text-sm font-bold text-amber-800">Stage 6 — Perception Analysis</p>
        <p className="text-xs text-amber-600 mt-1">Analyze how the client perceives us versus competitors.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Overall Notes</label>
          {isEditable
            ? <textarea rows={3} value={overallNotes} onChange={e=>setOverallNotes(e.target.value)} className={`${input} resize-none`} placeholder="General perception, strong points, weak points..." />
            : <div className="w-full p-2.5 bg-gray-100 border border-gray-100 rounded-xl text-sm text-gray-600 min-h-[60px]">{overallNotes || '—'}</div>}
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 mb-2">
            <Swords size={16} className="text-gray-400" />
            <h4 className="text-xs font-bold text-gray-700">Competitor Comparison</h4>
          </div>
          
          {rows.map((row, i) => (
            <div key={i} className="flex gap-4 items-start relative bg-gray-50/50 p-3 rounded-xl border border-gray-100">
              <div className="flex-1 space-y-1">
                <label className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Us (Our Strengths/Weaknesses)</label>
                {isEditable
                  ? <textarea rows={2} value={row.us} onChange={e=>updateRow(i, 'us', e.target.value)} className={`${input} resize-none text-xs`} placeholder="Our edge..." />
                  : <div className="p-2 bg-white border border-gray-100 rounded-lg text-xs text-gray-600 min-h-[40px]">{row.us||'—'}</div>}
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Them (Competitors)</label>
                {isEditable
                  ? <textarea rows={2} value={row.them} onChange={e=>updateRow(i, 'them', e.target.value)} className={`${input} resize-none text-xs`} placeholder="Competitor edge..." />
                  : <div className="p-2 bg-white border border-gray-100 rounded-lg text-xs text-gray-600 min-h-[40px]">{row.them||'—'}</div>}
              </div>
              {isEditable && rows.length > 1 && (
                <button onClick={() => removeRow(i)} className="absolute -top-2 -right-2 p-1 bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 shadow-sm rounded-full transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          {isEditable && (
            <button onClick={addRow} className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 px-1 py-1">
              <Plus size={14} /> Add Comparison Row
            </button>
          )}
        </div>
      </div>

      {isEditable && (
        <div className="flex justify-end pt-2 border-t border-gray-50">
          <button onClick={handleSave} disabled={saving} className={`px-5 py-2 text-sm font-bold rounded-xl flex items-center gap-2 ${saved?'bg-emerald-500 text-white':'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-60`}>
            <Save size={14}/>{saving?'Saving…':saved?'✓ Saved!':'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PerceptionAnalysisStage;
