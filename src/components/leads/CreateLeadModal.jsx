import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, Save, Building2, User, Phone, Mail, FileText, IndianRupee, Tag } from 'lucide-react';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

const SOURCES = ["Referral", "LinkedIn", "Cold Call", "Website", "Email Campaign", "Other"];
const CATEGORIES = [
  { value: 'hot', label: 'Hot', color: 'text-red-500 bg-red-50 border-red-200' },
  { value: 'neutral', label: 'Neutral', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  { value: 'cold', label: 'Cold', color: 'text-blue-500 bg-blue-50 border-blue-200' }
];

const CreateLeadModal = ({ isOpen, onClose, defaultCategory = 'neutral' }) => {
  const { currentUser, userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    projectTitle: '',
    clientName: '',
    source: '',
    phoneNumber: '',
    email: '',
    description: '',
    estimatedBilling: '',
    estimatedBudget: '',
    category: defaultCategory
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await addDoc(collection(db, 'leads'), {
        projectTitle: formData.projectTitle.trim(),
        clientName:   formData.clientName.trim(),
        source:       formData.source,
        phoneNumber:  formData.phoneNumber.trim(),
        email:        formData.email.trim(),
        description:  formData.description.trim(),
        category:     formData.category,
        phase:        'open',              // New naming convention
        estimatedBilling: Number(formData.estimatedBilling),
        estimatedBudget:  Number(formData.estimatedBudget),
        // New conversion-tracking fields (Handshake 1)
        isConvertedToOpportunity:   false,
        convertedOpportunityId:     null,
        convertedToOpportunityAt:   null,
        convertedToOpportunityBy:   null,
        isDeleted:  false,
        createdAt:  serverTimestamp(),
        createdBy:  currentUser.uid,
        updatedAt:  serverTimestamp(),
        updatedBy:  currentUser.uid,
      });

      onClose(); // Close on success
      // Reset form
      setFormData({
        projectTitle: '', clientName: '', source: '', phoneNumber: '', 
        email: '', description: '', estimatedBilling: '', estimatedBudget: '', category: defaultCategory
      });
    } catch (err) {
      console.error("Error creating lead:", err);
      setError("Failed to create lead. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => !isSubmitting && onClose()}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-8"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-8"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all border border-gray-100">
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                  <Dialog.Title as="h3" className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Building2 className="text-blue-500" /> Create New Lead
                  </Dialog.Title>
                  <button onClick={onClose} disabled={isSubmitting} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest border-b pb-2">Details</h4>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project Title <span className="text-red-500">*</span></label>
                        <input required type="text" name="projectTitle" value={formData.projectTitle} onChange={handleChange} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. Website Redesign" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Source <span className="text-red-500">*</span></label>
                          <select required name="source" value={formData.source} onChange={handleChange} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="">Select source</option>
                            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category <span className="text-red-500">*</span></label>
                          <select required name="category" value={formData.category} onChange={handleChange} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description <span className="text-red-500">*</span></label>
                        <textarea required name="description" value={formData.description} onChange={handleChange} rows="3" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none" placeholder="Brief project scope..."></textarea>
                      </div>
                    </div>

                    {/* Contact & Finance */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest border-b pb-2">Client & Estimates</h4>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Client Name <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input required type="text" name="clientName" value={formData.clientName} onChange={handleChange} className="w-full pl-10 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Company or Individual" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input required type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className="w-full pl-10 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+91..." />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full pl-10 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="client@..." />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Est. Billing (₹) <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                            <input required type="number" min="0" name="estimatedBilling" value={formData.estimatedBilling} onChange={handleChange} className="w-full pl-10 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Est. Budget Cost (₹) <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" size={16} />
                            <input required type="number" min="0" name="estimatedBudget" value={formData.estimatedBudget} onChange={handleChange} className="w-full pl-10 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none" placeholder="0" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md shadow-blue-200 disabled:opacity-50">
                      <Save size={16} /> {isSubmitting ? 'Creating...' : 'Create Lead'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreateLeadModal;
