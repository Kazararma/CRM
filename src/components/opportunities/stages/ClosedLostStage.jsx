import React, { useState, useEffect } from 'react';
import { Save, XCircle, Trash2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';

const ClosedLostStage = ({ opportunity, isEditable }) => {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [lostReason, setLostReason] = useState('');

  useEffect(() => {
    setLostReason(opportunity.closedLost?.lostReason || '');
  }, [opportunity.closedLost]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        'closedLost.lostReason': lostReason,
        'closedLost.lostDate':   opportunity.closedLost?.lostDate || serverTimestamp(),
        updatedAt: serverTimestamp(), updatedBy: currentUser.uid,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this opportunity?')) return;
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        isDeleted: true,
        updatedAt: serverTimestamp(), updatedBy: currentUser.uid,
      });
      // Modal will close automatically because the snapshot listener will filter this out
    } catch (e) { console.error(e); }
  };

  const input = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all';
  const roInp = 'w-full p-2.5 bg-gray-100 border border-gray-100 rounded-xl text-sm text-gray-600 cursor-default';

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle size={32} />
        </div>
        <h3 className="text-xl font-black text-red-800 mb-2">Deal Lost</h3>
        <p className="text-sm text-red-600 max-w-md mx-auto">
          This opportunity was not won. Please record the reason for loss for future analysis.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Reason for Loss</label>
          {isEditable
            ? <textarea rows={4} value={lostReason} onChange={e=>setLostReason(e.target.value)} className={`${input} resize-none`} placeholder="Pricing, competitor, timing, scope mismatch..." />
            : <div className={`${roInp} min-h-[80px]`}>{lostReason || '—'}</div>}
        </div>
      </div>

      {isEditable && (
        <div className="flex justify-between items-center pt-4 border-t border-gray-50">
          <button onClick={handleDelete} className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl flex items-center gap-2 transition-colors">
            <Trash2 size={14} /> Delete Opportunity
          </button>
          <button onClick={handleSave} disabled={saving} className={`px-5 py-2 text-sm font-bold rounded-xl flex items-center gap-2 ${saved?'bg-emerald-500 text-white':'bg-red-600 hover:bg-red-700 text-white'} disabled:opacity-60`}>
            <Save size={14}/>{saving?'Saving…':saved?'✓ Saved!':'Save Reason'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ClosedLostStage;
