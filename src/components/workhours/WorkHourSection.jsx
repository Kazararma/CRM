import React from "react";
import { useAuth } from "../../context/AuthContext";
import WorkHourWorkerView from "./WorkHourWorkerView";
import WorkHourAdminView from "./WorkHourAdminView";
import { Clock } from "lucide-react";

const WorkHourSection = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = React.useState("team"); // 'team' or 'personal'
  const isAdmin = role === "admin" || role === "super_admin";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <Clock className="text-blue-600" size={32} />
            Work Hours
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            {isAdmin 
              ? "Monitor organizational efficiency, validate logs, and track personal time." 
              : "Review your active shifts, logged hours, and validation status."}
          </p>
        </div>

        {isAdmin && (
          <div className="flex bg-gray-100 p-1 rounded-xl self-start">
            <button 
              onClick={() => setActiveTab("team")}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'team' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              TEAM OVERVIEW
            </button>
            <button 
              onClick={() => setActiveTab("personal")}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'personal' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              MY HOURS
            </button>
          </div>
        )}
      </div>

      {isAdmin ? (
        activeTab === "team" ? <WorkHourAdminView /> : <WorkHourWorkerView />
      ) : (
        <WorkHourWorkerView />
      )}
    </div>
  );
};

export default WorkHourSection;
