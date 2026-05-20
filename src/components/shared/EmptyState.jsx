import React from "react";
import { FolderOpen } from "lucide-react";

const EmptyState = ({ title, message, icon: Icon = FolderOpen }) => {
  return (
    <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
      <div className="flex justify-center mb-4">
        <div className="p-4 bg-slate-50 rounded-full shadow-sm border border-slate-100 text-slate-400">
          <Icon size={32} />
        </div>
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 max-w-sm mx-auto text-sm">{message}</p>
    </div>
  );
};

export default EmptyState;
