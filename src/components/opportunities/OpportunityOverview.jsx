import React from 'react';
import { formatINR } from '../../utils/formatCurrency';
import { FileText, Target, Users, DollarSign, Briefcase } from 'lucide-react';

const OpportunityOverview = ({ opportunity }) => {
  const q = opportunity.qualification || {};
  const n = opportunity.needsAnalysis || {};
  const p = opportunity.proposal || {};
  const nr = opportunity.negotiationReview || {};
  const d = opportunity.decisionMakers || {};

  const SectionHeader = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
      <Icon size={16} className="text-blue-600" />
      <h4 className="text-sm font-bold text-gray-800">{title}</h4>
    </div>
  );

  const DataRow = ({ label, value, isCurrency = false }) => (
    <div className="mb-2">
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">{label}</span>
      <span className={`text-sm text-gray-700 ${isCurrency ? 'font-bold text-gray-900' : ''}`}>
        {value ? (isCurrency ? formatINR(value) : value) : '—'}
      </span>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6">
        <h2 className="text-xl font-black text-blue-900 mb-1">Opportunity Overview</h2>
        <p className="text-sm text-blue-700">A high-level summary of the data collected across all completed pipeline stages.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Core Details */}
        <div className="space-y-6">
          <section>
            <SectionHeader icon={Briefcase} title="Project Scope (Stage 2 & 3)" />
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <DataRow label="Project Title" value={q.projectTitle} />
              <DataRow label="Brief / Scope" value={q.projectBrief} />
              <DataRow label="Detailed Needs" value={n.detailedProjectDetails} />
              <DataRow label="Client Pain Points" value={n.painPoints} />
            </div>
          </section>

          <section>
            <SectionHeader icon={Users} title="Stakeholders (Stage 5)" />
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <DataRow label="Assigned Admin(s)" value={(d.assignedAdminNames || []).join(', ')} />
              <DataRow label="Client Contacts" value={d.stakeholderNotes} />
            </div>
          </section>
        </div>

        {/* Financials */}
        <div className="space-y-6">
          <section>
            <SectionHeader icon={DollarSign} title="Financials (Stage 2, 3, 7, 8)" />
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 grid grid-cols-2 gap-4">
              <div>
                <DataRow label="Est. Budget" value={q.estimatedBudget} isCurrency />
                <DataRow label="Internal Cost" value={n.estimatedCosts} isCurrency />
              </div>
              <div>
                <DataRow label="Initial Ask" value={p.moneyAskedFromClient} isCurrency />
                <DataRow label="Agreed Total" value={nr.moneyAgreedByClient} isCurrency />
              </div>
            </div>
          </section>

          <section>
            <SectionHeader icon={FileText} title="Contract (Stage 7)" />
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <DataRow label="Contract Terms" value={p.contractTermsDetails} />
              <div className="flex gap-4">
                <DataRow label="Start Date" value={p.contractStartDate ? new Date(p.contractStartDate.seconds * 1000).toLocaleDateString() : null} />
                <DataRow label="End Date" value={p.contractEndDate ? new Date(p.contractEndDate.seconds * 1000).toLocaleDateString() : null} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default OpportunityOverview;
