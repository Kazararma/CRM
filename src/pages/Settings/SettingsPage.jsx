import React, { useState } from 'react';
import AgencyAITab from './AgencyAITab';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('agencyAI');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage global configuration and AI tools.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {/* Settings Sidebar Tabs */}
        <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 flex-shrink-0">
          <nav className="flex flex-col gap-1 p-4">
            <button
              onClick={() => setActiveTab('agencyAI')}
              className={`text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'agencyAI'
                  ? 'bg-white text-indigo-600 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Agency AI & Telephony
            </button>
            {/* Future tabs can be added here */}
          </nav>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 p-6 bg-white overflow-y-auto">
          {activeTab === 'agencyAI' && <AgencyAITab />}
        </div>
      </div>
    </div>
  );
}
