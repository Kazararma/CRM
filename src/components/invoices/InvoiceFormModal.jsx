import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { X, Plus, Trash2, FileText, Loader2 } from 'lucide-react';
import { createInvoice, updateInvoice } from '../../services/invoiceService';
import { getInvoiceSettings } from '../../services/settingsService';
import { useAuth } from '../../hooks/useAuth';
import { Timestamp } from 'firebase/firestore';

const formatForDateInput = (dateVal) => {
  if (!dateVal) return new Date().toISOString().split('T')[0];
  if (dateVal.toDate) return dateVal.toDate().toISOString().split('T')[0];
  if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];
  return new Date(dateVal).toISOString().split('T')[0];
};

export default function InvoiceFormModal({ isOpen, onClose, initialData = null }) {
  const { currentUser, userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [globalSettings, setGlobalSettings] = useState(null);
  const isEditing = !!(initialData && initialData.invoiceId);

  useEffect(() => {
    getInvoiceSettings().then(data => {
      if (data) setGlobalSettings(data);
    });
  }, []);

  const { register, control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      ...initialData,
      invoiceDate: formatForDateInput(initialData?.invoiceDate),
      client: initialData?.client || { name: '', phoneNumber: '' },
      clientBusinessName: initialData?.clientBusinessName || '',
      clientTaxId: initialData?.clientTaxId || '',
      clientEmail: initialData?.clientEmail || '',
      clientBusinessAddress: initialData?.clientBusinessAddress || '',
      items: initialData?.items?.length ? initialData.items : [{ description: '', unitPrice: 0, qty: 1 }],
      notesTerms: initialData?.notesTerms || 'Payment is due within 15 days.',
      projectId: initialData?.projectId || null,
      projectTitle: initialData?.projectTitle || null,
      invoiceNumber: initialData?.invoiceNumber || '',
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchedItems = useWatch({ control, name: 'items' }) || [];

  const totals = useMemo(() => {
    const subTotal = watchedItems.reduce((sum, item) => {
      const price = parseFloat(item?.unitPrice || 0);
      const qty = parseFloat(item?.qty || 0);
      return sum + (price * qty);
    }, 0);
    const taxAmount = subTotal * 0.18;
    const total = subTotal + taxAmount;
    
    return {
      subTotal: subTotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2)
    };
  }, [watchedItems]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Convert the string date back to a Timestamp or Date object
      const invoiceDateVal = new Date(data.invoiceDate);
      
      const payload = {
        ...data,
        invoiceDate: Timestamp.fromDate(invoiceDateVal),
        company: globalSettings?.company || {},
        payment: globalSettings?.payment || {},
        preparedBy: globalSettings?.preparedBy || {},
        clientBusinessName: data.clientBusinessName || '',
        clientBusinessAddress: data.clientBusinessAddress || '',
        clientTaxId: data.clientTaxId || '',
        clientEmail: data.clientEmail || '',
      };

      console.log("PAYLOAD GOING TO DATABASE:", payload);

      if (payload.invoiceNumber) {
        payload.invoiceNumber = Number(payload.invoiceNumber);
      } else {
        delete payload.invoiceNumber;
      }

      if (isEditing) {
        await updateInvoice(initialData.invoiceId, payload, currentUser.uid);
      } else {
        await createInvoice(payload, currentUser.uid, currentUser.displayName || userProfile?.displayName);
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {isEditing ? `Edit Invoice #${initialData.invoiceNumber}` : 'New Invoice'}
              </h2>
              <p className="text-sm text-slate-500">
                {initialData?.projectTitle ? `For Project: ${initialData.projectTitle}` : 'Create a manual invoice'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="invoice-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Client Info & Meta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Bill To</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Client Name</label>
                  <input
                    type="text"
                    {...register('client.name', { required: 'Client Name is required' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    placeholder="Company or individual name"
                  />
                  {errors.client?.name && <p className="text-xs text-red-500 mt-1">{errors.client.name.message}</p>}
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                  <input
                    type="text"
                    {...register('client.phoneNumber')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <input
                    type="email"
                    {...register('clientEmail')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    placeholder="client@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Business Name <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <input
                    type="text"
                    {...register('clientBusinessName')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    placeholder="e.g. Acme Corp"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tax ID / GST No. <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <input
                    type="text"
                    {...register('clientTaxId')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    placeholder="Tax ID"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Business Address <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <textarea
                    {...register('clientBusinessAddress')}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                    placeholder="Full business address"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Invoice Details</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Invoice Number</label>
                  <input
                    type="number"
                    {...register('invoiceNumber')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    placeholder="Auto-generated if left blank"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    {...register('invoiceDate', { required: 'Date is required' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                  {errors.invoiceDate && <p className="text-xs text-red-500 mt-1">{errors.invoiceDate.message}</p>}
                </div>
                
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg mt-4">
                    {error}
                  </div>
                )}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Line Items</h3>
                <button
                  type="button"
                  onClick={() => append({ description: '', unitPrice: 0, qty: 1 })}
                  className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus size={16} /> Add Row
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-32">Price (₹)</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-24">Qty</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-32 text-right">Amount</th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fields.map((field, index) => {
                      const price = parseFloat(watchedItems[index]?.unitPrice || 0);
                      const qty = parseFloat(watchedItems[index]?.qty || 0);
                      const rowAmount = (price * qty).toFixed(2);

                      return (
                        <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <input
                              {...register(`items.${index}.description`, { required: true })}
                              className="w-full px-3 py-2 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white rounded-lg transition-colors"
                              placeholder="Item description..."
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              {...register(`items.${index}.unitPrice`, { required: true, min: 0 })}
                              className="w-full px-3 py-2 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white rounded-lg transition-colors"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              {...register(`items.${index}.qty`, { required: true, min: 1 })}
                              className="w-full px-3 py-2 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white rounded-lg transition-colors"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">
                            ₹{rowAmount}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              disabled={fields.length === 1}
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Totals & Notes */}
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-2">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Notes & Terms</label>
                <textarea
                  {...register('notesTerms')}
                  rows={5}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                  placeholder="Terms and conditions..."
                />
              </div>

              <div className="w-full md:w-80 bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Sub-Total</span>
                  <span className="font-medium">₹{totals.subTotal}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Tax (18%)</span>
                  <span className="font-medium">₹{totals.taxAmount}</span>
                </div>
                <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-lg">Total</span>
                  <span className="text-xl font-black text-blue-600 flex items-center">
                    ₹{totals.total}
                  </span>
                </div>
              </div>
            </div>

          </form>
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
            form="invoice-form"
            disabled={isSubmitting}
            className="w-full sm:w-auto justify-center px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl transition-colors flex items-center gap-2 shadow-sm shadow-blue-200"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save Invoice'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
