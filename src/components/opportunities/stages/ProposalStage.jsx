import React, { useState, useEffect, useMemo } from 'react';
import { Save, FileText, Plus, Trash2, Download, Loader, Mail, AlertCircle } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';
import { formatINR } from '../../../utils/formatCurrency';
import { getInvoiceSettings } from '../../../services/settingsService';
import { generateProposalPDF } from '../../../utils/generateProposalPDF';
import SendEmailModal from './SendEmailModal';

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

  // --- NEW STATE BEGIN ---
  const [proposalCreationDate, setProposalCreationDate] = useState('');
  const [proposalExpiryDate, setProposalExpiryDate]     = useState('');
  const [paymentTerms, setPaymentTerms]                 = useState('');
  const [deliveryCompletion, setDeliveryCompletion]     = useState('');
  const [proposalTo, setProposalTo]                     = useState('');
  const [proposalDear, setProposalDear]                 = useState('');

  const [billingName, setBillingName]               = useState('');
  const [billingCompanyName, setBillingCompanyName] = useState('');
  const [billingAddress, setBillingAddress]         = useState('');
  const [billingCity, setBillingCity]               = useState('');
  const [billingPincode, setBillingPincode]         = useState('');
  const [billingContactNumbers, setBillingContactNumbers] = useState('');
  const [billingWebsite, setBillingWebsite]         = useState('');
  const [billingGstNo, setBillingGstNo]             = useState('');

  const [lineItems, setLineItems] = useState([
    { id: crypto.randomUUID(), description: '', unitPrice: 0, qty: 1, amount: 0 },
  ]);

  const [useIgst, setUseIgst] = useState(false);
  const [specialTerms, setSpecialTerms] = useState('');

  const [isGeneratingPdf, setIsGeneratingPdf]   = useState(false);
  const [isSendingEmail, setIsSendingEmail]     = useState(false);
  const [proposalError, setProposalError]       = useState(null);
  const [showEmailModal, setShowEmailModal]     = useState(false);

  const [companySettings, setCompanySettings] = useState(null);
  // --- NEW STATE END ---

  // Convert Firestore Timestamp to YYYY-MM-DD string for input type="date"
  const formatDateForInput = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    getInvoiceSettings()
      .then(settings => setCompanySettings(settings))
      .catch(err => console.error('[ProposalStage] Failed to load company settings:', err));
  }, []);

  useEffect(() => {
    const p = opportunity.proposal || {};
    setForm({
      moneyAskedFromClient: p.moneyAskedFromClient || 0,
      initialPaymentAmount: p.initialPaymentAmount || 0,
      contractStartDate:    formatDateForInput(p.contractStartDate),
      contractEndDate:      formatDateForInput(p.contractEndDate),
      contractTermsDetails: p.contractTermsDetails || '',
    });

    setBillingName(p.billingName ?? opportunity.clientName ?? '');
    setBillingCompanyName(p.billingCompanyName ?? opportunity.clientName ?? '');
    setProposalCreationDate(
      p.creationDate
        ? p.creationDate
        : new Date().toISOString().split('T')[0]
    );
    setProposalExpiryDate(p.expiryDate ?? '');
    setPaymentTerms(p.paymentTerms ?? '');
    setDeliveryCompletion(p.deliveryCompletion ?? '');
    setProposalTo(p.proposalTo ?? opportunity.clientName ?? '');
    setProposalDear(p.proposalDear ?? '');
    setBillingAddress(p.billingAddress ?? '');
    setBillingCity(p.billingCity ?? '');
    setBillingPincode(p.billingPincode ?? '');
    setBillingContactNumbers(p.billingContactNumbers ?? opportunity.clientPhone ?? '');
    setBillingWebsite(p.billingWebsite ?? '');
    setBillingGstNo(p.billingGstNo ?? '');

    if (p.lineItems && p.lineItems.length > 0) {
      setLineItems(p.lineItems);
    }
    setUseIgst(p.useIgst ?? false);
    setSpecialTerms(p.specialTerms ?? '');
  }, [opportunity.proposal, opportunity.clientName, opportunity.clientPhone]);

  const addLineItemRow = () => {
    setLineItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), description: '', unitPrice: 0, qty: 1, amount: 0 },
    ]);
  };

  const removeLineItemRow = (id) => {
    setLineItems(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(item => item.id !== id);
    });
  };

  const updateLineItem = (id, field, value) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.amount = parseFloat(
        (Number(updated.unitPrice || 0) * Number(updated.qty || 0)).toFixed(2)
      );
      return updated;
    }));
  };

  const subTotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    [lineItems]
  );

  const cgst = useMemo(
    () => useIgst ? 0 : parseFloat((subTotal * 0.09).toFixed(2)),
    [subTotal, useIgst]
  );

  const sgst = useMemo(
    () => useIgst ? 0 : parseFloat((subTotal * 0.09).toFixed(2)),
    [subTotal, useIgst]
  );

  const igst = useMemo(
    () => useIgst ? parseFloat((subTotal * 0.18).toFixed(2)) : 0,
    [subTotal, useIgst]
  );

  const grandTotal = useMemo(
    () => parseFloat((subTotal + cgst + sgst + igst).toFixed(2)),
    [subTotal, cgst, sgst, igst]
  );

  const handleGeneratePDF = async () => {
    setProposalError(null);

    if (!companySettings) {
      setProposalError('Company settings not loaded. Please check Invoice Settings.');
      return;
    }
    
    if (lineItems.every(item => !item.description.trim())) {
      setProposalError('Please add at least one line item with a description.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const pdfDataUrl = await generateProposalPDF({
        companySettings,
        proposalHeader: {
          creationDate:     proposalCreationDate,
          expiryDate:       proposalExpiryDate,
          paymentTerms,
          deliveryCompletion,
          to:   proposalTo,
          dear: proposalDear,
        },
        billingTo: {
          name:           billingName,
          companyName:    billingCompanyName,
          address:        billingAddress,
          city:           billingCity,
          pincode:        billingPincode,
          contactNumbers: billingContactNumbers,
          website:        billingWebsite,
          gstNo:          billingGstNo,
        },
        lineItems,
        totals: { subTotal, cgst, sgst, igst, grandTotal, useIgst },
        specialTerms,
        opportunityTitle: opportunity.title ?? 'Proposal',
      });
      return pdfDataUrl;
    } catch (err) {
      console.error('[ProposalStage] PDF generation failed:', err);
      setProposalError(`PDF generation failed: ${err.message}`);
      return null;
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setProposalError(null);
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        'proposal.moneyAskedFromClient': Number(form.moneyAskedFromClient),
        'proposal.initialPaymentAmount': Number(form.initialPaymentAmount),
        'proposal.contractStartDate':    form.contractStartDate ? new Date(form.contractStartDate) : null,
        'proposal.contractEndDate':      form.contractEndDate ? new Date(form.contractEndDate) : null,
        'proposal.contractTermsDetails': form.contractTermsDetails,
        'proposal.creationDate': proposalCreationDate,
        'proposal.expiryDate': proposalExpiryDate,
        'proposal.paymentTerms': paymentTerms,
        'proposal.deliveryCompletion': deliveryCompletion,
        'proposal.proposalTo': proposalTo,
        'proposal.proposalDear': proposalDear,
        'proposal.billingName': billingName,
        'proposal.billingCompanyName': billingCompanyName,
        'proposal.billingAddress': billingAddress,
        'proposal.billingCity': billingCity,
        'proposal.billingPincode': billingPincode,
        'proposal.billingContactNumbers': billingContactNumbers,
        'proposal.billingWebsite': billingWebsite,
        'proposal.billingGstNo': billingGstNo,
        'proposal.lineItems': lineItems,
        'proposal.useIgst': useIgst,
        'proposal.specialTerms': specialTerms,
        updatedAt: serverTimestamp(), updatedBy: currentUser.uid,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { 
      console.error(e); 
      setProposalError('Failed to save data. Try again.');
    } finally { 
      setSaving(false); 
    }
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
            <Save size={14}/>{saving?'Saving…':saved?'✓ Saved!':'Save Stage Data'}
          </button>
        </div>
      )}

      {/* --- NEW UI BELOW --- */}

      {/* Section: Proposal Header */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <FileText size={16} className="text-indigo-500" />
          Proposal Document Details
        </h4>

        {/* 2-column grid on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Creation Date</label>
            <input
              type="date"
              value={proposalCreationDate}
              onChange={e => setProposalCreationDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Expiry Date</label>
            <input
              type="date"
              value={proposalExpiryDate}
              onChange={e => setProposalExpiryDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Payment Terms</label>
            <input
              type="text"
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
              placeholder="e.g., 50% advance, 50% on delivery"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Delivery / Completion</label>
            <input
              type="text"
              value={deliveryCompletion}
              onChange={e => setDeliveryCompletion(e.target.value)}
              placeholder="e.g., 45 working days from kick-off"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">To (Recipient)</label>
            <input
              type="text"
              value={proposalTo}
              onChange={e => setProposalTo(e.target.value)}
              placeholder="Company or person name"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Dear (Salutation)</label>
            <input
              type="text"
              value={proposalDear}
              onChange={e => setProposalDear(e.target.value)}
              placeholder="e.g., Mr. Rajan Sharma"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Section: Client Billing Details */}
      <div className="mt-6">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Client Billing Details
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Billing Name</label>
            <input type="text" value={billingName} onChange={e=>setBillingName(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Company Name</label>
            <input type="text" value={billingCompanyName} onChange={e=>setBillingCompanyName(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-600">Billing Address</label>
            <input type="text" value={billingAddress} onChange={e=>setBillingAddress(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">City</label>
            <input type="text" value={billingCity} onChange={e=>setBillingCity(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Pincode</label>
            <input type="text" value={billingPincode} onChange={e=>setBillingPincode(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-600">Contact Numbers (comma separated)</label>
            <input type="text" value={billingContactNumbers} onChange={e=>setBillingContactNumbers(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Website</label>
            <input type="text" value={billingWebsite} onChange={e=>setBillingWebsite(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">GST Number</label>
            <input type="text" value={billingGstNo} onChange={e=>setBillingGstNo(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
      </div>

      {/* Section: Proposal Line Items */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Proposal Items
          </h4>
          <button
            type="button"
            onClick={addLineItemRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <Plus size={14} />
            Add Row
          </button>
        </div>

        {/* Scrollable table wrapper for narrow screens */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-8">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Item & Description</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-32">Unit Price (₹)</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-32">Amount (₹)</th>
                <th className="w-10"></th>{/* Remove button column */}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineItems.map((item, idx) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                      placeholder="Item or service description"
                      className="w-full border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={e => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded px-2 py-1 text-sm text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.qty}
                      onChange={e => updateLineItem(item.id, 'qty', parseInt(e.target.value, 10) || 1)}
                      className="w-full border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded px-2 py-1 text-sm text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-medium text-gray-700">
                    {formatINR(item.amount)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeLineItemRow(item.id)}
                      disabled={lineItems.length <= 1}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Remove row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section: Tax & Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-xs space-y-2">

          {/* IGST Toggle */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Apply IGST (18%) instead of CGST+SGST</span>
            <button
              type="button"
              onClick={() => setUseIgst(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useIgst ? 'bg-indigo-600' : 'bg-gray-300'}`}
              role="switch"
              aria-checked={useIgst}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${useIgst ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Totals rows — read-only computed values */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Sub-Total</span>
            <span className="font-medium">{formatINR(subTotal)}</span>
          </div>

          {!useIgst && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">CGST (9%)</span>
                <span>{formatINR(cgst)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">SGST (9%)</span>
                <span>{formatINR(sgst)}</span>
              </div>
            </>
          )}

          {useIgst && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">IGST (18%)</span>
              <span>{formatINR(igst)}</span>
            </div>
          )}

          <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-2">
            <span>Total</span>
            <span>{formatINR(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Special Terms & Conditions UI */}
      <div className="mt-6">
        <label className="text-xs font-medium text-gray-600">
          Special Terms & Conditions
        </label>
        <textarea
          value={specialTerms}
          onChange={e => setSpecialTerms(e.target.value)}
          rows={4}
          placeholder="e.g., Freight terms, warranty clauses, SLA details, payment milestones..."
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      </div>

      {/* Section: Proposal Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {/* Generate PDF Button */}
        <button
          type="button"
          onClick={handleGeneratePDF}
          disabled={isGeneratingPdf || !companySettings}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isGeneratingPdf ? (
            <Loader size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {isGeneratingPdf ? 'Generating...' : 'Generate Proposal PDF'}
        </button>

        {/* Send via Email Button */}
        <button
          type="button"
          onClick={() => setShowEmailModal(true)}
          disabled={isSendingEmail || !companySettings}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-indigo-600 bg-white border border-indigo-300 hover:bg-indigo-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Mail size={16} />
          Send via Email
        </button>
      </div>

      {/* Error display */}
      {proposalError && (
        <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
          <AlertCircle size={13} />
          {proposalError}
        </p>
      )}

      {/* Email Modal */}
      <SendEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        recipientEmail={opportunity?.clientEmail || ''}
        opportunityTitle={opportunity?.title || ''}
        grandTotal={grandTotal}
        companySettings={companySettings}
        proposalDear={proposalDear}
        onSendAndDownload={handleGeneratePDF}
      />
    </div>
  );
};

export default ProposalStage;
