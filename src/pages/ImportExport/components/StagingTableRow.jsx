import React from 'react';

const StagingTableRow = ({ lead, onUpdate }) => {
  const errors = lead._errors || {};
  
  const handleChange = (field, value) => {
    onUpdate(lead.id, field, value);
  };

  const getClassName = (field) => {
    const baseClass = "w-full min-w-[120px] px-2 py-1.5 text-sm bg-transparent border rounded outline-none focus:ring-1 focus:ring-blue-500 transition-colors";
    return errors[field] 
      ? `${baseClass} border-red-500 bg-red-50 text-red-900` 
      : `${baseClass} border-transparent hover:border-gray-300 focus:border-blue-500`;
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50">
      <td className="p-2">
        <input 
          type="text" 
          value={lead.projectTitle} 
          onChange={(e) => handleChange('projectTitle', e.target.value)}
          className={getClassName('projectTitle')}
          title={errors.projectTitle}
        />
      </td>
      <td className="p-2">
        <select 
          value={lead.source} 
          onChange={(e) => handleChange('source', e.target.value)}
          className={getClassName('source')}
          title={errors.source}
        >
          <option value="">Select...</option>
          <option value="Referral">Referral</option>
          <option value="LinkedIn">LinkedIn</option>
          <option value="Cold Call">Cold Call</option>
          <option value="Website">Website</option>
          <option value="Email Campaign">Email Campaign</option>
          <option value="Other">Other</option>
        </select>
      </td>
      <td className="p-2">
        <select 
          value={lead.category} 
          onChange={(e) => handleChange('category', e.target.value)}
          className={getClassName('category')}
          title={errors.category}
        >
          <option value="">Select...</option>
          <option value="hot">Hot</option>
          <option value="neutral">Neutral</option>
          <option value="cold">Cold</option>
        </select>
      </td>
      <td className="p-2">
        <input 
          type="text" 
          value={lead.description} 
          onChange={(e) => handleChange('description', e.target.value)}
          className={getClassName('description')}
          title={errors.description}
        />
      </td>
      <td className="p-2">
        <input 
          type="text" 
          value={lead.clientName} 
          onChange={(e) => handleChange('clientName', e.target.value)}
          className={getClassName('clientName')}
          title={errors.clientName}
        />
      </td>
      <td className="p-2">
        <input 
          type="text" 
          value={lead.phoneNumber} 
          onChange={(e) => handleChange('phoneNumber', e.target.value)}
          className={getClassName('phoneNumber')}
          title={errors.phoneNumber}
        />
      </td>
      <td className="p-2">
        <input 
          type="text" 
          value={lead.email} 
          onChange={(e) => handleChange('email', e.target.value)}
          className={getClassName('email')}
          title={errors.email}
        />
      </td>
      <td className="p-2">
        <input 
          type="number" 
          value={lead.estimatedBilling} 
          onChange={(e) => handleChange('estimatedBilling', e.target.value)}
          className={getClassName('estimatedBilling')}
          title={errors.estimatedBilling}
        />
      </td>
      <td className="p-2">
        <input 
          type="number" 
          value={lead.estimatedBudget} 
          onChange={(e) => handleChange('estimatedBudget', e.target.value)}
          className={getClassName('estimatedBudget')}
          title={errors.estimatedBudget}
        />
      </td>
    </tr>
  );
};

export default StagingTableRow;
