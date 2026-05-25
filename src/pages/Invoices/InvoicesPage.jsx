import React, { useState } from 'react';
import { useInvoices } from '../../hooks/useInvoices';
import InvoiceCard from '../../components/invoices/InvoiceCard';
import InvoiceFormModal from '../../components/invoices/InvoiceFormModal';
import InvoiceSettingsModal from '../../components/invoices/InvoiceSettingsModal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import EmptyState from '../../components/shared/EmptyState';
import { Receipt, Plus, Settings } from 'lucide-react';

export default function InvoicesPage() {
  const { invoices, loading, error } = useInvoices();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Receipt className="text-indigo-600" size={32} />
            Invoices
          </h1>
          <p className="text-slate-500 mt-1">
            Manage your billing, track payments, and generate PDFs.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm w-full sm:w-auto"
          >
            <Settings size={20} className="text-slate-500" />
            Invoice Settings
          </button>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm shadow-indigo-200 w-full sm:w-auto"
          >
            <Plus size={20} />
            Create Invoice
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-8">
          Error loading invoices. Please check your connection.
        </div>
      ) : invoices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start animate-in fade-in duration-500">
          {invoices.map((invoice) => (
            <InvoiceCard key={invoice.invoiceId} invoice={invoice} />
          ))}
        </div>
      ) : (
        <EmptyState 
          title="No invoices found"
          message="Create an invoice from scratch or generate one directly from a project dashboard."
        />
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <InvoiceFormModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <InvoiceSettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      )}
    </div>
  );
}
