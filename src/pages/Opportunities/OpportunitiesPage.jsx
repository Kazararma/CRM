import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOpportunities } from '../../hooks/useOpportunities';
import { useOpportunitiesMetrics } from '../../hooks/useOpportunitiesMetrics';
import OpportunitiesMetricsBar from './OpportunitiesMetricsBar';
import OpportunitiesKanbanBoard from './OpportunitiesKanbanBoard';
import OpportunityDetailModal from '../../components/opportunities/OpportunityDetailModal';
import LeadsTimeFilter from '../Leads/LeadsTimeFilter'; // Reusing the identical UI component

// Helper: resolve a TimeframeFilter object to { fromDate, toDate } Date objects
function resolveDateRange(filter) {
  const now = new Date();
  if (!filter || filter.mode === 'this_month') {
    return {
      fromDate: new Date(now.getFullYear(), now.getMonth(), 1),
      toDate:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    };
  }
  if (filter.mode === 'last_month') {
    return {
      fromDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      toDate:   new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    };
  }
  if (filter.mode === 'last_3_months') {
    const from = new Date(now);
    from.setMonth(from.getMonth() - 3);
    return { fromDate: from, toDate: now };
  }
  if (filter.mode === 'custom' && filter.fromDate && filter.toDate) {
    return { fromDate: filter.fromDate, toDate: filter.toDate };
  }
  // Fallback to this month
  return {
    fromDate: new Date(now.getFullYear(), now.getMonth(), 1),
    toDate:   new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

const OpportunitiesPage = () => {
  const { role } = useAuth();

  // ── Data ───────────────────────────────────────────────────────────────────
  const { opportunities, loading, error } = useOpportunities();
  const metrics = useOpportunitiesMetrics(opportunities);

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(null);
  const [isModalOpen, setIsModalOpen]                     = useState(false);
  
  // Filters
  const [phaseFilter, setPhaseFilter]         = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState({ mode: 'this_month' });

  // Derive the active opportunity from real-time data so the modal always has fresh state
  const activeOpportunity = selectedOpportunityId 
    ? opportunities.find(o => o.id === selectedOpportunityId) 
    : null;

  // ── Client-side Filtering ──────────────────────────────────────────────────
  const { fromDate, toDate } = resolveDateRange(timeframeFilter);
  
  const filteredOpportunities = opportunities.filter(opp => {
    // 1. Phase Filter
    if (phaseFilter !== 'all' && opp.phase !== phaseFilter) return false;
    
    // 2. Timeframe Filter (using createdAt)
    if (opp.createdAt) {
      const oppDate = opp.createdAt.toDate ? opp.createdAt.toDate() : new Date(opp.createdAt);
      if (oppDate < fromDate || oppDate > toDate) return false;
    }
    
    return true;
  });

  // ── Role guard — admin/super_admin only ────────────────────────────────────
  if (role !== 'admin' && role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // ── Opportunity click handler ─────────────
  const handleOpportunityClick = (opportunity) => {
    setSelectedOpportunityId(opportunity.id);
    setIsModalOpen(true);
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        <p className="font-bold">Error loading opportunities.</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunities Pipeline</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manage qualified leads progressing through the 10-stage deal pipeline.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <select 
            value={phaseFilter} 
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-sm"
          >
            <option value="all">All Phases</option>
            <option value="prospecting">1. Prospecting</option>
            <option value="qualification">2. Qualification</option>
            <option value="needs_analysis">3. Needs Analysis</option>
            <option value="value_proposition">4. Value Proposition</option>
            <option value="decision_makers">5. Decision Makers</option>
            <option value="perception_analysis">6. Perception Analysis</option>
            <option value="proposal">7. Proposal</option>
            <option value="negotiation_review">8. Negotiation Review</option>
            <option value="closed_won">9. Closed Won</option>
            <option value="closed_lost">10. Closed Lost</option>
          </select>
          <LeadsTimeFilter value={timeframeFilter} onChange={setTimeframeFilter} />
        </div>
      </div>

      {/* ── Metrics bar ── */}
      <OpportunitiesMetricsBar metrics={metrics} />

      {/* ── Kanban board ── */}
      <OpportunitiesKanbanBoard
        opportunities={filteredOpportunities}
        onOpportunityClick={handleOpportunityClick}
      />

      {/* ── Detail Modal ── */}
      <OpportunityDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        opportunity={activeOpportunity}
      />
    </div>
  );
};

export default OpportunitiesPage;
