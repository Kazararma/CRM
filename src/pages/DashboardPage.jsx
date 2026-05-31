import React, { useState } from "react";
import { useProjects } from "../hooks/useProjects";
import { useAuth } from "../context/AuthContext";
import StatusTabs from "../components/dashboard/StatusTabs";
import ProjectDashboardCard from "../components/dashboard/ProjectDashboardCard";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import EmptyState from "../components/shared/EmptyState";
import { LayoutDashboard, BarChart2 } from "lucide-react";
import AnalyticsDashboardPage from "./Analytics/AnalyticsDashboardPage";

const DashboardPage = () => {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";

  const { projects, loading, error } = useProjects();
  const [activeStatus, setActiveStatus] = useState("ongoing");
  const [activeTab, setActiveTab] = useState("overview");

  const filteredProjects = projects.filter((p) => p.status === activeStatus);

  if (loading) return <LoadingSpinner fullPage />;

  const renderOverview = () => {
    if (!loading && projects.length === 0) {
      return (
        <EmptyState 
          title="No assigned projects"
          message="When projects are assigned to you or created by admins, they will appear here."
        />
      );
    }

    return (
      <>
        <StatusTabs projects={projects} onTabChange={setActiveStatus} />

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
            Error loading dashboard. Please check your connection.
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="animate-in fade-in duration-500">
            {filteredProjects.map((project) => (
              <ProjectDashboardCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <EmptyState 
            title={`No ${activeStatus} projects found`}
            message="You don't have any projects in this status."
          />
        )}
      </>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <LayoutDashboard className="text-blue-600" size={32} />
            Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Track your assigned projects, log your work, and manage budgets in real-time.
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="flex space-x-1 rounded-xl bg-gray-100 p-1 w-full max-w-sm">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold leading-5 transition-all flex items-center justify-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            <LayoutDashboard size={16} /> Overview
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold leading-5 transition-all flex items-center justify-center gap-2 ${
              activeTab === 'analytics'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            <BarChart2 size={16} /> Analytics
          </button>
        </div>
      )}

      {activeTab === 'overview' ? renderOverview() : (
        <div className="pt-2 -mx-4 md:-mx-8">
          <AnalyticsDashboardPage />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
