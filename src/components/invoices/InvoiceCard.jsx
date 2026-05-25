import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Edit, Trash2, Download, Receipt } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { InvoicePDFTemplate } from './pdf/InvoicePDFTemplate';
import { updateInvoiceStatus, deleteInvoice } from '../../services/invoiceService';
import { useAuth } from '../../hooks/useAuth';
import InvoiceFormModal from './InvoiceFormModal';

export default function InvoiceCard({ invoice }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { currentUser } = useAuth();

  const handleStatusChange = async (e) => {
    try {
      await updateInvoiceStatus(invoice.invoiceId, e.target.value, currentUser.uid);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      try {
        await deleteInvoice(invoice.invoiceId, currentUser.uid);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const statusColors = {
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700'
  };

  const formatInvoiceDate = (timestamp) => {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('en-GB'); 
  };

  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm border ${isExpanded ? 'border-indigo-200' : 'border-slate-100'} overflow-hidden transition-all duration-300`}>
        {/* Collapsed Header */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900">#{invoice.invoiceNumber}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[invoice.status] || statusColors.draft}`}>
                {invoice.status}
              </span>
            </div>
            <span className="text-sm font-medium text-slate-700">{invoice.client?.name}</span>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{formatInvoiceDate(invoice.invoiceDate)}</span>
              <span>•</span>
              <span className="italic truncate max-w-[150px]">{invoice.origin === 'project' ? `From: ${invoice.projectTitle}` : 'Scratch'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-lg font-black text-indigo-600">₹{invoice.total?.toLocaleString('en-IN')}</span>
            {isExpanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
          </div>
        </div>

        {/* Expanded Body */}
        {isExpanded && (
          <div className="p-5 border-t border-slate-100 bg-slate-50/30">
            {/* Quick Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase">Company</span>
                <span className="text-slate-700 truncate block">{invoice.company?.name}</span>
                <span className="text-xs text-slate-500">GST: {invoice.company?.gstNumber}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase">Bill To</span>
                <span className="text-slate-700 truncate block">{invoice.client?.name}</span>
                <span className="text-xs text-slate-500">Phone: {invoice.client?.phoneNumber}</span>
              </div>
            </div>

            {/* Line Items Snippet */}
            <div className="mb-4 overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-500">
                  <tr>
                    <th className="p-2 font-semibold">Item & Description</th>
                    <th className="p-2 font-semibold text-right">Unit Price</th>
                    <th className="p-2 font-semibold text-right">Qty</th>
                    <th className="p-2 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {invoice.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2 truncate max-w-[150px]">{item.description}</td>
                      <td className="p-2 text-right">₹{item.unitPrice}</td>
                      <td className="p-2 text-right">{item.qty}</td>
                      <td className="p-2 text-right font-medium">₹{item.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-4 text-sm">
              <div className="w-48 space-y-1 text-slate-600">
                <div className="flex justify-between"><span>Sub-Total:</span> <span>₹{invoice.subTotal}</span></div>
                <div className="flex justify-between"><span>Tax (18%):</span> <span>₹{invoice.taxAmount}</span></div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 mt-1">
                  <span>Total:</span> <span>₹{invoice.total}</span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Status:</span>
                <select 
                  value={invoice.status} 
                  onChange={handleStatusChange}
                  className="text-xs font-bold border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  title="Edit Invoice"
                >
                  <Edit size={16} />
                </button>

                <PDFDownloadLink 
                  document={<InvoicePDFTemplate invoice={invoice} />} 
                  fileName={`Invoice_${invoice.invoiceNumber}.pdf`}
                >
                  {({ loading }) => (
                    <button 
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-md transition-colors ${loading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                      disabled={loading}
                    >
                      <Download size={14} />
                      {loading ? 'Generating...' : 'Download PDF'}
                    </button>
                  )}
                </PDFDownloadLink>

                <button 
                  onClick={handleDelete}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-2"
                  title="Delete Invoice"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <InvoiceFormModal 
          isOpen={isEditing} 
          onClose={() => setIsEditing(false)} 
          initialData={invoice} 
        />
      )}
    </>
  );
}
