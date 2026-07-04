import React from 'react';
// Force Vite HMR reload
import { Mail, Phone, Link, Camera, MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import LeadPhaseTimeline from './LeadPhaseTimeline';
import ExecutionModeToggle from './ExecutionModeToggle';
import ManualInstructionArea from './ManualInstructionArea';

const LeadHeaderCard = ({ lead }) => {
  return (
    <div className="bg-white p-6 border-b border-gray-100">
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-xl font-bold text-gray-900">{lead.name}</h2>
        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${
          lead.category === 'hot' ? 'bg-red-50 text-red-600 border-red-200' :
          lead.category === 'cold' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          'bg-yellow-50 text-yellow-600 border-yellow-200'
        }`}>
          {lead.category || 'neutral'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500">
        <span className="flex items-center gap-1"><MapPin size={12} /> {lead.place}</span>
        <span className="w-1 h-1 rounded-full bg-gray-300" />
        <span className="flex items-center gap-1">
          <Calendar size={12} /> Added: {lead.createdAt ? format(lead.createdAt.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt), 'dd MMM yyyy') : 'Unknown'}
        </span>
      </div>
    </div>
  );
};

const LeadContactFields = ({ lead }) => {
  return (
    <div className="bg-white p-6 border-b border-gray-100">
      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Contact Details</h4>
      <div className="space-y-3">
        {lead.email && (
          <div className="flex items-center gap-3 text-sm">
            <Mail size={16} className="text-gray-400" />
            <a href={`mailto:${lead.email}`} className="font-bold text-blue-600 hover:underline">{lead.email}</a>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-3 text-sm">
            <Phone size={16} className="text-gray-400" />
            <a href={`tel:${lead.phone}`} className="font-bold text-gray-900">{lead.phone}</a>
          </div>
        )}
        {lead.linkedin && (
          <div className="flex items-center gap-3 text-sm">
            <Link size={16} className="text-gray-400" />
            <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">LinkedIn Profile</a>
          </div>
        )}
        {lead.instagram && (
          <div className="flex items-center gap-3 text-sm">
            <Camera size={16} className="text-gray-400" />
            <span className="font-medium text-gray-700">{lead.instagram}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const LeadServiceDescription = ({ description }) => {
  return (
    <div className="bg-white p-6 border-b border-gray-100">
      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Service Requested</h4>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{description}</p>
    </div>
  );
};

const LeadInfoPanel = ({ lead }) => {
  return (
    <div className="flex flex-col h-full">
      <LeadHeaderCard lead={lead} />
      
      <div className="p-6 bg-gray-50 border-b border-gray-100">
        <LeadPhaseTimeline lead={lead} />
      </div>

      <div className="p-6 bg-white border-b border-gray-100">
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Execution Mode</h4>
        <ExecutionModeToggle lead={lead} />
      </div>

      <LeadContactFields lead={lead} />
      <LeadServiceDescription description={lead.serviceDescription} />
      
      {lead.phase === 'contacted' && (
        <div className="p-6 bg-gray-50">
          <ManualInstructionArea lead={lead} />
        </div>
      )}
    </div>
  );
};

export default LeadInfoPanel;
