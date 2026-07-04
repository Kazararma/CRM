import React from 'react';
import { Bot, User, Activity, AlertTriangle, Info } from 'lucide-react';
import { format } from 'date-fns';
import CycleAccordion from './CycleAccordion';

const SystemMessage = ({ msg }) => (
  <div className="flex justify-center my-4">
    <div className="bg-gray-100 text-gray-500 text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-2">
      <Info size={14} />
      {msg.content}
    </div>
  </div>
);

const AgentMessage = ({ msg }) => (
  <div className="flex items-start gap-3 my-4">
    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
      <Bot size={16} />
    </div>
    <div className="bg-white border border-blue-100 p-4 rounded-2xl rounded-tl-none shadow-sm max-w-[85%]">
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>
      <span className="text-[10px] text-gray-400 mt-2 block font-medium">
        {format(msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp), 'h:mm a')}
      </span>
    </div>
  </div>
);

const FilterMessage = ({ msg }) => (
  <div className="flex items-start gap-3 my-4">
    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
      <Activity size={16} />
    </div>
    <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-2xl rounded-tl-none shadow-sm max-w-[85%]">
      <h5 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1 flex items-center gap-1">
        <AlertTriangle size={12} /> AI Filter Extract
      </h5>
      <p className="text-sm text-orange-900 whitespace-pre-wrap">{msg.content}</p>
      <span className="text-[10px] text-orange-400 mt-2 block font-medium">
        {format(msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp), 'h:mm a')}
      </span>
    </div>
  </div>
);

const AdminMessage = ({ msg }) => (
  <div className="flex flex-row-reverse items-start gap-3 my-4">
    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
      <User size={16} />
    </div>
    <div className="bg-green-600 text-white p-4 rounded-2xl rounded-tr-none shadow-sm max-w-[85%]">
      <h5 className="text-[10px] font-black text-green-200 uppercase tracking-widest mb-1">
        Admin Instruction
      </h5>
      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
      <span className="text-[10px] text-green-200 mt-2 block font-medium text-right">
        {format(msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp), 'h:mm a')}
      </span>
    </div>
  </div>
);

const ChatMessageList = ({ lead }) => {
  const messages = lead.chatHistory || [];
  const cycles = lead.contactCycles || [];

  if (messages.length === 0 && cycles.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400">
        <Bot size={48} className="mb-4 text-gray-200" />
        <p className="text-sm font-medium">No conversation history yet.</p>
        <p className="text-xs">Dispatch the agent to begin outreach.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 
        Ideally, we would interleave cycles and messages chronologically.
        For simplicity, we render cycles as accordion cards at the top,
        or interleave them if cycleRef is present on messages. 
        Assuming cycles are rendered separately as accordions for detail:
      */}
      {cycles.length > 0 && (
        <div className="space-y-3 mb-8">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Cycles</h4>
          {cycles.map((cycle, idx) => (
            <CycleAccordion key={cycle.cycleId || idx} cycle={cycle} index={idx + 1} />
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Chat Timeline</h4>
          {messages.map((msg, idx) => {
            if (msg.role === 'system') return <SystemMessage key={msg.messageId || idx} msg={msg} />;
            if (msg.role === 'ai_agent') return <AgentMessage key={msg.messageId || idx} msg={msg} />;
            if (msg.role === 'filter') return <FilterMessage key={msg.messageId || idx} msg={msg} />;
            if (msg.role === 'admin') return <AdminMessage key={msg.messageId || idx} msg={msg} />;
            // default fallback
            return <SystemMessage key={msg.messageId || idx} msg={msg} />;
          })}
        </div>
      )}
    </div>
  );
};

export default ChatMessageList;
