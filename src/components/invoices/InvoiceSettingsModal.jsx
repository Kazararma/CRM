import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Settings, Loader2 } from 'lucide-react';
import { getInvoiceSettings, saveInvoiceSettings } from '../../services/settingsService';

export default function InvoiceSettingsModal({ isOpen, onClose }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      company: {
        name: '', addressLine1: '', addressLine2: '', city: '', pincode: '', phoneNumbers: '', website: '', gstNumber: ''
      },
      payment: {
        bankName: '', accountName: '', accountNumber: '', ifscCode: '', upiNumber: ''
      },
      preparedBy: ''
    }
  });

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getInvoiceSettings();
      if (data) {
        // If phoneNumbers is array, convert to string for the input
        if (Array.isArray(data.company?.phoneNumbers)) {
          data.company.phoneNumbers = data.company.phoneNumbers.join(', ');
        }
        reset(data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load settings.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data) => {
    setIsSaving(true);
    setError(null);
    try {
      // Convert phones back to array
      const payload = { ...data };
      if (typeof payload.company.phoneNumbers === 'string') {
        payload.company.phoneNumbers = payload.company.phoneNumbers.split(',').map(s => s.trim()).filter(Boolean);
      }
      
      await saveInvoiceSettings(payload);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
              <Settings size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Global Invoice Settings</h2>
              <p className="text-sm text-slate-500">Configure default company and payment details.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-500 flex-col gap-3">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Loading settings...</p>
            </div>
          ) : (
            <form id="settings-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}

              {/* Company Info */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Company Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Company Name</label>
                    <input {...register('company.name')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Address Line 1</label>
                    <input {...register('company.addressLine1')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Address Line 2</label>
                    <input {...register('company.addressLine2')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">City</label>
                    <input {...register('company.city')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Pincode</label>
                    <input {...register('company.pincode')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">GST Number</label>
                    <input {...register('company.gstNumber')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Numbers (comma separated)</label>
                    <input {...register('company.phoneNumbers')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Website</label>
                    <input {...register('company.website')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Payment Method</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Bank Name</label>
                    <input {...register('payment.bankName')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Account Name</label>
                    <input {...register('payment.accountName')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Account Number</label>
                    <input {...register('payment.accountNumber')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">IFSC Code</label>
                    <input {...register('payment.ifscCode')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">UPI Number</label>
                    <input {...register('payment.upiNumber')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
              </div>

              {/* Prepared By */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Default Prepared By</h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Signature Text</label>
                  <textarea rows={3} {...register('preparedBy')} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500" placeholder="e.g. John Doe, CEO" />
                </div>
              </div>

            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex flex-col-reverse sm:flex-row justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto justify-center px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 bg-slate-100 border border-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="settings-form"
            disabled={isSaving || isLoading}
            className="w-full sm:w-auto justify-center px-5 py-2.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
