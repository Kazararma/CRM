import React from 'react';
import ChatMessageList from './ChatMessageList';
import ChatActionBar from './ChatActionBar';

const LeadChatPanel = ({ lead }) => {
  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="p-4 md:p-6 border-b border-gray-100 bg-white/95 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <h3 className="text-lg font-black text-gray-900 tracking-tight">Agent Conversation History</h3>
        <p className="text-xs font-medium text-gray-500 mt-0.5">Review the AI agent's outreach and responses.</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50">
        <ChatMessageList lead={lead} />
      </div>
      
      <div className="p-4 md:p-6 border-t border-gray-100 bg-white shrink-0">
        <ChatActionBar lead={lead} />
      </div>
    </div>
  );
};

export default LeadChatPanel;
