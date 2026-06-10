import React, { useState, useEffect } from 'react';
import { X, Mail, Download, AlertTriangle, Send } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../firebase/config';
import { formatINR } from '../../../utils/formatCurrency';

export default function SendEmailModal({ 
  isOpen, 
  onClose, 
  recipientEmail: initialEmail, 
  opportunityTitle, 
  grandTotal, 
  companySettings, 
  proposalDear,
  onSendAndDownload 
}) {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail || '');
      setSubject(`Proposal from CRM SaaS — ${opportunityTitle || 'Your Project'}`);
      
      const signature = companySettings?.preparedBy?.signatureText || 'CRM SaaS Team';
      const dearText = proposalDear || 'Client';
      const totalStr = formatINR(grandTotal);

      setBody(
`Dear ${dearText},

Please find attached our proposal for ${opportunityTitle || 'the project'}.

Total Proposed Value: ${totalStr}

Please review and let us know if you have any questions.

Warm regards,
${signature}`
      );
    }
  }, [isOpen, initialEmail, opportunityTitle, grandTotal, companySettings, proposalDear]);

  if (!isOpen) return null;

  const handleSend = async () => {
    setIsProcessing(true);
    try {
      const pdfBlob = await onSendAndDownload();
      if (!pdfBlob) throw new Error("Failed to generate PDF");

      const safeTitle = (opportunityTitle || 'Proposal').replace(/\s+/g, '_');
      const storageRef = ref(storage, `proposals/${safeTitle}_${Date.now()}.pdf`);
      
      await uploadBytes(storageRef, pdfBlob);
      const downloadURL = await getDownloadURL(storageRef);

      const templateParams = {
        to_email: email,
        from_name: companySettings?.company?.name || 'CRM SaaS',
        reply_to: "your_email@example.com",
        subject: subject,
        message: body,
        proposal_link: downloadURL
      };

      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        templateParams,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );
      
      onClose();
    } catch (e) {
      console.error("Failed to send email via EmailJS:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Mail size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Send Proposal via Email</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Recipient Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
            <input 
              type="text" 
              value={subject} 
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Message Body</label>
            <textarea 
              rows={8}
              value={body} 
              onChange={e => setBody(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-200 bg-white border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSend}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Send size={16} />
            {isProcessing ? 'Uploading & Sending...' : 'Send Proposal'}
          </button>
        </div>

      </div>
    </div>
  );
}
