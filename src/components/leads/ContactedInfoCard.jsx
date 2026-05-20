import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Save, PhoneCall } from 'lucide-react';

const MODE_OPTIONS = [
  { value: 'call',    label: '📞 Call' },
  { value: 'email',   label: '✉️ Email' },
  { value: 'meeting', label: '🤝 Meeting' },
  { value: 'other',   label: '💬 Other' },
];

/**
 * ContactedInfoCard
 * Renders inside the Overview tab of LeadDetailModal when phase !== 'open'.
 * Allows admins to record details about the contact event.
 *
 * Props:
 *   lead        – full lead document (already normalized)
 *   isReadOnly  – true when lead is converted (isConvertedToOpportunity: true)
 */
const ContactedInfoCard = ({ lead, isReadOnly = false }) => {
  const { currentUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    productDescription: '',
    modeOfContact: 'call',
    contactDate: '',
    endOutcome: '',
  });

  // Sync from Firestore data whenever lead prop changes
  useEffect(() => {
    if (lead?.contactedInfo) {
      const ci = lead.contactedInfo;
      let dateStr = '';
      if (ci.contactDate) {
        try {
          const d = ci.contactDate.toDate ? ci.contactDate.toDate() : new Date(ci.contactDate);
          dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD for input[type=date]
        } catch {
          dateStr = '';
        }
      }
      setFormData({
        productDescription: ci.productDescription || '',
        modeOfContact:      ci.modeOfContact      || 'call',
        contactDate:        dateStr,
        endOutcome:         ci.endOutcome          || '',
      });
    }
  }, [lead?.contactedInfo]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!lead?.id) return;
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        'contactedInfo.productDescription': formData.productDescription,
        'contactedInfo.modeOfContact':      formData.modeOfContact,
        'contactedInfo.contactDate':        formData.contactDate
          ? Timestamp.fromDate(new Date(formData.contactDate))
          : null,
        'contactedInfo.endOutcome':         formData.endOutcome,
        updatedAt:                          serverTimestamp(),
        updatedBy:                          currentUser.uid,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('[ContactedInfoCard] Save error:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputBase =
    'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all';
  const readOnlyBase =
    'w-full p-2.5 bg-gray-100 border border-gray-100 rounded-xl text-sm font-medium text-gray-600 cursor-default';

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-3">
        <PhoneCall size={15} className="text-blue-500" />
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Contacted Info
        </h4>
      </div>

      {/* Product / Info Described */}
      <div className="space-y-1">
        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">
          Product / Info Described
        </label>
        {isReadOnly ? (
          <div className={readOnlyBase}>{formData.productDescription || '—'}</div>
        ) : (
          <textarea
            name="productDescription"
            value={formData.productDescription}
            onChange={handleChange}
            rows={3}
            placeholder="Describe the product or service discussed with the client..."
            className={`${inputBase} resize-none`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mode of Contact */}
        <div className="space-y-1">
          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">
            Mode of Contact
          </label>
          {isReadOnly ? (
            <div className={readOnlyBase}>
              {MODE_OPTIONS.find(m => m.value === formData.modeOfContact)?.label || formData.modeOfContact || '—'}
            </div>
          ) : (
            <select
              name="modeOfContact"
              value={formData.modeOfContact}
              onChange={handleChange}
              className={inputBase}
            >
              {MODE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* Date of Contact */}
        <div className="space-y-1">
          <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">
            Date of Contact
          </label>
          {isReadOnly ? (
            <div className={readOnlyBase}>{formData.contactDate || '—'}</div>
          ) : (
            <input
              type="date"
              name="contactDate"
              value={formData.contactDate}
              onChange={handleChange}
              className={inputBase}
            />
          )}
        </div>
      </div>

      {/* End Outcome */}
      <div className="space-y-1">
        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">
          End Outcome
        </label>
        {isReadOnly ? (
          <div className={`${readOnlyBase} min-h-[60px]`}>{formData.endOutcome || '—'}</div>
        ) : (
          <textarea
            name="endOutcome"
            value={formData.endOutcome}
            onChange={handleChange}
            rows={2}
            placeholder="What was the result of the contact? (e.g. client requested a quote)"
            className={`${inputBase} resize-none`}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs font-bold text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Save Button */}
      {!isReadOnly && (
        <div className="flex justify-end pt-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-5 py-2 text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm ${
              saveSuccess
                ? 'bg-emerald-500 text-white border border-emerald-600'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
            } disabled:opacity-60`}
          >
            <Save size={15} />
            {isSaving ? 'Saving…' : saveSuccess ? '✓ Saved!' : 'Save Contacted Info'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ContactedInfoCard;
