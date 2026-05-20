import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';
import { formatINR } from '../../../utils/formatCurrency';

const ProposalStage = ({ opportunity, isEditable }) => {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [form, setForm] = useState({
    moneyAskedFromClient: 0,
    initialPaymentAmount: 0,
    contractStartDate:    '',
    contractEndDate:      '',
    contractTermsDetails: '',
  });

  // Convert Firestore Timestamp to YYYY-MM-DD string for input type="date"
  const formatDateForInput = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    const p = opportunity.proposal || {};
    setForm({
      moneyAskedFromClient: p.moneyAskedFromClient || 0,
      initialPaymentAmount: p.initialPaymentAmount || 0,
      contractStartDate:    formatDateForInput(p.contractStartDate),
      contractEndDate:      formatDateForInput(p.contractEndDate),
      contractTermsDetails: p.contractTermsDetails || '',
    });
  }, [opportunity.proposal]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        'proposal.moneyAskedFromClient': Number(form.moneyAskedFromClient),
        'proposal.initialPaymentAmount': Number(form.initialPaymentAmount),
        'proposal.contractStartDate':    form.contractStartDate ? new Date(form.contractStartDate) : null,
        'proposal.contractEndDate':      form.contractEndDate ? new Date(form.contractEndDate) : null,
        'proposal.contractTermsDetails': form.contractTermsDetails,
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
        <p className="text-sm font-bold text-amber-800">Stage 7 — Proposal</p>
        <p className="text-xs text-amber-600 mt-1">Record the financial ask and initial contract terms presented to the client.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Amount Asked (₹)</label>
          {isEditable
            ? <input type="number" min="0" value={form.moneyAskedFromClient} onChange={e=>setForm(p=>({...p,moneyAskedFromClient:e.target.value}))} className={`${input} font-bold`} />
            : <div className={`${roInp} font-bold`}>{formatINR(form.moneyAskedFromClient)}</div>}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Initial Payment Amount (₹)</label>
          {isEditable
            ? <input type="number" min="0" value={form.initialPaymentAmount} onChange={e=>setForm(p=>({...p,initialPaymentAmount:e.target.value}))} className={`${input} font-bold`} />
            : <div className={`${roInp} font-bold`}>{formatINR(form.initialPaymentAmount)}</div>}
        </div>
        
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Contract Start Date</label>
          {isEditable
            ? <input type="date" value={form.contractStartDate} onChange={e=>setForm(p=>({...p,contractStartDate:e.target.value}))} className={input} />
            : <div className={roInp}>{form.contractStartDate || '—'}</div>}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Contract End Date</label>
          {isEditable
            ? <input type="date" value={form.contractEndDate} onChange={e=>setForm(p=>({...p,contractEndDate:e.target.value}))} className={input} />
            : <div className={roInp}>{form.contractEndDate || '—'}</div>}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Contract Terms Details</label>
          {isEditable
            ? <textarea rows={4} value={form.contractTermsDetails} onChange={e=>setForm(p=>({...p,contractTermsDetails:e.target.value}))} className={`${input} resize-none`} placeholder="Key terms, SLA, payment milestones..." />
            : <div className={`${roInp} min-h-[80px]`}>{form.contractTermsDetails || '—'}</div>}
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

export default ProposalStage;
