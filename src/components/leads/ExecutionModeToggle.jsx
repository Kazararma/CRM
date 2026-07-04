import React, { useState } from 'react';
import { User, Users, Bolt } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

const ExecutionModeToggle = ({ lead }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Disable if cycle is in-flight. Assuming contactCycles array exists and last one is dispatched.
  const lastCycle = lead.contactCycles?.[lead.currentCycleIndex];
  const isDispatching = lastCycle?.status === 'dispatched' || lastCycle?.status === 'awaiting_response';
  const disabled = isDispatching || isUpdating;

  const currentMode = lead.executionMode || 'manual';

  const handleModeChange = async (newMode) => {
    if (newMode === currentMode || disabled) return;
    
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        executionMode: newMode,
        updatedAt: serverTimestamp()
      });
      // A real app might have a toast notification here
    } catch (err) {
      console.error('Failed to change execution mode:', err);
      alert('Failed to change execution mode');
    } finally {
      setIsUpdating(false);
    }
  };

  const getButtonClass = (mode) => {
    const isActive = currentMode === mode;
    return `flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-bold transition-colors ${
      isActive 
        ? 'bg-blue-600 text-white shadow-sm' 
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;
  };

  return (
    <div 
      className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-1 relative"
      title={disabled ? "Mode locked during active dispatch" : ""}
    >
      <button 
        onClick={() => handleModeChange('manual')} 
        className={`${getButtonClass('manual')} rounded-lg`}
        disabled={disabled}
      >
        <User size={16} /> Manual
      </button>
      <button 
        onClick={() => handleModeChange('hybrid')} 
        className={`${getButtonClass('hybrid')} rounded-lg`}
        disabled={disabled}
      >
        <Users size={16} /> Hybrid
      </button>
      <button 
        onClick={() => handleModeChange('automatic')} 
        className={`${getButtonClass('automatic')} rounded-lg`}
        disabled={disabled}
      >
        <Bolt size={16} /> Auto
      </button>
    </div>
  );
};

export default ExecutionModeToggle;
