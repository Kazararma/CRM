import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';
import { formatINR } from '../../../utils/formatCurrency';

const NegotiationReviewStage = ({ opportunity, isEditable }) => {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [form, setForm] = useState({
    moneyAgreedByClient: 0,
    initialPaymentAgreedByClient: 0,
    negotiationNotes: '',
  });

  useEffect(() => {
    const n = opportunity.negotiationReview || {};
    // Pre-fill with proposal amounts if negotiation amounts are 0 and proposal exists
    const p = opportunity.proposal || {};
    setForm({
      moneyAgreedByClient: n.moneyAgreedByClient || p.moneyAskedFromClient || 0,
      initialPaymentAgreedByClient: n.initialPaymentAgreedByClient || p.initialPaymentAmount || 0,
      negotiationNotes: n.negotiationNotes || '',
    });
  }, [opportunity.negotiationReview, opportunity.proposal]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        'negotiationReview.moneyAgreedByClient': Number(form.moneyAgreedByClient),
        'negotiationReview.initialPaymentAgreedByClient': Number(form.initialPaymentAgreedByClient),
        'negotiationReview.negotiationNotes': form.negotiationNotes,
        updatedAt: serverTimestamp(), updatedBy: currentUser.uid,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const input = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all';
  const roInp = 'w-full p-2.5 bg-gray-100 border border-gray-100 rounded-xl text-sm text-gray-600 cursor-default';

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <p className="text-sm font-bold text-amber-800">Stage 8 — Negotiation & Review</p>
        <p className="text-xs text-amber-600 mt-1">Finalize the numbers before advancing to Closed Won.</p>
      </div>

      {/* Read-only context from Proposal */}
      {opportunity.proposal?.moneyAskedFromClient > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-1 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Context: Original Proposal Ask</p>
            <p className="text-xs font-medium text-gray-600 mt-1">The initial amount presented to the client.</p>
          </div>
          <div className="text-right">
             <p className="text-lg font-bold text-gray-800">{formatINR(opportunity.proposal.moneyAskedFromClient)}</p>
             <p className="text-xs text-gray-500 font-medium">{formatINR(opportunity.proposal.initialPaymentAmount)} initial</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Agreed Total Amount (₹)</label>
          {isEditable
            ? <input type="number" min="0" value={form.moneyAgreedByClient} onChange={e=>setForm(p=>({...p,moneyAgreedByClient:e.target.value}))} className={`${input} font-bold border-blue-200 focus:ring-blue-500`} />
            : <div className={`${roInp} font-bold text-blue-700`}>{formatINR(form.moneyAgreedByClient)}</div>}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Agreed Initial Payment (₹)</label>
          {isEditable
            ? <input type="number" min="0" value={form.initialPaymentAgreedByClient} onChange={e=>setForm(p=>({...p,initialPaymentAgreedByClient:e.target.value}))} className={`${input} font-bold border-blue-200 focus:ring-blue-500`} />
            : <div className={`${roInp} font-bold text-blue-700`}>{formatINR(form.initialPaymentAgreedByClient)}</div>}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Negotiation Notes</label>
        {isEditable
          ? <textarea rows={4} value={form.negotiationNotes} onChange={e=>setForm(p=>({...p,negotiationNotes:e.target.value}))} className={`${input} resize-none`} placeholder="Details on discounts, scope changes, final agreements..." />
          : <div className={`${roInp} min-h-[80px]`}>{form.negotiationNotes || '—'}</div>}
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

export default NegotiationReviewStage;
