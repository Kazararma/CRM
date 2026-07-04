import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLeads } from '../../hooks/useLeads';
import { useLeadsMetrics } from '../../hooks/useLeadsMetrics';
import LeadsMetricsBar from './LeadsMetricsBar';
import LeadsTimeFilter from './LeadsTimeFilter';
import LeadListView from '../../components/leads/LeadListView';
import CreateLeadModal from '../../components/leads/CreateLeadModal';
import LeadDetailView from '../../components/leads/LeadDetailView';

const LeadsPage = () => {
  const { role } = useAuth();
  const [timeframeFilter, setTimeframeFilter] = useState({ mode: 'this_month' });
  const [phaseFilter, setPhaseFilter] = useState('all');
  
  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDefaultCategory, setCreateDefaultCategory] = useState('neutral');
  const [selectedLead, setSelectedLead] = useState(null);
  
  const { leads, loading, error } = useLeads(timeframeFilter);
  const metrics = useLeadsMetrics(leads);

  // Guard: Only admin and super_admin can access Leads
  if (role !== 'admin' && role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLeadClick = (lead) => {
    setSelectedLead(lead);
  };

  const handleCreateLead = (category) => {
    setCreateDefaultCategory(category);
    setIsCreateModalOpen(true);
  };

  // Always keep selectedLead up to date with the realtime leads array
  const activeLead = selectedLead 
    ? leads.find(l => l.id === selectedLead.id) || selectedLead 
    : null;

  const filteredLeads = leads.filter(lead => {
    if (phaseFilter === 'all') return true;
    return lead.phase === phaseFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        <p>Error loading leads. Please try again.</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads Management</h1>
          <p className="text-gray-500 mt-1 text-sm">Track prospective clients and negotiate contracts.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => handleCreateLead('neutral')}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            + Create Lead
          </button>
          <select 
            value={phaseFilter} 
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-sm"
          >
            <option value="all">All Phases</option>
            <option value="open">Open</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="unqualified">Unqualified</option>
          </select>
          <LeadsTimeFilter value={timeframeFilter} onChange={setTimeframeFilter} />
        </div>
      </div>

      <LeadsMetricsBar metrics={metrics} />

      <LeadListView 
        leads={filteredLeads} 
        onLeadClick={handleLeadClick} 
      />

      {/* Modals */}
      <CreateLeadModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        defaultCategory={createDefaultCategory} 
      />

      <LeadDetailView 
        isOpen={!!selectedLead} 
        onClose={() => setSelectedLead(null)} 
        lead={activeLead} 
      />
    </div>
  );
};

export default LeadsPage;
