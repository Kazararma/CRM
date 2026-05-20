import React, { useMemo } from 'react';
import OpportunityCard from '../../components/opportunities/OpportunityCard';
import { Flame, CircleDot, Snowflake, TrendingUp } from 'lucide-react';

const EmptyColumnState = ({ title }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 text-center">
    <TrendingUp size={28} className="text-gray-300 mb-3" />
    <p className="text-gray-400 font-semibold text-sm">No {title.toLowerCase()} opportunities</p>
    <p className="text-gray-300 text-xs mt-1">Opportunities are created from qualified Leads.</p>
  </div>
);

/**
 * OpportunitiesKanbanBoard
 * Three-column layout partitioned by category: Hot | Neutral | Cold.
 * No create button — opportunities enter exclusively via Handshake 1.
 */
const OpportunitiesKanbanBoard = ({ opportunities, onOpportunityClick }) => {
  const hotOpps     = useMemo(() => opportunities.filter(o => o.category === 'hot'),     [opportunities]);
  const neutralOpps = useMemo(() => opportunities.filter(o => o.category === 'neutral'), [opportunities]);
  const coldOpps    = useMemo(() => opportunities.filter(o => o.category === 'cold'),    [opportunities]);

  const Column = ({ title, icon: Icon, colorClass, data }) => (
    <div className="flex flex-col bg-gray-50/80 rounded-3xl p-4 border border-gray-100 h-full min-h-[500px]">
      {/* Column header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
          <Icon size={16} className={colorClass} />
          {title}
        </h3>
        <span className="bg-white text-gray-600 text-xs font-bold px-2.5 py-0.5 rounded-lg shadow-sm border border-gray-100">
          {data.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-3 mb-4">
        {data.length > 0 ? (
          data.map(opp => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onClick={() => onOpportunityClick(opp)}
            />
          ))
        ) : (
          <EmptyColumnState title={title} />
        )}
      </div>

      {/* Read-only caption — no create button */}
      <p className="text-center text-[10px] font-medium text-gray-400 py-2 border-t border-gray-100 mt-auto">
        Opportunities are created from qualified Leads.
      </p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
      <Column title="Hot"     icon={Flame}     colorClass="text-red-500"    data={hotOpps}     />
      <Column title="Neutral" icon={CircleDot}  colorClass="text-yellow-500" data={neutralOpps}  />
      <Column title="Cold"    icon={Snowflake}  colorClass="text-blue-400"   data={coldOpps}    />
    </div>
  );
};

export default OpportunitiesKanbanBoard;
