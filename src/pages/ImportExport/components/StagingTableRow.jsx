import React from 'react';
import { Trash2 } from 'lucide-react';

const StagingTableRow = ({ lead, onUpdate, onRemove }) => {
  const errors = lead._errors || {};
  const isDiscarded = lead.isDiscarded;
  const isWarning = lead.garbageScore >= 0.5 && lead.garbageScore < 0.8;
  const hasErrors = Object.keys(errors).length > 0;
  
  const handleChange = (field, value) => {
    if (isDiscarded) return;
    onUpdate(lead.id, field, value);
  };

  const getClassName = (field) => {
    const baseClass = "w-full min-w-[120px] px-2 py-1.5 text-sm bg-transparent border rounded outline-none transition-colors";
    if (isDiscarded) {
      return `${baseClass} text-gray-400 border-transparent cursor-not-allowed`;
    }
    return errors[field] 
      ? `${baseClass} border-red-500 bg-red-50 text-red-900` 
      : `${baseClass} border-transparent hover:border-gray-300 focus:border-blue-500`;
  };

  let rowClass = "border-b border-gray-100 hover:bg-gray-50/50";
  if (isDiscarded) {
    rowClass += " bg-gray-50 opacity-60";
  } else if (hasErrors) {
    rowClass += " bg-red-50/30";
  } else if (isWarning) {
    rowClass += " bg-orange-50/50";
  }

  return (
    <tr className={rowClass} title={isDiscarded ? lead.garbageReason : (isWarning ? `Warning: ${lead.garbageReason}` : '')}>
      <td className="p-2">
        <input 
          type="text" 
          value={lead.name || ''} 
          onChange={(e) => handleChange('name', e.target.value)}
          className={getClassName('name')}
          title={errors.name}
          disabled={isDiscarded}
        />
      </td>
      <td className="p-2">
        <input 
          type="text" 
          value={lead.place || ''} 
          onChange={(e) => handleChange('place', e.target.value)}
          className={getClassName('place')}
          title={errors.place}
          disabled={isDiscarded}
        />
      </td>
      <td className="p-2">
        <input 
          type="text" 
          value={lead.email || ''} 
          onChange={(e) => handleChange('email', e.target.value)}
          className={getClassName('email')}
          title={errors.email}
          disabled={isDiscarded}
        />
      </td>
      <td className="p-2">
        <input 
          type="text" 
          value={lead.phone || ''} 
          onChange={(e) => handleChange('phone', e.target.value)}
          className={getClassName('phone')}
          title={errors.phone}
          disabled={isDiscarded}
        />
      </td>
      <td className="p-2">
        <input 
          type="text" 
          value={lead.linkedin || ''} 
          onChange={(e) => handleChange('linkedin', e.target.value)}
          className={getClassName('linkedin')}
          title={errors.linkedin}
          disabled={isDiscarded}
        />
      </td>
      <td className="p-2">
        <input 
          type="text" 
          value={lead.instagram || ''} 
          onChange={(e) => handleChange('instagram', e.target.value)}
          className={getClassName('instagram')}
          title={errors.instagram}
          disabled={isDiscarded}
        />
      </td>
      <td className="p-2">
        <input 
          type="text" 
          value={lead.serviceDescription || ''} 
          onChange={(e) => handleChange('serviceDescription', e.target.value)}
          className={getClassName('serviceDescription')}
          title={errors.serviceDescription}
          disabled={isDiscarded}
        />
      </td>
      <td className="p-2">
        <select 
          value={lead.category || ''} 
          onChange={(e) => handleChange('category', e.target.value)}
          className={getClassName('category')}
          title={errors.category}
          disabled={isDiscarded}
        >
          <option value="">Select...</option>
          <option value="hot">Hot</option>
          <option value="neutral">Neutral</option>
          <option value="cold">Cold</option>
        </select>
      </td>
      <td className="p-2 text-center">
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          title="Delete lead from staging"
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
};

export default StagingTableRow;
