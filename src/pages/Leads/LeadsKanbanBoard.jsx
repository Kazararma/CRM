import React, { useMemo } from 'react';
import LeadCard from '../../components/leads/LeadCard';
import { Flame, CircleDot, Snowflake, Plus } from 'lucide-react';

const EmptyColumnState = ({ title }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 text-center">
    <p className="text-gray-400 font-medium text-sm">No {title.toLowerCase()} leads found</p>
  </div>
);

const LeadsKanbanBoard = ({ leads, onLeadClick, onCreateLead }) => {
  // Use useMemo to partition leads into their respective columns
  const hotLeads = useMemo(() => leads.filter(l => l.category === 'hot' && !l.isDeleted), [leads]);
  const neutralLeads = useMemo(() => leads.filter(l => l.category === 'neutral' && !l.isDeleted), [leads]);
  const coldLeads = useMemo(() => leads.filter(l => l.category === 'cold' && !l.isDeleted), [leads]);

  const Column = ({ title, icon: Icon, colorClass, data, category }) => (
    <div className="flex flex-col bg-gray-50/80 rounded-3xl p-4 border border-gray-100 h-full min-h-[500px]">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
          <Icon size={16} className={colorClass} /> {title}
        </h3>
        <span className="bg-white text-gray-600 text-xs font-bold px-2.5 py-0.5 rounded-lg shadow-sm border border-gray-100">
          {data.length}
        </span>
      </div>

      <div className="flex-1 space-y-3 mb-4">
        {data.length > 0 ? (
          data.map(lead => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
          ))
        ) : (
          <EmptyColumnState title={title} />
        )}
      </div>

      <button
        onClick={() => onCreateLead(category)}
        className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-all shadow-sm group"
      >
        <Plus size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" /> Add {title} Lead
      </button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
      <Column title="Hot" icon={Flame} colorClass="text-red-500" data={hotLeads} category="hot" />
      <Column title="Neutral" icon={CircleDot} colorClass="text-yellow-500" data={neutralLeads} category="neutral" />
      <Column title="Cold" icon={Snowflake} colorClass="text-blue-400" data={coldLeads} category="cold" />
    </div>
  );
};

export default LeadsKanbanBoard;
