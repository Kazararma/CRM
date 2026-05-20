import React, { useState } from "react";
import { useProjects } from "../hooks/useProjects";
import StatusTabs from "../components/dashboard/StatusTabs";
import ProjectDashboardCard from "../components/dashboard/ProjectDashboardCard";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import EmptyState from "../components/shared/EmptyState";
import { LayoutDashboard } from "lucide-react";

const DashboardPage = () => {
  const { projects, loading, error } = useProjects();
  const [activeStatus, setActiveStatus] = useState("ongoing");

  const filteredProjects = projects.filter((p) => p.status === activeStatus);

  if (loading) return <LoadingSpinner fullPage />;

  if (!loading && projects.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <EmptyState 
          title="No assigned projects"
          message="When projects are assigned to you or created by admins, they will appear here."
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
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
    </div>
  );
};

export default DashboardPage;
