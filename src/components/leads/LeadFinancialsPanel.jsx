import React, { useState, useEffect } from 'react';
import { formatINR } from '../../utils/formatCurrency';
import { db } from '../../firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Save, Lock, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

const LeadFinancialsPanel = ({ lead }) => {
  const { currentUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  
  // Local state for negotiation form
  const [formData, setFormData] = useState({
    askedFromClient: 0,
    clientAgreedOn: 0,
    clientPaidAmount: 0
  });

  // Sync from props when entering negotiation phase
  useEffect(() => {
    if (lead?.negotiation) {
      setFormData({
        askedFromClient: lead.negotiation.askedFromClient || 0,
        clientAgreedOn: lead.negotiation.clientAgreedOn || 0,
        clientPaidAmount: lead.negotiation.clientPaidAmount || 0
      });
    }
  }, [lead?.negotiation]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: Number(value) }));
  };

  const handleSaveNegotiation = async () => {
    if (!lead?.id) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        'negotiation.askedFromClient': formData.askedFromClient,
        'negotiation.clientAgreedOn': formData.clientAgreedOn,
        'negotiation.clientPaidAmount': formData.clientPaidAmount,
        finalBilling: formData.clientAgreedOn,
        finalBudget: lead.estimatedBudget, // Budget stays as estimated
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
    } catch (error) {
      console.error("Error saving negotiation:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // 1. Initial Phase View
  if (lead?.phase === 'initial') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 bg-gray-50 rounded-2xl border border-gray-100 text-center">
        <AlertCircle size={32} className="text-gray-300 mb-3" />
        <h3 className="text-sm font-bold text-gray-900 mb-1">Awaiting Negotiation</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Financial negotiation details will appear here once this lead enters the Negotiation phase.
        </p>
        <div className="mt-6 flex gap-6">
          <div className="text-center">
            <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Est. Billing</span>
            <span className="text-lg font-bold text-gray-900">{formatINR(lead.estimatedBilling)}</span>
          </div>
          <div className="text-center">
            <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Est. Budget</span>
            <span className="text-lg font-bold text-gray-900">{formatINR(lead.estimatedBudget)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Calculate derived values for Negotiation and Final phases
  const outstandingBalance = formData.clientAgreedOn - formData.clientPaidAmount;
  const margin = formData.clientAgreedOn - lead.estimatedBudget;
  const isNegativeMargin = margin < 0;

  // 2. Negotiation Phase View (Editable)
  if (lead?.phase === 'negotiation') {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
          <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
            <Lock size={16} /> Negotiation Active
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Update these values as negotiations progress. Saving will automatically update the Final Billing amount.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Asked from Client (₹)</label>
            <input type="number" min="0" name="askedFromClient" value={formData.askedFromClient} onChange={handleChange} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Client Agreed On (₹)</label>
            <input type="number" min="0" name="clientAgreedOn" value={formData.clientAgreedOn} onChange={handleChange} className="w-full p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm font-black text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Client Paid Amount (₹)</label>
            <input type="number" min="0" name="clientPaidAmount" value={formData.clientPaidAmount} onChange={handleChange} className="w-full p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            onClick={handleSaveNegotiation} 
            disabled={isSaving}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save size={16} /> {isSaving ? 'Saving...' : 'Save Negotiation Stats'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Outstanding Balance</span>
            <span className="text-xl font-black text-gray-900">{formatINR(Math.max(0, outstandingBalance))}</span>
          </div>
          <div className={`p-4 rounded-xl border ${isNegativeMargin ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <span className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isNegativeMargin ? 'text-red-500' : 'text-emerald-500'}`}>
              Projected Margin (Agreed - Budget)
            </span>
            <span className={`text-xl font-black flex items-center gap-2 ${isNegativeMargin ? 'text-red-600' : 'text-emerald-600'}`}>
              {isNegativeMargin ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
              {formatINR(margin)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 3. Final or Failed Phase View (Read Only)
  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-xl border ${lead.phase === 'failed' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
        <p className={`text-sm font-bold flex items-center gap-2 ${lead.phase === 'failed' ? 'text-red-800' : 'text-gray-800'}`}>
          <Lock size={16} /> {lead.phase === 'failed' ? 'Lead Failed - Financials Locked' : 'Final Phase - Financials Locked'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Est. Budget</label>
          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">
            {formatINR(lead.finalBudget || lead.estimatedBudget)}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Asked from Client</label>
          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">
            {formatINR(lead.negotiation?.askedFromClient || 0)}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Final Agreed</label>
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm font-black text-blue-900">
            {formatINR(lead.finalBilling || lead.negotiation?.clientAgreedOn || 0)}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Amount Paid</label>
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-900">
            {formatINR(lead.negotiation?.clientPaidAmount || 0)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadFinancialsPanel;
