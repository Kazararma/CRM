import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';
import { getAllUsers } from '../../../firebase/userService';

const DecisionMakersStage = ({ opportunity, isEditable }) => {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  
  const [admins, setAdmins] = useState([]);
  const [selectedAdminIds, setSelectedAdminIds] = useState([]);
  const [stakeholderNotes, setStakeholderNotes] = useState('');

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const users = await getAllUsers();
        const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'super_admin');
        setAdmins(adminUsers);
      } catch (err) {
        console.error('Error fetching admins:', err);
      }
    };
    fetchAdmins();
  }, []);

  useEffect(() => {
    const d = opportunity.decisionMakers || {};
    setStakeholderNotes(d.stakeholderNotes || '');
    // Provide a default fallback to current user if none assigned yet
    const initialIds = d.assignedAdminIds?.length ? d.assignedAdminIds : [currentUser.uid];
    setSelectedAdminIds(initialIds);
  }, [opportunity.decisionMakers, currentUser.uid]);

  const handleSave = async () => {
    setSaving(true);
    // Map selected IDs to names based on the fetched admins list
    const selectedAdminsData = admins.filter(a => selectedAdminIds.includes(a.id));
    const names = selectedAdminsData.map(a => a.displayName || a.email);
    
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        'decisionMakers.assignedAdminNames': names,
        'decisionMakers.assignedAdminIds':   selectedAdminIds,
        'decisionMakers.stakeholderNotes':   stakeholderNotes,
        updatedAt: serverTimestamp(), updatedBy: currentUser.uid,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const input = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none';
  const roInp = 'w-full p-2.5 bg-gray-100 border border-gray-100 rounded-xl text-sm text-gray-600 cursor-default';

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm font-bold text-blue-800">Stage 5 — Decision Makers</p>
        <p className="text-xs text-blue-600 mt-1">Identify who is managing this deal internally and document client stakeholders.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Assigned Admin(s)</label>
          <p className="text-[10px] text-gray-400">Select admins managing this deal.</p>
          <div className="flex flex-wrap gap-2">
            {admins.map(admin => {
              const isSelected = selectedAdminIds.includes(admin.id);
              return (
                <button
                  key={admin.id}
                  disabled={!isEditable}
                  onClick={() => {
                    if (!isEditable) return;
                    setSelectedAdminIds(prev => 
                      prev.includes(admin.id) ? prev.filter(id => id !== admin.id) : [...prev, admin.id]
                    );
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    isSelected 
                      ? 'bg-blue-600 text-white border-blue-700 shadow-sm' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-blue-50'
                  } ${!isEditable ? 'opacity-60 cursor-not-allowed hover:bg-white' : ''}`}
                >
                  {admin.displayName || admin.email}
                </button>
              );
            })}
            {admins.length === 0 && <span className="text-xs text-gray-400">Loading admins...</span>}
          </div>
        </div>
        
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Client Stakeholder Notes</label>
          {isEditable
            ? <textarea rows={4} value={stakeholderNotes} onChange={e=>setStakeholderNotes(e.target.value)} className={`${input} resize-none`} placeholder="Key client contacts, their roles, decision-making power..." />
            : <div className={`${roInp} min-h-[80px]`}>{stakeholderNotes||'—'}</div>}
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

export default DecisionMakersStage;
