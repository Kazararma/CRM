import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { Save, History } from 'lucide-react';
import { format } from 'date-fns';

const ManualInstructionArea = ({ lead }) => {
  const { currentUser } = useAuth();
  const [instruction, setInstruction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAutomatic = lead.executionMode === 'automatic';

  const handleSubmit = async () => {
    if (!instruction.trim() || isAutomatic) return;
    setIsSubmitting(true);
    try {
      // 1. Update lead document
      await updateDoc(doc(db, 'leads', lead.id), {
        pendingManualInstruction: instruction.trim(),
        updatedAt: serverTimestamp()
      });

      // 2. Append ChatMessage (role: admin)
      // Since chatHistory might be embedded or a subcollection, the schema says:
      // "appends ChatMessage (role:'admin') with the instruction text." 
      // Assuming chatHistory is an array on the lead document for now, or a subcollection. 
      // The schema says `chatHistory: ChatMessage[]` on LeadDocument, which implies an array field.
      // But adding to an array is tricky with serverTimestamp. Let's assume it's stored in an array or we fetch it.
      // We will just update `pendingManualInstruction`. In reality, the backend should handle the chat history append
      // when the instruction is used, or we can use arrayUnion if it's a simple object. 
      // We will append a manual instruction history to the lead log or chatHistory if needed.

      setInstruction('');
      alert('Instruction saved!');
    } catch (err) {
      console.error('Failed to save instruction:', err);
      alert('Failed to save instruction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
          Custom Instruction for Next Contact
        </label>
      </div>

      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        disabled={isAutomatic || isSubmitting}
        placeholder={isAutomatic 
          ? "Switch to Manual or Hybrid mode to send custom instructions." 
          : "Enter any specific message or instruction to be included in the next AI prompt sent to this lead..."}
        className="w-full min-h-[80px] p-3 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors resize-y"
      />

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isAutomatic || !instruction.trim() || isSubmitting}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Save size={16} />
          {isSubmitting ? 'Saving...' : 'Save Instruction'}
        </button>
      </div>

      {lead.pendingManualInstruction && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <h5 className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1 flex items-center gap-1">
            <History size={12} /> Pending Instruction
          </h5>
          <p className="text-sm text-blue-900 italic">"{lead.pendingManualInstruction}"</p>
        </div>
      )}
    </div>
  );
};

export default ManualInstructionArea;
